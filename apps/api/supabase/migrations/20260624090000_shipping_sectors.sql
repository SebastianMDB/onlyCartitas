create table if not exists public.shipping_sectors (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  price numeric(10, 2) not null check (price >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists shipping_sectors_name_unique
  on public.shipping_sectors (name);

create index if not exists shipping_sectors_active_idx
  on public.shipping_sectors (active);
