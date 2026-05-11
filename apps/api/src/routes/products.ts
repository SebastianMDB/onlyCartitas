import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { ApiError } from "../http.js";
import { getProductById, listProducts, updateProductInventory } from "../repositories/products.js";
import { verifySessionToken } from "../security/tokens.js";

const productQuerySchema = z.object({
  kind: z.enum(["sealed", "single"]).optional(),
  category: z.string().optional(),
  offer: z.coerce.boolean().optional(),
  q: z.string().optional(),
  includeInactive: z.coerce.boolean().optional()
});

const inventorySchema = z.object({
  stock: z.number().int().min(0).optional(),
  active: z.boolean().optional()
});

export async function productRoutes(app: FastifyInstance) {
  app.get("/api/products", async (request) => {
    const filters = productQuerySchema.parse(request.query);
    const data = await listProducts(filters);

    return {
      data
    };
  });

  app.get("/api/products/:id", async (request) => {
    const { id } = z.object({ id: z.string() }).parse(request.params);
    const product = await getProductById(id);
    if (!product) throw new ApiError(404, "Producto no encontrado");

    return {
      data: product
    };
  });

  app.patch("/api/products/:id/inventory", async (request) => {
    const session = verifySessionToken(request.headers.authorization);
    if (session?.role !== "admin") throw new ApiError(403, "Permisos insuficientes");

    const { id } = z.object({ id: z.string() }).parse(request.params);
    const input = inventorySchema.parse(request.body);
    const product = await updateProductInventory(id, input);
    if (!product) throw new ApiError(404, "Producto no encontrado");

    return {
      data: product
    };
  });
}
