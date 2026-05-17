create table if not exists public.site_settings (
  key text primary key,
  value jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

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
