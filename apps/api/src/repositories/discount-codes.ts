import { asc, eq, sql } from "drizzle-orm";
import { db } from "../db/client.js";
import { discountCodes } from "../db/schema.js";
import { ApiError } from "../http.js";

type DiscountCodeRow = typeof discountCodes.$inferSelect;

export type DiscountCodeInput = {
  code: string;
  type: "percent" | "fixed";
  value: number;
  active?: boolean;
  startsAt?: string | null;
  expiresAt?: string | null;
  maxUses?: number | null;
};

const localDiscountCodes: DiscountCodeRow[] = [
  {
    id: "local-only10",
    code: "ONLY10",
    type: "percent",
    value: 10,
    active: true,
    startsAt: null,
    expiresAt: null,
    maxUses: null,
    usedCount: 0,
    createdAt: new Date(),
    updatedAt: new Date()
  }
];

const normalizeCode = (code: string) => code.trim().toUpperCase();

const toResponse = (discountCode: DiscountCodeRow) => ({
  id: discountCode.id,
  code: discountCode.code,
  type: discountCode.type,
  value: discountCode.value,
  active: discountCode.active,
  starts_at: discountCode.startsAt?.toISOString() ?? null,
  expires_at: discountCode.expiresAt?.toISOString() ?? null,
  max_uses: discountCode.maxUses,
  used_count: discountCode.usedCount,
  created_at: discountCode.createdAt.toISOString(),
  updated_at: discountCode.updatedAt.toISOString()
});

const isUsable = (discountCode: DiscountCodeRow, now = new Date()) => {
  if (!discountCode.active) return false;
  if (discountCode.startsAt && discountCode.startsAt > now) return false;
  if (discountCode.expiresAt && discountCode.expiresAt < now) return false;
  if (discountCode.maxUses !== null && discountCode.usedCount >= discountCode.maxUses) return false;
  return true;
};

export const calculateDiscount = (discountCode: Pick<DiscountCodeRow, "type" | "value">, subtotal: number) => {
  const value = Number(discountCode.value);
  const discount = discountCode.type === "percent" ? subtotal * (value / 100) : value;
  return Math.min(subtotal, Math.max(0, Number(discount.toFixed(2))));
};

export async function listDiscountCodes() {
  if (!db) return localDiscountCodes.map(toResponse);

  try {
    const rows = await db.select().from(discountCodes).orderBy(asc(discountCodes.code));
    return rows.map(toResponse);
  } catch {
    throw new ApiError(500, "No se pudieron obtener los codigos de descuento");
  }
}

export async function findUsableDiscountCode(code: string, subtotal: number) {
  const normalizedCode = normalizeCode(code);
  if (!normalizedCode) return null;

  const discountCode = !db
    ? localDiscountCodes.find((item) => item.code === normalizedCode) ?? null
    : ((await db.select().from(discountCodes).where(eq(discountCodes.code, normalizedCode)).limit(1))[0] ?? null);

  if (!discountCode || !isUsable(discountCode)) return null;

  return {
    ...toResponse(discountCode),
    discount: calculateDiscount(discountCode, subtotal)
  };
}

export async function createDiscountCode(input: DiscountCodeInput) {
  const values = {
    code: normalizeCode(input.code),
    type: input.type,
    value: input.value,
    active: input.active ?? true,
    startsAt: input.startsAt ? new Date(input.startsAt) : null,
    expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
    maxUses: input.maxUses ?? null,
    updatedAt: new Date()
  };

  if (!db) {
    if (localDiscountCodes.some((item) => item.code === values.code)) throw new ApiError(409, "El codigo ya existe");
    const now = new Date();
    const discountCode = {
      id: `local-${values.code.toLowerCase()}`,
      ...values,
      usedCount: 0,
      createdAt: now,
      updatedAt: now
    };
    localDiscountCodes.push(discountCode);
    return toResponse(discountCode);
  }

  try {
    const [discountCode] = await db.insert(discountCodes).values(values).returning();
    return toResponse(discountCode);
  } catch {
    throw new ApiError(500, "No se pudo crear el codigo de descuento");
  }
}

export async function updateDiscountCode(id: string, input: Partial<DiscountCodeInput>) {
  const values = {
    ...(input.code !== undefined ? { code: normalizeCode(input.code) } : {}),
    ...(input.type !== undefined ? { type: input.type } : {}),
    ...(input.value !== undefined ? { value: input.value } : {}),
    ...(input.active !== undefined ? { active: input.active } : {}),
    ...(input.startsAt !== undefined ? { startsAt: input.startsAt ? new Date(input.startsAt) : null } : {}),
    ...(input.expiresAt !== undefined ? { expiresAt: input.expiresAt ? new Date(input.expiresAt) : null } : {}),
    ...(input.maxUses !== undefined ? { maxUses: input.maxUses } : {}),
    updatedAt: new Date()
  };

  if (!db) {
    const index = localDiscountCodes.findIndex((item) => item.id === id);
    if (index === -1) return null;
    localDiscountCodes[index] = { ...localDiscountCodes[index], ...values };
    return toResponse(localDiscountCodes[index]);
  }

  try {
    const [discountCode] = await db.update(discountCodes).set(values).where(eq(discountCodes.id, id)).returning();
    return discountCode ? toResponse(discountCode) : null;
  } catch {
    throw new ApiError(500, "No se pudo actualizar el codigo de descuento");
  }
}

export async function registerDiscountUse(code: string) {
  const normalizedCode = normalizeCode(code);
  if (!db) {
    const discountCode = localDiscountCodes.find((item) => item.code === normalizedCode);
    if (discountCode) discountCode.usedCount += 1;
    return;
  }

  await db
    .update(discountCodes)
    .set({ usedCount: sql`${discountCodes.usedCount} + 1`, updatedAt: new Date() })
    .where(eq(discountCodes.code, normalizedCode));
}
