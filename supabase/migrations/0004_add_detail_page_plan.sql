alter table public.detail_pages
  add column plan jsonb not null default '{}'::jsonb
    constraint detail_pages_plan_object check (jsonb_typeof(plan) = 'object');
