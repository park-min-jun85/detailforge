-- TASK-058. Apply only after the explicit TASK-057 ownership backfill.
-- Fresh databases need no bootstrap identity. Existing invalid data fails closed.
-- One transaction: validation failure must never leave CRUD grants partly open.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';
lock table public.projects, public.products, public.product_facts, public.assets,
  public.detail_pages, public.sections, public.product_options in access exclusive mode;

do $$
begin
  if exists (select 1 from public.projects where owner_id is null) then
    raise exception 'Ownership backfill incomplete';
  end if;
  if exists (select 1 from public.assets a join public.products p on p.id = a.product_id
    where a.project_id <> p.project_id) then
    raise exception 'Asset ownership chain mismatch';
  end if;
  if exists (select 1 from public.assets group by storage_path having count(*) > 1) then
    raise exception 'Duplicate Storage path';
  end if;
  if exists (select 1 from public.assets a where a.storage_path !~
    ('^projects/' || a.project_id || '/products/' || a.product_id || '/' || a.id || '\.(jpg|png|webp)$')) then
    raise exception 'Storage path relationship mismatch';
  end if;
  -- Unexpected permissive policies could OR with the new rules. Never silently
  -- overwrite environment drift or pretend a repeated raw migration is a no-op.
  if exists (select 1 from pg_catalog.pg_policies where schemaname = 'public'
    and tablename in ('projects','products','product_facts','assets','detail_pages','sections','product_options')) then
    raise exception 'Unexpected existing user-data policies';
  end if;
end;
$$;

alter table public.projects alter column owner_id set not null;
comment on column public.projects.owner_id is
  'Immutable Project root owner. Required Auth user; user access is restricted by RLS.';

alter table public.products add constraint products_id_project_id_key unique (id, project_id);
-- Retain both existing single-column FKs for API relationship compatibility.
alter table public.assets add constraint assets_product_project_fkey
  foreign key (product_id, project_id) references public.products(id, project_id) on delete cascade;
alter table public.assets add constraint assets_storage_path_key unique (storage_path);
alter table public.assets add constraint assets_storage_path_relationship_check check (
  storage_path ~ ('^projects/' || project_id || '/products/' || product_id || '/' || id || '\.(jpg|png|webp)$')
);

-- Only compares OLD/NEW; no SQL lookup, dynamic SQL, identity trust, or bypass.
-- Trigger execution does not require callers to have direct EXECUTE permission.
create function public.enforce_ownership_immutability()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  field_name text;
begin
  foreach field_name in array tg_argv loop
    if (to_jsonb(old) -> field_name) is distinct from (to_jsonb(new) -> field_name) then
      raise exception using errcode = '23514', message = 'Ownership identity fields are immutable';
    end if;
  end loop;
  return new;
end;
$$;
revoke all on function public.enforce_ownership_immutability() from public, anon, authenticated, service_role;

create trigger projects_ownership_immutable
before update on public.projects
for each row execute function public.enforce_ownership_immutability('id', 'owner_id');

create trigger products_ownership_immutable
before update on public.products
for each row execute function public.enforce_ownership_immutability('id', 'project_id');

create trigger product_facts_ownership_immutable
before update on public.product_facts
for each row execute function public.enforce_ownership_immutability('id', 'product_id');

create trigger assets_ownership_immutable
before update on public.assets
for each row execute function public.enforce_ownership_immutability('id', 'project_id', 'product_id', 'storage_path');

create trigger detail_pages_ownership_immutable
before update on public.detail_pages
for each row execute function public.enforce_ownership_immutability('id', 'project_id');

create trigger sections_ownership_immutable
before update on public.sections
for each row execute function public.enforce_ownership_immutability('id', 'detail_page_id');

create trigger product_options_ownership_immutable
before update on public.product_options
for each row execute function public.enforce_ownership_immutability('id', 'product_id');

