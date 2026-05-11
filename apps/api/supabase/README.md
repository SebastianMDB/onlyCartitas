# Supabase migrations

## Aplicar migraciones

Desde `apps/api`, con Supabase CLI instalado y proyecto linkeado:

```powershell
supabase login
supabase link --project-ref TU_PROJECT_REF
supabase db push
```

Si no estas usando Supabase CLI, copia el contenido de:

```text
supabase/migrations/20260509010305_initial_schema.sql
```

y ejecutalo en Supabase Dashboard > SQL Editor.

## Tablas creadas

- `products`
- `app_users`
- `orders`
- `order_items`

Despues de aplicar la migracion, revisa Supabase Dashboard > Table Editor.
