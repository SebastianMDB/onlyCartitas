import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { ApiError } from "../http.js";
import { createProduct, getProductById, listProducts, updateProduct, updateProductInventory } from "../repositories/products.js";
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

const productVariantSchema = z.object({
  id: z.string().trim().min(1).max(80).regex(/^[a-z0-9][a-z0-9-]*$/, "Usa solo minusculas, numeros y guiones"),
  name: z.string().trim().min(1).max(120),
  stock: z.number().int().min(0),
  active: z.boolean().default(true)
});

const pathOrUrl = z.string().trim().min(1).max(1000).refine((value) => {
  if (value.startsWith("/")) return true;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}, "Debe ser una ruta local o URL valida");

const productSchema = z.object({
  id: z.string().trim().min(2).max(80).regex(/^[a-z0-9][a-z0-9-]*$/, "Usa solo minusculas, numeros y guiones").optional(),
  kind: z.enum(["sealed", "single"]),
  name: z.string().trim().min(2).max(180),
  category: z.string().trim().min(2).max(120),
  description: z.string().trim().max(800).nullable().optional(),
  set: z.string().trim().min(2).max(120),
  language: z.enum(["japanese", "spanish", "english"]),
  stock: z.number().int().min(0),
  variants: z.array(productVariantSchema).max(40).nullable().optional(),
  price: z.number().min(0),
  previousPrice: z.number().min(0).nullable().optional(),
  image: pathOrUrl,
  offer: z.string().trim().max(80).nullable().optional(),
  active: z.boolean().default(true),
  illustrator: z.string().trim().max(120).nullable().optional(),
  rarity: z.string().trim().max(120).nullable().optional(),
  playability: z.string().trim().max(120).nullable().optional(),
  marketPrice: z.number().min(0).nullable().optional(),
  manualSegment: z.string().trim().max(120).nullable().optional()
});

const productUpdateSchema = z.object({
  kind: z.enum(["sealed", "single"]).optional(),
  name: z.string().trim().min(2).max(180).optional(),
  category: z.string().trim().min(2).max(120).optional(),
  description: z.string().trim().max(800).nullable().optional(),
  set: z.string().trim().min(2).max(120).optional(),
  language: z.enum(["japanese", "spanish", "english"]).optional(),
  stock: z.number().int().min(0).optional(),
  variants: z.array(productVariantSchema).max(40).nullable().optional(),
  price: z.number().min(0).optional(),
  previousPrice: z.number().min(0).nullable().optional(),
  image: pathOrUrl.optional(),
  offer: z.string().trim().max(80).nullable().optional(),
  active: z.boolean().optional(),
  illustrator: z.string().trim().max(120).nullable().optional(),
  rarity: z.string().trim().max(120).nullable().optional(),
  playability: z.string().trim().max(120).nullable().optional(),
  marketPrice: z.number().min(0).nullable().optional(),
  manualSegment: z.string().trim().max(120).nullable().optional()
});

const requireAdmin = (authorization: string | undefined) => {
  const session = verifySessionToken(authorization);
  if (session?.role !== "admin") throw new ApiError(403, "Permisos insuficientes");
};

export async function productRoutes(app: FastifyInstance) {
  app.get("/api/products", async (request, reply) => {
    const filters = productQuerySchema.parse(request.query);
    reply.header(
      "Cache-Control",
      filters.includeInactive
        ? "no-store, max-age=0"
        : "public, max-age=60, s-maxage=300, stale-while-revalidate=600"
    );
    const data = await listProducts(filters);

    return {
      data
    };
  });

  app.get("/api/products/:id", async (request, reply) => {
    reply.header("Cache-Control", "public, max-age=60, s-maxage=300, stale-while-revalidate=600");
    const { id } = z.object({ id: z.string() }).parse(request.params);
    const product = await getProductById(id);
    if (!product) throw new ApiError(404, "Producto no encontrado");

    return {
      data: product
    };
  });

  app.post("/api/products", async (request) => {
    requireAdmin(request.headers.authorization);
    const input = productSchema.parse(request.body);
    const product = await createProduct(input);

    return {
      data: product
    };
  });

  app.patch("/api/products/:id/inventory", async (request) => {
    requireAdmin(request.headers.authorization);

    const { id } = z.object({ id: z.string() }).parse(request.params);
    const input = inventorySchema.parse(request.body);
    const product = await updateProductInventory(id, input);
    if (!product) throw new ApiError(404, "Producto no encontrado");

    return {
      data: product
    };
  });

  app.patch("/api/products/:id", async (request) => {
    requireAdmin(request.headers.authorization);

    const { id } = z.object({ id: z.string() }).parse(request.params);
    const input = productUpdateSchema.parse(request.body);
    const product = await updateProduct(id, input);
    if (!product) throw new ApiError(404, "Producto no encontrado");

    return {
      data: product
    };
  });
}
