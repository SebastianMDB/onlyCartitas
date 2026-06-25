import "dotenv/config";
import cors from "@fastify/cors";
import Fastify from "fastify";
import { ZodError } from "zod";
import { ensureRuntimeSchema, queryClient } from "./db/client.js";
import { env } from "./env.js";
import { ApiError } from "./http.js";
import { authRoutes } from "./routes/auth.js";
import { discountCodeRoutes } from "./routes/discount-codes.js";
import { orderRoutes } from "./routes/orders.js";
import { paymentRoutes } from "./routes/payments.js";
import { productRoutes } from "./routes/products.js";
import { shippingSectorRoutes } from "./routes/shipping-sectors.js";
import { siteSettingsRoutes } from "./routes/site-settings.js";

const app = Fastify({
  logger: true
});

app.addHook("onRequest", async (_request, reply) => {
  reply.header("X-Content-Type-Options", "nosniff");
  reply.header("X-Frame-Options", "DENY");
  reply.header("Referrer-Policy", "no-referrer");
  reply.header("Permissions-Policy", "geolocation=(), microphone=(), camera=()");
  reply.header("Cross-Origin-Resource-Policy", "same-site");
});

await app.register(cors, {
  origin: env.NODE_ENV === "production" ? env.WEB_ORIGIN : env.WEB_ORIGIN === "*" ? true : env.WEB_ORIGIN,
  methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
});

app.setErrorHandler((error, _request, reply) => {
  if (error instanceof ApiError) {
    reply.status(error.statusCode).send({
      error: error.message
    });
    return;
  }

  if (error instanceof ZodError) {
    reply.status(400).send({
      error: "Solicitud invalida",
      details: error.issues
    });
    return;
  }

  app.log.error(error);
  reply.status(500).send({
    error: "Error interno"
  });
});

app.get("/", async () => ({
  ok: true,
  service: "onlycartitas-api"
}));

app.get("/health", async () => {
  await queryClient`select 1`;

  return {
    ok: true,
    service: "onlycartitas-api",
    database: "connected"
  };
});

await app.register(authRoutes);
await app.register(discountCodeRoutes);
await app.register(orderRoutes);
await app.register(paymentRoutes);
await app.register(productRoutes);
await app.register(shippingSectorRoutes);
await app.register(siteSettingsRoutes);

try {
  await queryClient`select 1`;
  await ensureRuntimeSchema();

  await app.listen({
    port: env.PORT,
    host: "0.0.0.0"
  });
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
