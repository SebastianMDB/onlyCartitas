import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { ApiError } from "../http.js";
import {
  createShippingSector,
  deleteShippingSector,
  listShippingSectors,
  updateShippingSector
} from "../repositories/shipping-sectors.js";
import { requireAdmin } from "../security/auth.js";

const shippingSectorSchema = z.object({
  name: z.string().trim().min(2).max(80),
  price: z.number().min(0),
  active: z.boolean().optional()
});

export async function shippingSectorRoutes(app: FastifyInstance) {
  app.get("/api/shipping-sectors", async () => {
    const data = await listShippingSectors({ activeOnly: true });
    return { data };
  });

  app.get("/api/admin/shipping-sectors", async (request) => {
    await requireAdmin(request.headers.authorization);
    const data = await listShippingSectors();
    return { data };
  });

  app.post("/api/admin/shipping-sectors", async (request) => {
    await requireAdmin(request.headers.authorization);
    const input = shippingSectorSchema.parse(request.body);
    const data = await createShippingSector(input);
    return { data };
  });

  app.patch("/api/admin/shipping-sectors/:id", async (request) => {
    await requireAdmin(request.headers.authorization);
    const { id } = z.object({ id: z.string().min(1) }).parse(request.params);
    const input = shippingSectorSchema.partial().parse(request.body);
    const data = await updateShippingSector(id, input);
    if (!data) throw new ApiError(404, "Sector no encontrado");

    return { data };
  });

  app.delete("/api/admin/shipping-sectors/:id", async (request) => {
    await requireAdmin(request.headers.authorization);
    const { id } = z.object({ id: z.string().min(1) }).parse(request.params);
    const data = await deleteShippingSector(id);
    if (!data) throw new ApiError(404, "Sector no encontrado");

    return { data };
  });
}
