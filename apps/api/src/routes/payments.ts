import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { createMercadoPagoPreference, syncMercadoPagoPayment } from "../repositories/payments.js";
import { getAuthenticatedUser } from "../security/auth.js";

const preferenceSchema = z.object({
  orderId: z.string().uuid()
});

const webhookQuerySchema = z.object({
  id: z.string().optional(),
  topic: z.string().optional(),
  type: z.string().optional(),
  "data.id": z.string().optional()
});

const syncQuerySchema = z.object({
  payment_id: z.string().optional(),
  collection_id: z.string().optional()
});

const webhookBodySchema = z
  .object({
    type: z.string().optional(),
    topic: z.string().optional(),
    data: z
      .object({
        id: z.union([z.string(), z.number()]).optional()
      })
      .optional()
  })
  .passthrough();

export async function paymentRoutes(app: FastifyInstance) {
  app.post("/api/payments/mercadopago/preferences", async (request) => {
    const session = (await getAuthenticatedUser(request.headers.authorization)) ?? undefined;
    const input = preferenceSchema.parse(request.body);
    const data = await createMercadoPagoPreference(input.orderId, session);

    return { data };
  });

  app.post("/api/payments/mercadopago/webhook", async (request) => {
    const query = webhookQuerySchema.parse(request.query);
    const body = webhookBodySchema.parse(request.body ?? {});
    const paymentId = String(body.data?.id ?? query["data.id"] ?? query.id ?? "");
    const notificationType = body.type ?? body.topic ?? query.type ?? query.topic;

    if (!paymentId || notificationType !== "payment") {
      return { ok: true };
    }

    const data = await syncMercadoPagoPayment(paymentId);
    return { ok: true, data };
  });

  app.get("/api/payments/mercadopago/sync", async (request) => {
    const query = syncQuerySchema.parse(request.query);
    const paymentId = query.payment_id ?? query.collection_id ?? "";

    if (!paymentId || paymentId === "null") {
      return { ok: false, data: null };
    }

    const data = await syncMercadoPagoPayment(paymentId);
    return { ok: true, data };
  });
}
