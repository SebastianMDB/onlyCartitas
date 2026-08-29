import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { ApiError } from "../http.js";
import {
  createDiscountCode,
  findUsableDiscountCode,
  listDiscountCodes,
  updateDiscountCode
} from "../repositories/discount-codes.js";
import { requireAdmin } from "../security/auth.js";

const discountCodeSchema = z.object({
  code: z.string().trim().min(2).max(40),
  type: z.enum(["percent", "fixed"]),
  value: z.number().positive(),
  active: z.boolean().optional(),
  startsAt: z.string().datetime().nullable().optional(),
  expiresAt: z.string().datetime().nullable().optional(),
  maxUses: z.number().int().positive().nullable().optional()
});

const validateSchema = z.object({
  code: z.string().trim().min(1),
  subtotal: z.number().min(0)
});

export async function discountCodeRoutes(app: FastifyInstance) {
  app.post("/api/discount-codes/validate", async (request) => {
    const input = validateSchema.parse(request.body);
    const data = await findUsableDiscountCode(input.code, input.subtotal);
    if (!data) throw new ApiError(404, "Codigo no valido");

    return { data };
  });

  app.get("/api/admin/discount-codes", async (request) => {
    await requireAdmin(request.headers.authorization);
    const data = await listDiscountCodes();
    return { data };
  });

  app.post("/api/admin/discount-codes", async (request) => {
    await requireAdmin(request.headers.authorization);
    const input = discountCodeSchema.parse(request.body);
    const data = await createDiscountCode(input);
    return { data };
  });

  app.patch("/api/admin/discount-codes/:id", async (request) => {
    await requireAdmin(request.headers.authorization);
    const { id } = z.object({ id: z.string().min(1) }).parse(request.params);
    const input = discountCodeSchema.partial().parse(request.body);
    const data = await updateDiscountCode(id, input);
    if (!data) throw new ApiError(404, "Codigo no encontrado");

    return { data };
  });
}
