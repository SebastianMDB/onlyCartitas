alter table public.products
  add column if not exists variants jsonb;

alter table public.order_items
  add column if not exists variant_id text,
  add column if not exists variant_name text;
