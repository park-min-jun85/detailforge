create extension if not exists pgcrypto with schema extensions;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  status text not null default 'draft'
    check (status in ('draft', 'analyzing', 'generated', 'editing', 'completed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null unique references public.projects(id) on delete cascade,
  name text not null,
  brand text,
  category text,
  description text,
  source_type text not null default 'manual',
  source_url text,
  raw_data jsonb not null default '{}'::jsonb
    check (jsonb_typeof(raw_data) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.product_facts (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null unique references public.products(id) on delete cascade,
  facts jsonb not null default '{}'::jsonb
    check (jsonb_typeof(facts) = 'object'),
  source_snapshot jsonb not null default '{}'::jsonb
    check (jsonb_typeof(source_snapshot) = 'object'),
  version integer not null default 1 check (version > 0),
  validated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.assets (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  storage_path text not null,
  original_filename text not null,
  mime_type text,
  size_bytes bigint check (size_bytes is null or size_bytes >= 0),
  width integer check (width is null or width > 0),
  height integer check (height is null or height > 0),
  asset_type text not null default 'unclassified'
    check (asset_type in (
      'unclassified',
      'hero',
      'product',
      'detail',
      'usage',
      'specification',
      'option',
      'notice',
      'other'
    )),
  sort_order integer not null default 0 check (sort_order >= 0),
  metadata jsonb not null default '{}'::jsonb
    check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now()
);

create table public.detail_pages (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null unique references public.projects(id) on delete cascade,
  status text not null default 'draft'
    check (status in ('draft', 'generated', 'editing', 'completed')),
  width integer not null default 860 check (width > 0),
  theme_id text,
  settings jsonb not null default '{}'::jsonb
    check (jsonb_typeof(settings) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.sections (
  id uuid primary key default gen_random_uuid(),
  detail_page_id uuid not null references public.detail_pages(id) on delete cascade,
  type text not null
    check (type in (
      'hero',
      'keyBenefits',
      'feature',
      'imageText',
      'gallery',
      'useCase',
      'detail',
      'specification',
      'option',
      'notice'
    )),
  sort_order integer not null default 0 check (sort_order >= 0),
  content jsonb not null default '{}'::jsonb
    check (jsonb_typeof(content) = 'object'),
  style jsonb not null default '{}'::jsonb
    check (jsonb_typeof(style) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index assets_project_id_idx on public.assets(project_id);
create index assets_product_id_idx on public.assets(product_id);
create index sections_detail_page_id_sort_order_idx
  on public.sections(detail_page_id, sort_order);

create trigger projects_set_updated_at
before update on public.projects
for each row execute function public.set_updated_at();

create trigger products_set_updated_at
before update on public.products
for each row execute function public.set_updated_at();

create trigger product_facts_set_updated_at
before update on public.product_facts
for each row execute function public.set_updated_at();

create trigger detail_pages_set_updated_at
before update on public.detail_pages
for each row execute function public.set_updated_at();

create trigger sections_set_updated_at
before update on public.sections
for each row execute function public.set_updated_at();

alter table public.projects enable row level security;
alter table public.products enable row level security;
alter table public.product_facts enable row level security;
alter table public.assets enable row level security;
alter table public.detail_pages enable row level security;
alter table public.sections enable row level security;

revoke all privileges on table public.projects from anon, authenticated;
revoke all privileges on table public.products from anon, authenticated;
revoke all privileges on table public.product_facts from anon, authenticated;
revoke all privileges on table public.assets from anon, authenticated;
revoke all privileges on table public.detail_pages from anon, authenticated;
revoke all privileges on table public.sections from anon, authenticated;

grant all privileges on table public.projects to service_role;
grant all privileges on table public.products to service_role;
grant all privileges on table public.product_facts to service_role;
grant all privileges on table public.assets to service_role;
grant all privileges on table public.detail_pages to service_role;
grant all privileges on table public.sections to service_role;

revoke all on function public.set_updated_at() from public, anon, authenticated;
grant execute on function public.set_updated_at() to service_role;

insert into storage.buckets (id, name, public)
values ('product-assets', 'product-assets', false)
on conflict (id) do update set public = false;
