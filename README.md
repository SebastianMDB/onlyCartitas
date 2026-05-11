# OnlyCartitas

Monorepo para el frontend Astro y el backend API.

## Estructura

- `apps/web`: frontend Astro, pensado para Vercel.
- `apps/api`: backend Node.js + Fastify + TypeScript, pensado para Render Free.

## Desarrollo local

```bash
npm install
npm run dev:web
npm run dev:api
```

El frontend corre en `http://localhost:4321` y el API en `http://localhost:3000`.

## Variables

Copia los ejemplos:

```bash
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
```

Frontend local (`apps/web/.env`):

```env
PUBLIC_SITE_URL=http://localhost:4321
PUBLIC_API_URL=http://localhost:3000
```

## Deploy

### Frontend en Vercel

- Root Directory: `apps/web`
- Build Command: `npm run build`
- Output Directory: `dist`
- Variable recomendada: `PUBLIC_API_URL=https://tu-api.onrender.com`

### Backend en Render Free

Render mantiene web services Node.js en plan gratis, con límites mensuales y suspensión por inactividad. Es la opción más apta aquí porque permite correr un servidor Fastify persistente sin adaptar el API a funciones serverless.

- Root Directory: `apps/api`
- Build Command: `npm install && npm run build`
- Start Command: `npm run start`
- Variables:
  - `NODE_ENV=production`
  - `DATABASE_URL=postgresql://...`
  - `API_SECRET=un-secreto-largo-y-aleatorio`
  - `WEB_ORIGIN=https://tu-front.vercel.app`
  - `SESSION_TTL_SECONDS=604800`
  - `AUTH_REGISTER_ENABLED=true`
  - `API_PUBLIC_URL=https://tu-api.onrender.com`
  - `MERCADO_PAGO_ACCESS_TOKEN=APP_USR-...`
  - `MERCADO_PAGO_CURRENCY_ID=CLP`
  - `MERCADO_PAGO_CHECKOUT_MODE=production`

## Mercado Pago

La integracion esta preparada para Checkout Pro sin guardar credenciales en el repo. Mientras `MERCADO_PAGO_ACCESS_TOKEN` este vacio, el checkout crea el pedido y deja el pago pendiente. Cuando agregues el access token, el backend creara una preferencia en Mercado Pago y redirigira al cliente.

Endpoints preparados:

- `POST /api/payments/mercadopago/preferences`: crea preferencia para un pedido.
- `POST /api/payments/mercadopago/webhook`: recibe notificaciones de pago.

Para produccion, configura en Mercado Pago el webhook hacia:

```text
https://tu-api.onrender.com/api/payments/mercadopago/webhook
```

Nota: el catalogo, checkout y Mercado Pago quedan configurados para operar en CLP.

## Seguridad para produccion

- Usa `NODE_ENV=production`; la API rechazara iniciar sin `DATABASE_URL` o con `API_SECRET` debil.
- `API_SECRET` debe ser aleatorio y de al menos 32 caracteres.
- `WEB_ORIGIN` debe ser el dominio exacto del frontend, nunca `*`.
- Si no quieres registro publico de clientes, configura `AUTH_REGISTER_ENABLED=false`.
- Los intentos de login y registro tienen rate limit en memoria por IP.
- El webhook de Mercado Pago valida que el pago corresponda a una orden existente, con monto y moneda correctos, antes de marcar el pedido como pagado.

Railway hoy funciona más como trial/créditos y luego plan de pago mínimo; por eso no lo dejé como primera opción gratuita.
