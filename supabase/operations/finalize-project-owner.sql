-- Stage C, NOT in automatic migrations: old internal create must stop first.
-- TASK-058 will repeat SET NOT NULL in its migration and enforce DB immutability/RLS.
\set ON_ERROR_STOP on
\set VERBOSITY terse
\if :{?apply}
\else
  \set apply false
\endif
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';
lock table public.projects in access exclusive mode;
lock table public.products, public.assets in share mode;
do $$
begin
  if exists (select 1 from public.projects where owner_id is null) then
    raise exception 'Ownership backfill incomplete';
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
end;
$$;
\if :apply
  alter table public.projects alter column owner_id set not null;
\endif
select json_build_object('nullOwnerProjects', count(*) filter (where owner_id is null),
  'notNull', (select attnotnull from pg_attribute where attrelid = 'public.projects'::regclass and attname = 'owner_id'))
from public.projects;
commit;
