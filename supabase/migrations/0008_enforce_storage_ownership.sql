-- TASK-059: private object isolation and a minimal trusted pre-row upload intent.
-- TASK-060 must bind intent issuance to atomic quotas and migrate application clients.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';
lock table public.projects, public.products, public.assets in share row exclusive mode;
lock table storage.buckets, storage.objects in share row exclusive mode;

do $$
begin
  if not exists (select 1 from storage.buckets where id = 'product-assets' and name = 'product-assets') then
    raise exception 'Expected product-assets bucket missing';
  end if;
  if exists (select 1 from pg_catalog.pg_policies where schemaname = 'storage' and tablename in ('objects','buckets')) then
    raise exception 'Unexpected existing Storage policies; review explicitly';
  end if;
  if to_regprocedure('storage.allow_only_operation(text)') is null then
    raise exception 'Storage operation helper required';
  end if;
  if exists (select 1 from pg_catalog.pg_class where oid in ('storage.objects'::regclass,'storage.buckets'::regclass) and not relrowsecurity) then
    raise exception 'Managed Storage RLS must already be enabled';
  end if;
  if exists (
    select 1 from storage.objects o where o.bucket_id = 'product-assets' and not exists (
      select 1 from public.products p join public.projects root on root.id = p.project_id
      where root.owner_id is not null and o.name ~
        ('^projects/' || root.id || '/products/' || p.id || '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$')
    )
  ) then raise exception 'Existing Storage path ownership mismatch'; end if;
  if exists (
    select 1 from storage.objects o join public.assets a
      on a.id::text = split_part(split_part(o.name,'/',5),'.',1)
    where o.bucket_id = 'product-assets' and a.storage_path <> o.name
  ) then raise exception 'Existing Asset and Storage identity mismatch'; end if;
end;
$$;

-- Update in place; existing names, owners, objects and bytes are never rewritten.
update storage.buckets set public = false, file_size_limit = 10485760,
  allowed_mime_types = array['image/jpeg','image/png','image/webp']
where id = 'product-assets';

create schema if not exists app_private;
revoke all on schema app_private from public, anon, authenticated;
grant usage on schema app_private to authenticated, service_role;

-- Not a public RPC or a quota ledger. Only trusted offline/server code can issue
-- an intent. Users cannot manufacture approval by inserting their own Asset row.
create table app_private.asset_upload_intents (
  asset_id uuid primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  product_id uuid not null,
  storage_path text not null unique,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  finalized_at timestamptz,
  constraint asset_upload_intents_product_project_fkey foreign key (product_id,project_id)
    references public.products(id,project_id) on delete cascade,
  constraint asset_upload_intents_path_check check (storage_path ~
    ('^projects/' || project_id || '/products/' || product_id || '/' || asset_id || '\.(jpg|png|webp)$')),
  constraint asset_upload_intents_expiry_check check (expires_at > created_at and expires_at <= created_at + interval '15 minutes')
);
create index asset_upload_intents_owner_idx on app_private.asset_upload_intents(owner_id);
create index asset_upload_intents_product_idx on app_private.asset_upload_intents(product_id,project_id);
alter table app_private.asset_upload_intents enable row level security;
revoke all on app_private.asset_upload_intents from public, anon, authenticated;
grant select on app_private.asset_upload_intents to authenticated;
grant select, insert, update, delete on app_private.asset_upload_intents to service_role;
create policy asset_upload_intents_owner_read on app_private.asset_upload_intents
for select to authenticated using (owner_id = (select auth.uid()));

create function app_private.validate_asset_upload_intent()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if not exists (select 1 from public.projects where id = new.project_id and owner_id = new.owner_id)
    or exists (select 1 from public.assets where id = new.asset_id)
    or new.finalized_at is not null then
    raise exception using errcode = '23514', message = 'Invalid upload intent identity';
  end if;
  return new;
end;
$$;
create trigger asset_upload_intents_validate before insert on app_private.asset_upload_intents
for each row execute function app_private.validate_asset_upload_intent();
create trigger asset_upload_intents_immutable before update on app_private.asset_upload_intents
for each row execute function public.enforce_ownership_immutability('asset_id','owner_id','project_id','product_id','storage_path','created_at','expires_at');
revoke all on function app_private.validate_asset_upload_intent() from public, anon, authenticated, service_role;

-- Scope comes from actual Product -> Project ownership, not Storage owner metadata.
-- A strict shape check precedes UUID conversion, so malformed input is a denial.
create function app_private.owns_asset_object(object_name text)
returns boolean language plpgsql stable security invoker set search_path = '' as $$
begin
  if object_name is null or object_name !~
    '^projects/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/products/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$' then
    return false;
  end if;
  return exists (select 1 from public.products p join public.projects root on root.id = p.project_id
    where p.id = split_part(object_name,'/',4)::uuid and root.id = split_part(object_name,'/',2)::uuid
      and root.owner_id = (select auth.uid()));
end;
$$;
revoke all on function app_private.owns_asset_object(text) from public, anon, authenticated, service_role;
grant execute on function app_private.owns_asset_object(text) to authenticated;

-- Asset finalization consumes the approval in the same DB transaction as INSERT.
-- This is a trigger-only narrow write, never an invocable privileged RPC. It
-- cannot issue intents, change owners, or access Storage bytes. Old admin uploads
-- with no intent keep their existing Storage-first workflow.
create function app_private.finalize_asset_upload_intent()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  intent app_private.asset_upload_intents%rowtype;
begin
  select * into intent from app_private.asset_upload_intents where asset_id = new.id for update;
  if found then
    if intent.storage_path <> new.storage_path or intent.project_id <> new.project_id
      or intent.product_id <> new.product_id or intent.finalized_at is not null
      or not exists (select 1 from public.projects where id = new.project_id and owner_id = intent.owner_id) then
      raise exception using errcode = '23514', message = 'Asset upload intent mismatch';
    end if;
    update app_private.asset_upload_intents set finalized_at = now() where asset_id = new.id;
  end if;
  return new;
end;
$$;
revoke all on function app_private.finalize_asset_upload_intent() from public, anon, authenticated, service_role;
create trigger assets_finalize_upload_intent after insert on public.assets
for each row execute function app_private.finalize_asset_upload_intent();

-- Standard upload only. No signed-upload bearer, copy, S3 or TUS grants.
create policy product_assets_owner_select on storage.objects
for select to authenticated using (
  bucket_id = 'product-assets' and app_private.owns_asset_object(name)
);
create policy product_assets_approved_insert on storage.objects
for insert to authenticated with check (
  bucket_id = 'product-assets' and app_private.owns_asset_object(name)
  and storage.allow_only_operation('object.upload')
  and exists (select 1 from app_private.asset_upload_intents i
    where i.storage_path = objects.name and i.owner_id = (select auth.uid())
      and i.expires_at > now() and i.finalized_at is null)
);
create policy product_assets_no_update on storage.objects
for update to authenticated using (false) with check (false);
-- Asset INSERT may have failed: delete must not require that row to exist.
create policy product_assets_owner_delete on storage.objects
for delete to authenticated using (
  bucket_id = 'product-assets' and app_private.owns_asset_object(name)
);
-- Even a future permissive bucket policy must not expose/reconfigure this bucket.
create policy product_assets_bucket_managed on storage.buckets as restrictive
for all to public using (id <> 'product-assets') with check (id <> 'product-assets');

-- RLS cannot protect TRUNCATE. Preserve managed table ownership and CRUD grants,
-- but remove non-CRUD capabilities unused by all Storage HTTP operations.
revoke truncate, references, trigger on storage.objects, storage.buckets from public, anon, authenticated;
commit;
