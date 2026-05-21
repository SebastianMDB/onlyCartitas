import { and, desc, eq, ilike, isNotNull, or, type SQL } from "drizzle-orm";
import { db } from "../db/client.js";
import { products } from "../db/schema.js";
import { ApiError } from "../http.js";
import type { Product, ProductKind } from "../types.js";

type ProductFilters = {
  kind?: ProductKind;
  category?: string;
  offer?: boolean;
  q?: string;
  includeInactive?: boolean;
};

type ProductInput = Omit<Product, "previousPrice" | "offer" | "illustrator" | "rarity" | "playability" | "marketPrice" | "manualSegment"> & {
  previousPrice?: number | null;
  offer?: string | null;
  illustrator?: string | null;
  rarity?: string | null;
  playability?: string | null;
  marketPrice?: number | null;
  manualSegment?: string | null;
};

export async function listProducts(filters: ProductFilters = {}) {
  const conditions: SQL[] = [];
  if (!filters.includeInactive) conditions.push(eq(products.active, true));
  if (filters.kind) conditions.push(eq(products.kind, filters.kind));
  if (filters.category) conditions.push(eq(products.category, filters.category));
  if (filters.offer) {
    const offerCondition = or(isNotNull(products.offer), isNotNull(products.previousPrice));
    if (offerCondition) conditions.push(offerCondition);
  }
  if (filters.q) conditions.push(ilike(products.name, `%${filters.q}%`));

  try {
    const rows = await db
      .select()
      .from(products)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(products.createdAt));

    return rows as Product[];
  } catch {
    throw new ApiError(500, "No se pudieron obtener los productos");
  }
}

export async function getProductById(id: string) {
  try {
    const [product] = await db.select().from(products).where(eq(products.id, id)).limit(1);

    return (product as Product | undefined) ?? null;
  } catch {
    throw new ApiError(500, "No se pudo obtener el producto");
  }
}

export async function createProduct(input: ProductInput) {
  try {
    const [existing] = await db.select({ id: products.id }).from(products).where(eq(products.id, input.id)).limit(1);
    if (existing) throw new ApiError(409, "El producto ya existe");

    const [product] = await db
      .insert(products)
      .values({
        ...input,
        previousPrice: input.previousPrice ?? null,
        offer: input.offer ?? null,
        illustrator: input.illustrator ?? null,
        rarity: input.rarity ?? null,
        playability: input.playability ?? null,
        marketPrice: input.marketPrice ?? null,
        manualSegment: input.manualSegment ?? null
      })
      .returning();

    return product as Product;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(500, "No se pudo crear el producto");
  }
}

export async function updateProductInventory(id: string, input: { stock?: number; active?: boolean }) {
  try {
    const [product] = await db
      .update(products)
      .set({
        ...input,
        updatedAt: new Date()
      })
      .where(eq(products.id, id))
      .returning();

    return (product as Product | undefined) ?? null;
  } catch {
    throw new ApiError(500, "No se pudo actualizar el inventario");
  }
}
