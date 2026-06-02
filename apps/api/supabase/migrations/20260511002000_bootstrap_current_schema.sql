create extension if not exists pgcrypto;

do $$
begin
  create type public.product_kind as enum ('sealed', 'single');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.product_language as enum ('japanese', 'spanish', 'english');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.user_role as enum ('admin', 'customer');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.delivery_mode as enum ('retiro', 'envio');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.discount_type as enum ('percent', 'fixed');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.order_status as enum ('pending', 'paid', 'preparing', 'shipped', 'completed', 'cancelled');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.payment_provider as enum ('mercado_pago');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.payment_status as enum ('created', 'pending', 'approved', 'rejected', 'cancelled', 'refunded');
exception
  when duplicate_object then null;
end $$;

create table if not exists public.products (
  id text primary key,
  kind public.product_kind not null,
  name text not null,
  category text not null,
  "set" text not null,
  language public.product_language not null,
  stock integer not null default 0 check (stock >= 0),
  variants jsonb,
  price numeric(10, 2) not null check (price >= 0),
  previous_price numeric(10, 2) check (previous_price is null or previous_price >= 0),
  image text not null,
  offer text,
  active boolean not null default true,
  illustrator text,
  rarity text,
  playability text,
  market_price numeric(10, 2) check (market_price is null or market_price >= 0),
  manual_segment text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.app_users (
  id uuid primary key default gen_random_uuid(),
  username text not null,
  password_hash text not null,
  role public.user_role not null default 'customer',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.app_users(id) on delete set null,
  customer_name text not null,
  customer_email text not null,
  customer_phone text,
  delivery_mode public.delivery_mode not null,
  address text,
  subtotal numeric(10, 2) not null check (subtotal >= 0),
  shipping numeric(10, 2) not null check (shipping >= 0),
  discount numeric(10, 2) not null default 0 check (discount >= 0),
  discount_code text,
  total numeric(10, 2) not null check (total >= 0),
  status public.order_status not null default 'pending',
  metadata jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.discount_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  type public.discount_type not null,
  value numeric(10, 2) not null check (value > 0),
  active boolean not null default true,
  starts_at timestamptz,
  expires_at timestamptz,
  max_uses integer check (max_uses is null or max_uses > 0),
  used_count integer not null default 0 check (used_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id text references public.products(id) on delete set null,
  variant_id text,
  variant_name text,
  name text not null,
  quantity integer not null check (quantity > 0),
  unit_price numeric(10, 2) not null check (unit_price >= 0),
  subtotal numeric(10, 2) not null check (subtotal >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  provider public.payment_provider not null,
  status public.payment_status not null default 'created',
  amount numeric(10, 2) not null check (amount >= 0),
  currency text not null,
  provider_preference_id text,
  provider_payment_id text,
  checkout_url text,
  metadata jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.site_settings (
  key text primary key,
  value jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists app_users_username_unique on public.app_users(username);
create index if not exists products_kind_idx on public.products(kind);
create index if not exists products_category_idx on public.products(category);
create index if not exists products_active_idx on public.products(active);
create index if not exists orders_user_id_idx on public.orders(user_id);
create index if not exists orders_status_idx on public.orders(status);
create index if not exists orders_created_at_idx on public.orders(created_at);
create unique index if not exists discount_codes_code_unique on public.discount_codes(code);
create index if not exists discount_codes_active_idx on public.discount_codes(active);
create index if not exists order_items_order_id_idx on public.order_items(order_id);
create index if not exists order_items_product_id_idx on public.order_items(product_id);
create index if not exists payments_order_id_idx on public.payments(order_id);
create index if not exists payments_provider_payment_id_idx on public.payments(provider_payment_id);
create index if not exists payments_status_idx on public.payments(status);

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists products_set_updated_at on public.products;
create trigger products_set_updated_at
before update on public.products
for each row execute function public.set_updated_at();

drop trigger if exists app_users_set_updated_at on public.app_users;
create trigger app_users_set_updated_at
before update on public.app_users
for each row execute function public.set_updated_at();

drop trigger if exists orders_set_updated_at on public.orders;
create trigger orders_set_updated_at
before update on public.orders
for each row execute function public.set_updated_at();

drop trigger if exists discount_codes_set_updated_at on public.discount_codes;
create trigger discount_codes_set_updated_at
before update on public.discount_codes
for each row execute function public.set_updated_at();

drop trigger if exists payments_set_updated_at on public.payments;
create trigger payments_set_updated_at
before update on public.payments
for each row execute function public.set_updated_at();

drop trigger if exists site_settings_set_updated_at on public.site_settings;
create trigger site_settings_set_updated_at
before update on public.site_settings
for each row execute function public.set_updated_at();

insert into public.site_settings (key, value)
values (
  'hero',
  '{
    "primaryBadge": "Set destacado",
    "secondaryBadge": "Catalogo",
    "title": "Productos disponibles",
    "description": "Disponible en OnlyCartitas. ETB, blisters, bundles y singles del set para reservar antes de que cambie el stock.",
    "launchSetName": "Journey Together",
    "launchTitle": "Catalogo OnlyCartitas",
    "launchLabel": "Nuevo",
    "primaryCtaLabel": "Ver lanzamiento",
    "primaryCtaHref": "/sellados",
    "secondaryCtaLabel": "Ver ofertas",
    "secondaryCtaHref": "/ofertas",
    "backgroundImageUrl": ""
  }'::jsonb
)
on conflict (key) do nothing;
