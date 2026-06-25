import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "../env.js";
import * as schema from "./schema.js";

export const queryClient = postgres(env.DATABASE_URL, {
  max: 5,
  prepare: false
});

export const db = drizzle(queryClient, { schema });

export async function ensureRuntimeSchema() {
  await queryClient`
    alter table if exists public.products
      add column if not exists description text,
      add column if not exists variants jsonb,
      add column if not exists market_price numeric(10, 2),
      add column if not exists manual_segment text
  `;

  await queryClient`
    alter table if exists public.orders
      add column if not exists discount numeric(10, 2) not null default 0,
      add column if not exists discount_code text
  `;

  await queryClient`
    alter table if exists public.order_items
      add column if not exists variant_id text,
      add column if not exists variant_name text
  `;

  await queryClient`
    create table if not exists public.site_settings (
      key text primary key,
      value jsonb not null,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `;

  await queryClient`
    insert into public.site_settings (key, value)
    values (
      'catalog-options',
      '{"sets":[],"categories":[],"illustrators":[]}'::jsonb
    )
    on conflict (key) do nothing
  `;

  await queryClient`
    create table if not exists public.shipping_sectors (
      id uuid primary key default gen_random_uuid(),
      name text not null,
      price numeric(10, 2) not null check (price >= 0),
      active boolean not null default true,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `;

  await queryClient`
    create unique index if not exists shipping_sectors_name_unique
      on public.shipping_sectors (name)
  `;

  await queryClient`
    create index if not exists shipping_sectors_active_idx
      on public.shipping_sectors (active)
  `;
}
