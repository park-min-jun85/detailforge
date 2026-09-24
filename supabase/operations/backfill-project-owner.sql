-- psql only; invoked by scripts/backfill-project-owner.mjs, never web startup.
\set ON_ERROR_STOP on
\set VERBOSITY terse
\if :{?apply}
\else
  \set apply false
\endif
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';
-- Freeze Project writes between coverage validation and UPDATE. Maintenance required.
lock table public.projects in share row exclusive mode;
lock table public.products, public.assets in share mode;
create temporary table task057_input on commit drop as
select :'bootstrap_user_id'::uuid as owner_id, :'project_ids'::jsonb as project_ids, :'apply'::boolean as apply;
create temporary table task057_counts (updated bigint not null) on commit drop;
insert into task057_counts values (0);
do $$
declare
  target uuid;
  ids uuid[];
  manifest jsonb;
  should_apply boolean;
  changed bigint;
begin
  select owner_id, project_ids, apply into target, manifest, should_apply from task057_input;
  if jsonb_typeof(manifest) is distinct from 'array' then
    raise exception 'Invalid project allowlist';
  end if;
  if exists (select 1 from jsonb_array_elements(manifest) x where jsonb_typeof(x) <> 'string') then
    raise exception 'Invalid project allowlist';
  end if;
  select coalesce(array_agg(value::uuid), array[]::uuid[]) into ids from jsonb_array_elements_text(manifest);
  if cardinality(ids) <> (select count(distinct id) from unnest(ids) id) then
    raise exception 'Duplicate project allowlist entry';
  end if;
  perform id from auth.users where id = target for key share;
  if not found then raise exception 'Bootstrap auth user not found'; end if;
  if exists (select 1 from unnest(ids) as wanted(id) left join public.projects p on p.id = wanted.id where p.id is null) then
    raise exception 'Unknown project allowlist entry';
  end if;
  if exists (select 1 from public.projects where id = any(ids) and owner_id is not null and owner_id <> target) then
    raise exception 'Existing ownership conflicts with allowlist';
  end if;
  if exists (select 1 from public.projects where owner_id is null and not (id = any(ids))) then
    raise exception 'Unowned projects missing from allowlist';
  end if;
  if exists (select 1 from public.assets a join public.products p on p.id = a.product_id where a.project_id <> p.project_id) then
    raise exception 'Asset ownership chain mismatch';
  end if;
  if exists (select 1 from public.assets group by storage_path having count(*) > 1) then
    raise exception 'Duplicate Storage path';
  end if;
  if exists (select 1 from public.assets a where a.storage_path !~
    ('^projects/' || a.project_id || '/products/' || a.product_id || '/' || a.id || '\.(jpg|png|webp)$')) then
    raise exception 'Storage path relationship mismatch';
  end if;
  if should_apply then
    update public.projects set owner_id = target where owner_id is null and id = any(ids);
    get diagnostics changed = row_count;
    update task057_counts set updated = changed;
  end if;
end;
$$;
select json_build_object(
  'applied', (select apply from task057_input),
  'updated', (select updated from task057_counts),
  'totalProjects', count(*),
  'ownedProjects', count(owner_id),
  'nullOwnerProjects', count(*) filter (where owner_id is null),
  'distinctOwners', count(distinct owner_id),
  'eligibleProjects', count(*) filter (where owner_id is null and id in
    (select value::uuid from jsonb_array_elements_text((select project_ids from task057_input)))))
from public.projects;
commit;
