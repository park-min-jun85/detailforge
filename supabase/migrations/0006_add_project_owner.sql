-- Stage A only. Existing rows remain NULL until the explicit offline backfill.
-- No default owner, user grants, policies, or automatic first-user claim.
alter table public.projects
  add column owner_id uuid
    constraint projects_owner_id_fkey references auth.users(id) on delete restrict;

create index projects_owner_id_idx on public.projects(owner_id);

comment on column public.projects.owner_id is
  'Project root owner. NULL is internal migration state only; public rollout requires backfill, NOT NULL and RLS.';
