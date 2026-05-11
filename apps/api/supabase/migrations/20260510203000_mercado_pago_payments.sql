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

create index if not exists payments_order_id_idx on public.payments(order_id);
create index if not exists payments_provider_payment_id_idx on public.payments(provider_payment_id);
create index if not exists payments_status_idx on public.payments(status);

drop trigger if exists payments_set_updated_at on public.payments;
create trigger payments_set_updated_at
before update on public.payments
for each row execute function public.set_updated_at();
