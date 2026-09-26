-- TASK-060. No limits row is provisioned by migration: paid/upload admission
-- stays closed until an operator explicitly configures finite internal limits.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';
lock table public.projects in share row exclusive mode;
lock table storage.objects in share row exclusive mode;
-- Keep namespace ownership after Project DELETE. Otherwise another account
-- could recreate the known Project/Product UUIDs and read orphaned objects.
create table app_private.project_namespace_owners (
  project_id uuid primary key,
  owner_id uuid,
  created_at timestamptz not null default clock_timestamp()
);
alter table app_private.project_namespace_owners enable row level security;
revoke all on app_private.project_namespace_owners from public,anon,authenticated,service_role;
insert into app_private.project_namespace_owners(project_id,owner_id) select id,owner_id from public.projects;
-- Unknown owners of pre-existing orphans are quarantined, never guessed.
insert into app_private.project_namespace_owners(project_id,owner_id)
select distinct split_part(name,'/',2)::uuid,null::uuid from storage.objects
where bucket_id='product-assets' and name ~ '^projects/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/'
on conflict(project_id) do nothing;
create function app_private.preserve_project_namespace() returns trigger
language plpgsql security definer set search_path='' as $$
declare original_owner uuid;
begin
  insert into app_private.project_namespace_owners(project_id,owner_id) values(new.id,new.owner_id)
    on conflict(project_id) do nothing;
  select owner_id into original_owner from app_private.project_namespace_owners where project_id=new.id;
  if original_owner is null or original_owner is distinct from new.owner_id then
    raise exception using errcode='42501',message='Project namespace unavailable';
  end if;
  return new;
end;
$$;
revoke all on function app_private.preserve_project_namespace() from public,anon,authenticated,service_role;
create trigger projects_preserve_namespace before insert on public.projects
for each row execute function app_private.preserve_project_namespace();
create table app_private.admission_limits (
  singleton boolean primary key default true check (singleton),
  upload_user_slots integer not null check (upload_user_slots between 1 and 1000),
  upload_global_slots integer not null check (upload_global_slots between 1 and 10000),
  user_bytes bigint not null check (user_bytes between 10485760 and 1099511627776),
  global_bytes bigint not null check (global_bytes between 10485760 and 10995116277760),
  uploads_per_hour integer not null check (uploads_per_hour between 1 and 10000),
  ai_user_concurrency integer not null check (ai_user_concurrency between 1 and 10),
  ai_global_concurrency integer not null check (ai_global_concurrency between 1 and 100),
  ai_user_hour integer not null check (ai_user_hour between 1 and 10000),
  ai_global_hour integer not null check (ai_global_hour between 1 and 100000),
  ai_user_day integer not null check (ai_user_day between 1 and 100000),
  ai_global_day integer not null check (ai_global_day between 1 and 1000000)
);
create table app_private.admissions (
  id uuid primary key default gen_random_uuid(),
  actor uuid not null references auth.users(id) on delete restrict,
  project_id uuid not null,
  product_id uuid,
  operation text not null check (operation in ('upload','asset-analysis','product-analysis','fact-validation','page-planner','section-engine','section-regeneration','extraction','extraction-retry')),
  request_key text not null check (request_key ~ '^[a-f0-9]{64}$'),
  fingerprint text not null check (fingerprint ~ '^[a-f0-9]{64}$'),
  asset_id uuid unique,
  storage_path text unique,
  reserved_bytes bigint not null default 0 check (reserved_bytes in (0,10485760)),
  upload_written boolean not null default false,
  state text not null default 'reserved' check (state in ('reserved','consumed','released','uncertain','expired')),
  created_at timestamptz not null default clock_timestamp(),
  expires_at timestamptz not null default clock_timestamp() + interval '15 minutes',
  unique(actor,operation,request_key),
  check ((operation = 'upload' and asset_id is not null and product_id is not null and storage_path is not null and reserved_bytes = 10485760)
    or (operation <> 'upload' and asset_id is null and storage_path is null and reserved_bytes = 0))
);
create index admissions_actor_time on app_private.admissions(actor,created_at);
create index admissions_active on app_private.admissions(operation,state,expires_at);
alter table app_private.admission_limits enable row level security;
alter table app_private.admissions enable row level security;
revoke all on app_private.admission_limits, app_private.admissions from public,anon,authenticated,service_role;

