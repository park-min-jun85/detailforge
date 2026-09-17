create table public.product_options (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null unique references public.products(id) on delete cascade,
  groups jsonb not null default '{"schemaVersion":1,"groups":[]}'::jsonb
    constraint product_options_groups_object check (jsonb_typeof(groups) = 'object'),
  source_snapshot jsonb not null default '{}'::jsonb
    constraint product_options_source_snapshot_object check (jsonb_typeof(source_snapshot) = 'object'),
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger product_options_set_updated_at
before update on public.product_options
for each row execute function public.set_updated_at();

alter table public.product_options enable row level security;
revoke all privileges on table public.product_options from anon, authenticated;
grant all privileges on table public.product_options to service_role;
