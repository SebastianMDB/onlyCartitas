do $$
begin
  create type public.discount_type as enum ('percent', 'fixed');
exception
  when duplicate_object then null;
end $$;

alter table public.orders
  add column if not exists discount numeric(10, 2) not null default 0 check (discount >= 0),
  add column if not exists discount_code text;

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

create unique index if not exists discount_codes_code_unique on public.discount_codes(code);
create index if not exists discount_codes_active_idx on public.discount_codes(active);

drop trigger if exists discount_codes_set_updated_at on public.discount_codes;
create trigger discount_codes_set_updated_at
before update on public.discount_codes
for each row execute function public.set_updated_at();