-- One actual Storage INSERT per new admission, including delete/re-upload.
-- Storage's permission probe rolls its transaction back, so only the committed
-- INSERT spends this bit. Existing TASK-059 intents without a ledger row keep
-- their contract; only the new trusted issuer can create ledger-backed intents.
create function app_private.consume_storage_admission() returns trigger
language plpgsql security definer set search_path='' as $$
declare ticket app_private.admissions%rowtype;
begin
  if new.bucket_id<>'product-assets' then return new; end if;
  select * into ticket from app_private.admissions where storage_path=new.name for update;
  if found then
    if ticket.upload_written or ticket.state<>'reserved' or ticket.expires_at<=clock_timestamp() then
      raise exception using errcode='42501',message='Upload admission unavailable';
    end if;
    update app_private.admissions set upload_written=true where id=ticket.id;
  end if;
  return new;
end;
$$;
revoke all on function app_private.consume_storage_admission() from public,anon,authenticated,service_role;
create trigger product_assets_consume_admission before insert on storage.objects
for each row execute function app_private.consume_storage_admission();

-- This API is service-role-only, called solely after the server has verified a
-- user JWT and scoped the resource using that user's RLS client. No generic SQL.
create function public.reserve_admission(p_actor uuid,p_project uuid,p_product uuid,p_operation text,
  p_key text,p_fingerprint text,p_asset uuid default null,p_mime text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  lim app_private.admission_limits%rowtype;
  prior app_private.admissions%rowtype;
  ticket app_private.admissions%rowtype;
  path text;
  user_count bigint; global_count bigint; user_size bigint; global_size bigint;
begin
  -- A single DB row serializes every admission, including user/global limits.
  select * into lim from app_private.admission_limits where singleton for update;
  if not found then raise exception using errcode='P0001',message='Admission unavailable'; end if;
  if not exists(select 1 from public.projects where id=p_project and owner_id=p_actor)
    or (p_product is not null and not exists(select 1 from public.products where id=p_product and project_id=p_project)) then
    raise exception using errcode='42501',message='Resource unavailable';
  end if;
  select * into prior from app_private.admissions where actor=p_actor and operation=p_operation and request_key=p_key;
  if found then
    -- No replay is a new dispatch. Callers recover their persisted application
    -- result; even uncertain/expired work must never be dispatched twice.
    raise exception using errcode='23505',message='Admission already used';
  end if;
  if p_operation='upload' then
    if p_asset is null or p_product is null or p_mime not in ('image/jpeg','image/png','image/webp') then
      raise exception using errcode='22023',message='Invalid upload';
    end if;
    path := 'projects/'||p_project||'/products/'||p_product||'/'||p_asset||
      case p_mime when 'image/jpeg' then '.jpg' when 'image/png' then '.png' when 'image/webp' then '.webp' end;
    -- Reclaim abandoned capacity on demand; a disconnected caller must not
    -- depend on a later settle or an external maintenance scheduler.
    perform public.expire_admissions();
    -- Active concurrency and retained footprint are different budgets. Expired
    -- approvals cannot upload again, even when their bytes remain charged.
    select count(*) filter(where i.owner_id=p_actor),count(*) into user_count,global_count
      from app_private.asset_upload_intents i
      left join app_private.admissions a on a.asset_id=i.asset_id
      where i.finalized_at is null and i.expires_at>clock_timestamp()
        and (a.id is null or (a.state='reserved' and a.expires_at>clock_timestamp()));
    if user_count>=lim.upload_user_slots or global_count>=lim.upload_global_slots
      or (select count(*) from app_private.admissions where actor=p_actor and operation='upload' and created_at>clock_timestamp()-interval '1 hour')>=lim.uploads_per_hour then
      raise exception using errcode='P0002',message='Admission limit';
    end if;
    -- Count actual objects (including legacy/orphans), union pending paths once.
    -- Every path is charged the bucket maximum, even a tiny or malformed object.
    with paths as (
      select o.name as path,root.owner_id as actor from storage.objects o
        left join app_private.project_namespace_owners root on split_part(o.name,'/',2)=root.project_id::text where o.bucket_id='product-assets'
      union select storage_path,actor from app_private.admissions where operation='upload' and state in ('reserved','uncertain','expired')
      union select storage_path,owner_id from app_private.asset_upload_intents where finalized_at is null
    ) select count(*) filter(where actor=p_actor)*10485760,count(*)*10485760 into user_size,global_size from paths;
    if user_size+10485760>lim.user_bytes or global_size+10485760>lim.global_bytes then
      raise exception using errcode='P0002',message='Admission limit';
    end if;
    if (select count(*) from (
      select name from storage.objects where bucket_id='product-assets' and name like 'projects/'||p_project||'/products/'||p_product||'/%'
      union select storage_path from app_private.admissions where product_id=p_product and operation='upload' and state in ('reserved','uncertain','expired')
      union select storage_path from app_private.asset_upload_intents where product_id=p_product and finalized_at is null
      union select storage_path from public.assets where product_id=p_product
    ) as slots)>=30 then raise exception using errcode='P0002',message='Admission limit'; end if;
    insert into app_private.asset_upload_intents(asset_id,owner_id,project_id,product_id,storage_path,expires_at)
      values(p_asset,p_actor,p_project,p_product,path,clock_timestamp()+interval '10 minutes');
  else
    if p_asset is not null or p_mime is not null then raise exception using errcode='22023',message='Invalid admission'; end if;
    -- Failed/timed-out dispatches stay charged in hourly/daily budgets. Their
    -- concurrency lease outlives every bounded provider request (<= 60 seconds).
    select count(*) filter(where actor=p_actor),count(*) into user_count,global_count from app_private.admissions
      where operation<>'upload' and state in ('reserved','uncertain') and expires_at>clock_timestamp();
    if user_count>=lim.ai_user_concurrency or global_count>=lim.ai_global_concurrency
      or (select count(*) from app_private.admissions where actor=p_actor and operation<>'upload' and created_at>clock_timestamp()-interval '1 hour')>=lim.ai_user_hour
      or (select count(*) from app_private.admissions where operation<>'upload' and created_at>clock_timestamp()-interval '1 hour')>=lim.ai_global_hour
      or (select count(*) from app_private.admissions where actor=p_actor and operation<>'upload' and created_at>clock_timestamp()-interval '1 day')>=lim.ai_user_day
      or (select count(*) from app_private.admissions where operation<>'upload' and created_at>clock_timestamp()-interval '1 day')>=lim.ai_global_day then
      raise exception using errcode='P0002',message='Admission limit';
    end if;
  end if;
  insert into app_private.admissions(actor,project_id,product_id,operation,request_key,fingerprint,asset_id,storage_path,reserved_bytes,expires_at)
    values(p_actor,p_project,p_product,p_operation,p_key,p_fingerprint,p_asset,path,case when p_operation='upload' then 10485760 else 0 end,
      clock_timestamp()+interval '10 minutes') returning * into ticket;
  return jsonb_build_object('id',ticket.id,'assetId',ticket.asset_id,'path',ticket.storage_path,'expiresAt',ticket.expires_at);
end;
$$;

create function public.settle_admission(p_actor uuid,p_id uuid,p_outcome text)
returns void language plpgsql security definer set search_path = '' as $$
declare ticket app_private.admissions%rowtype;
begin
  perform 1 from app_private.admission_limits where singleton for update;
  if p_outcome='released' then
    -- Same lock order as expiry: table writes before admission/intent row locks.
    -- Fresh READ COMMITTED snapshots are required after a waiting table lock.
    if current_setting('transaction_isolation')<>'read committed' then
      raise exception using errcode='25001',message='Release requires read committed';
    end if;
    lock table storage.objects in share row exclusive mode;
    lock table public.assets in share row exclusive mode;
  end if;
  select * into ticket from app_private.admissions where id=p_id and actor=p_actor for update;
  if not found then raise exception using errcode='42501',message='Admission unavailable'; end if;
  if ticket.state in ('consumed','released') then return; end if;
  if p_outcome not in ('consumed','released','uncertain') then raise exception using errcode='22023',message='Invalid outcome'; end if;
  if ticket.operation='upload' then
    if p_outcome='consumed' then
      if ticket.expires_at<=clock_timestamp() or not exists(select 1 from public.assets a
        join app_private.asset_upload_intents i on i.asset_id=a.id where a.id=ticket.asset_id and a.storage_path=ticket.storage_path
        and i.finalized_at is not null) then raise exception using errcode='P0001',message='Upload not finalized'; end if;
    elsif p_outcome='released' then
      if exists(select 1 from storage.objects where bucket_id='product-assets' and name=ticket.storage_path)
        or exists(select 1 from public.assets where id=ticket.asset_id or storage_path=ticket.storage_path) then raise exception using errcode='P0001',message='Upload outcome uncertain'; end if;
      delete from app_private.asset_upload_intents where asset_id=ticket.asset_id and finalized_at is null;
    end if;
  elsif p_outcome='released' then
    -- Provider dispatch outcome cannot safely refund money/rate budgets.
    p_outcome := 'uncertain';
  elsif p_outcome='consumed' and ticket.expires_at<=clock_timestamp() then
    raise exception using errcode='P0001',message='Admission expired';
  end if;
  update app_private.admissions set state=p_outcome where id=ticket.id;
end;
$$;

-- Reclaim only proven-empty expired uploads. Retain replay/rate history and
-- never delete objects/assets or refund an existing/uncertain footprint.
create function public.expire_admissions() returns bigint language plpgsql security definer
set search_path='' set lock_timeout='5s' as $$
declare affected bigint:=0; changed bigint; ticket app_private.admissions%rowtype;
begin
  if current_setting('transaction_isolation')<>'read committed' then
    raise exception using errcode='25001',message='Expiry requires read committed';
  end if;
  perform 1 from app_private.admission_limits where singleton for update;
  if exists(select 1 from app_private.admissions where operation='upload'
    and state in ('reserved','uncertain','expired') and expires_at<=clock_timestamp()) then
    -- Storage INSERT already holds RowExclusiveLock before its admission row
    -- trigger. Take this conflicting table lock FIRST to avoid a lock inversion.
    -- Also serialize Asset finalization, then read fresh committed snapshots.
    lock table storage.objects in share row exclusive mode;
    lock table public.assets in share row exclusive mode;
    for ticket in select * from app_private.admissions where operation='upload'
      and state in ('reserved','uncertain','expired') and expires_at<=clock_timestamp()
      order by id for update loop
      if not exists(select 1 from storage.objects where bucket_id='product-assets' and name=ticket.storage_path)
        and not exists(select 1 from public.assets where id=ticket.asset_id or storage_path=ticket.storage_path) then
        delete from app_private.asset_upload_intents where asset_id=ticket.asset_id and finalized_at is null;
        update app_private.admissions set state='released' where id=ticket.id;
        affected:=affected+1;
      elsif ticket.state<>'expired' then
        update app_private.admissions set state='expired' where id=ticket.id;
        affected:=affected+1;
      end if;
    end loop;
  end if;
  -- AI expiration ends a concurrency lease, never its windowed cost charge.
  update app_private.admissions set state='expired' where operation<>'upload'
    and state in ('reserved','uncertain') and expires_at<=clock_timestamp();
  get diagnostics changed=row_count;
  affected:=affected+changed;
  return affected;
end;
$$;
revoke all on function public.reserve_admission(uuid,uuid,uuid,text,text,text,uuid,text),
  public.settle_admission(uuid,uuid,text),public.expire_admissions() from public,anon,authenticated;
grant execute on function public.reserve_admission(uuid,uuid,uuid,text,text,text,uuid,text),
  public.settle_admission(uuid,uuid,text),public.expire_admissions() to service_role;
commit;