alter table public.projects enable row level security;
revoke all privileges on table public.projects from public, anon, authenticated;
grant select, insert, update, delete on table public.projects to authenticated;
-- Existing service_role privileges are intentionally retained for TASK-060.
create policy projects_owner_select on public.projects
for select to authenticated using (owner_id = (select auth.uid()));
create policy projects_owner_insert on public.projects
for insert to authenticated with check (owner_id = (select auth.uid()));
create policy projects_owner_update on public.projects
for update to authenticated using (owner_id = (select auth.uid()))
with check (owner_id = (select auth.uid()));
create policy projects_owner_delete on public.projects
for delete to authenticated using (owner_id = (select auth.uid()));

alter table public.products enable row level security;
revoke all privileges on table public.products from public, anon, authenticated;
grant select, insert, update, delete on table public.products to authenticated;
-- Existing service_role privileges are intentionally retained for TASK-060.
create policy products_owner_select on public.products
for select to authenticated using (exists (select 1 from public.projects p
    where p.id = products.project_id and p.owner_id = (select auth.uid())));
create policy products_owner_insert on public.products
for insert to authenticated with check (exists (select 1 from public.projects p
    where p.id = products.project_id and p.owner_id = (select auth.uid())));
create policy products_owner_update on public.products
for update to authenticated using (exists (select 1 from public.projects p
    where p.id = products.project_id and p.owner_id = (select auth.uid())))
with check (exists (select 1 from public.projects p
    where p.id = products.project_id and p.owner_id = (select auth.uid())));
create policy products_owner_delete on public.products
for delete to authenticated using (exists (select 1 from public.projects p
    where p.id = products.project_id and p.owner_id = (select auth.uid())));

alter table public.product_facts enable row level security;
revoke all privileges on table public.product_facts from public, anon, authenticated;
grant select, insert, update, delete on table public.product_facts to authenticated;
-- Existing service_role privileges are intentionally retained for TASK-060.
create policy product_facts_owner_select on public.product_facts
for select to authenticated using (exists (select 1 from public.products product join public.projects p on p.id = product.project_id
    where product.id = product_facts.product_id and p.owner_id = (select auth.uid())));
create policy product_facts_owner_insert on public.product_facts
for insert to authenticated with check (exists (select 1 from public.products product join public.projects p on p.id = product.project_id
    where product.id = product_facts.product_id and p.owner_id = (select auth.uid())));
create policy product_facts_owner_update on public.product_facts
for update to authenticated using (exists (select 1 from public.products product join public.projects p on p.id = product.project_id
    where product.id = product_facts.product_id and p.owner_id = (select auth.uid())))
with check (exists (select 1 from public.products product join public.projects p on p.id = product.project_id
    where product.id = product_facts.product_id and p.owner_id = (select auth.uid())));
create policy product_facts_owner_delete on public.product_facts
for delete to authenticated using (exists (select 1 from public.products product join public.projects p on p.id = product.project_id
    where product.id = product_facts.product_id and p.owner_id = (select auth.uid())));

alter table public.assets enable row level security;
revoke all privileges on table public.assets from public, anon, authenticated;
grant select, insert, update, delete on table public.assets to authenticated;
-- Existing service_role privileges are intentionally retained for TASK-060.
create policy assets_owner_select on public.assets
for select to authenticated using (exists (select 1 from public.products product join public.projects p on p.id = product.project_id
    where product.id = assets.product_id and product.project_id = assets.project_id
      and p.owner_id = (select auth.uid())));
create policy assets_owner_insert on public.assets
for insert to authenticated with check (exists (select 1 from public.products product join public.projects p on p.id = product.project_id
    where product.id = assets.product_id and product.project_id = assets.project_id
      and p.owner_id = (select auth.uid())));
create policy assets_owner_update on public.assets
for update to authenticated using (exists (select 1 from public.products product join public.projects p on p.id = product.project_id
    where product.id = assets.product_id and product.project_id = assets.project_id
      and p.owner_id = (select auth.uid())))
with check (exists (select 1 from public.products product join public.projects p on p.id = product.project_id
    where product.id = assets.product_id and product.project_id = assets.project_id
      and p.owner_id = (select auth.uid())));
