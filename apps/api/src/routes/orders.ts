import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { createOrder, listOrders, updateOrderStatus } from "../repositories/orders.js";
import { verifySessionToken } from "../security/tokens.js";

const createOrderSchema = z.object({
  customerName: z.string().trim().min(2),
  customerEmail: z.string().trim().email(),
  customerPhone: z.string().trim().optional(),
  deliveryMode: z.enum(["retiro", "envio"]),
  address: z.string().trim().optional(),
  comuna: z.string().trim().optional(),
  city: z.string().trim().optional(),
  region: z.string().trim().optional(),
  shippingSectorId: z.string().uuid().optional(),
  discountCode: z.string().trim().optional(),
  items: z
    .array(
      z.object({
        id: z.string().trim().min(1),
        variantId: z.string().trim().min(1).optional(),
        quantity: z.number().int().positive()
      })
    )
    .min(1)
});

const orderStatusSchema = z.object({
  status: z.enum(["pending", "paid", "preparing", "shipped", "completed", "cancelled"])
});

export async function orderRoutes(app: FastifyInstance) {
  app.post("/api/orders", async (request) => {
    const session = verifySessionToken(request.headers.authorization) ?? undefined;
    const input = createOrderSchema.parse(request.body);
    const data = await createOrder({ ...input, user: session });

    return {
      data
    };
  });

  app.get("/api/orders", async (request) => {
    const session = verifySessionToken(request.headers.authorization) ?? undefined;
    const data = await listOrders(session);

    return {
      data
    };
  });

  app.patch("/api/orders/:id/status", async (request) => {
    const session = verifySessionToken(request.headers.authorization) ?? undefined;
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const input = orderStatusSchema.parse(request.body);
    const data = await updateOrderStatus(id, input.status, session);
    if (!data) {
      return {
        data: null
      };
    }

    return {
      data
    };
  });
}
