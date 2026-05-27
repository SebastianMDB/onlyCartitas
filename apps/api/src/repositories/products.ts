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

type ProductInput = Omit<Product, "id" | "previousPrice" | "offer" | "illustrator" | "rarity" | "playability" | "marketPrice" | "manualSegment"> & {
  id?: string;
  previousPrice?: number | null;
  offer?: string | null;
  illustrator?: string | null;
  rarity?: string | null;
  playability?: string | null;
  marketPrice?: number | null;
  manualSegment?: string | null;
};

const slugifyProductId = (value: string) => {
  const slug = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

  return slug || "producto";
};

async function getAvailableProductId(name: string) {
  const baseId = slugifyProductId(name);

  for (let index = 0; index < 100; index += 1) {
    const suffix = index === 0 ? "" : `-${index + 1}`;
    const candidate = `${baseId.slice(0, 80 - suffix.length)}${suffix}`;
    const [existing] = await db.select({ id: products.id }).from(products).where(eq(products.id, candidate)).limit(1);
    if (!existing) return candidate;
  }

  return `${baseId.slice(0, 67)}-${Date.now().toString(36)}`;
}

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
    let id = input.id ?? (await getAvailableProductId(input.name));
    const [existing] = await db.select({ id: products.id }).from(products).where(eq(products.id, id)).limit(1);
    if (existing) {
      id = await getAvailableProductId(input.name);
    }

    const [product] = await db
      .insert(products)
      .values({
        ...input,
        id,
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

export async function updateProduct(id: string, input: Partial<ProductInput>) {
  try {
    const [product] = await db
      .update(products)
      .set({
        ...input,
        previousPrice: input.previousPrice === undefined ? undefined : input.previousPrice ?? null,
        offer: input.offer === undefined ? undefined : input.offer ?? null,
        illustrator: input.illustrator === undefined ? undefined : input.illustrator ?? null,
        rarity: input.rarity === undefined ? undefined : input.rarity ?? null,
        playability: input.playability === undefined ? undefined : input.playability ?? null,
        marketPrice: input.marketPrice === undefined ? undefined : input.marketPrice ?? null,
        manualSegment: input.manualSegment === undefined ? undefined : input.manualSegment ?? null,
        updatedAt: new Date()
      })
      .where(eq(products.id, id))
      .returning();

    return (product as Product | undefined) ?? null;
  } catch {
    throw new ApiError(500, "No se pudo actualizar el producto");
  }
}