create policy assets_owner_delete on public.assets
for delete to authenticated using (exists (select 1 from public.products product join public.projects p on p.id = product.project_id
    where product.id = assets.product_id and product.project_id = assets.project_id
      and p.owner_id = (select auth.uid())));

alter table public.detail_pages enable row level security;
revoke all privileges on table public.detail_pages from public, anon, authenticated;
grant select, insert, update, delete on table public.detail_pages to authenticated;
-- Existing service_role privileges are intentionally retained for TASK-060.
create policy detail_pages_owner_select on public.detail_pages
for select to authenticated using (exists (select 1 from public.projects p
    where p.id = detail_pages.project_id and p.owner_id = (select auth.uid())));
create policy detail_pages_owner_insert on public.detail_pages
for insert to authenticated with check (exists (select 1 from public.projects p
    where p.id = detail_pages.project_id and p.owner_id = (select auth.uid())));
create policy detail_pages_owner_update on public.detail_pages
for update to authenticated using (exists (select 1 from public.projects p
    where p.id = detail_pages.project_id and p.owner_id = (select auth.uid())))
with check (exists (select 1 from public.projects p
    where p.id = detail_pages.project_id and p.owner_id = (select auth.uid())));
create policy detail_pages_owner_delete on public.detail_pages
for delete to authenticated using (exists (select 1 from public.projects p
    where p.id = detail_pages.project_id and p.owner_id = (select auth.uid())));

alter table public.sections enable row level security;
revoke all privileges on table public.sections from public, anon, authenticated;
grant select, insert, update, delete on table public.sections to authenticated;
-- Existing service_role privileges are intentionally retained for TASK-060.
create policy sections_owner_select on public.sections
for select to authenticated using (exists (select 1 from public.detail_pages page join public.projects p on p.id = page.project_id
    where page.id = sections.detail_page_id and p.owner_id = (select auth.uid())));
create policy sections_owner_insert on public.sections
for insert to authenticated with check (exists (select 1 from public.detail_pages page join public.projects p on p.id = page.project_id
    where page.id = sections.detail_page_id and p.owner_id = (select auth.uid())));
create policy sections_owner_update on public.sections
for update to authenticated using (exists (select 1 from public.detail_pages page join public.projects p on p.id = page.project_id
    where page.id = sections.detail_page_id and p.owner_id = (select auth.uid())))
with check (exists (select 1 from public.detail_pages page join public.projects p on p.id = page.project_id
    where page.id = sections.detail_page_id and p.owner_id = (select auth.uid())));
create policy sections_owner_delete on public.sections
for delete to authenticated using (exists (select 1 from public.detail_pages page join public.projects p on p.id = page.project_id
    where page.id = sections.detail_page_id and p.owner_id = (select auth.uid())));

alter table public.product_options enable row level security;
revoke all privileges on table public.product_options from public, anon, authenticated;
grant select, insert, update, delete on table public.product_options to authenticated;
-- Existing service_role privileges are intentionally retained for TASK-060.
create policy product_options_owner_select on public.product_options
for select to authenticated using (exists (select 1 from public.products product join public.projects p on p.id = product.project_id
    where product.id = product_options.product_id and p.owner_id = (select auth.uid())));
create policy product_options_owner_insert on public.product_options
for insert to authenticated with check (exists (select 1 from public.products product join public.projects p on p.id = product.project_id
    where product.id = product_options.product_id and p.owner_id = (select auth.uid())));
create policy product_options_owner_update on public.product_options
for update to authenticated using (exists (select 1 from public.products product join public.projects p on p.id = product.project_id
    where product.id = product_options.product_id and p.owner_id = (select auth.uid())))
with check (exists (select 1 from public.products product join public.projects p on p.id = product.project_id
    where product.id = product_options.product_id and p.owner_id = (select auth.uid())));
create policy product_options_owner_delete on public.product_options
for delete to authenticated using (exists (select 1 from public.products product join public.projects p on p.id = product.project_id
    where product.id = product_options.product_id and p.owner_id = (select auth.uid())));

commit;
