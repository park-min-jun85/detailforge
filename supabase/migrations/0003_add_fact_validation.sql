alter table public.product_facts
  add column validation jsonb not null default '{}'::jsonb
    constraint product_facts_validation_object check (jsonb_typeof(validation) = 'object');
