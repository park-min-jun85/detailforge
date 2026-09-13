alter table public.products
  add column ai_analysis jsonb not null default '{}'::jsonb
    constraint products_ai_analysis_object check (jsonb_typeof(ai_analysis) = 'object');
