import { asc, eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { shippingSectors } from "../db/schema.js";
import { ApiError } from "../http.js";

type ShippingSectorRow = typeof shippingSectors.$inferSelect;

export type ShippingSectorInput = {
  name: string;
  price: number;
  active?: boolean;
};

const normalizeSectorName = (name: string) => name.trim().replace(/\s+/g, " ");

const toResponse = (sector: ShippingSectorRow) => ({
  id: sector.id,
  name: sector.name,
  price: sector.price,
  active: sector.active,
  created_at: sector.createdAt.toISOString(),
  updated_at: sector.updatedAt.toISOString()
});

export async function listShippingSectors(options: { activeOnly?: boolean } = {}) {
  try {
    const rows = options.activeOnly
      ? await db.select().from(shippingSectors).where(eq(shippingSectors.active, true)).orderBy(asc(shippingSectors.name))
      : await db.select().from(shippingSectors).orderBy(asc(shippingSectors.name));

    return rows.map(toResponse);
  } catch {
    throw new ApiError(500, "No se pudieron obtener los sectores de envio");
  }
}

export async function getActiveShippingSector(id: string) {
  try {
    const [sector] = await db
      .select()
      .from(shippingSectors)
      .where(eq(shippingSectors.id, id))
      .limit(1);

    return sector?.active ? toResponse(sector) : null;
  } catch {
    throw new ApiError(500, "No se pudo obtener el sector de envio");
  }
}

export async function createShippingSector(input: ShippingSectorInput) {
  try {
    const [sector] = await db
      .insert(shippingSectors)
      .values({
        name: normalizeSectorName(input.name),
        price: input.price,
        active: input.active ?? true,
        updatedAt: new Date()
      })
      .returning();

    return toResponse(sector);
  } catch {
    throw new ApiError(500, "No se pudo crear el sector de envio");
  }
}

export async function updateShippingSector(id: string, input: Partial<ShippingSectorInput>) {
  try {
    const [sector] = await db
      .update(shippingSectors)
      .set({
        ...(input.name !== undefined ? { name: normalizeSectorName(input.name) } : {}),
        ...(input.price !== undefined ? { price: input.price } : {}),
        ...(input.active !== undefined ? { active: input.active } : {}),
        updatedAt: new Date()
      })
      .where(eq(shippingSectors.id, id))
      .returning();

    return sector ? toResponse(sector) : null;
  } catch {
    throw new ApiError(500, "No se pudo actualizar el sector de envio");
  }
}

export async function deleteShippingSector(id: string) {
  try {
    const [sector] = await db.delete(shippingSectors).where(eq(shippingSectors.id, id)).returning();
    return sector ? toResponse(sector) : null;
  } catch {
    throw new ApiError(500, "No se pudo eliminar el sector de envio");
  }
}
