import { randomUUID } from "node:crypto";
import { desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "../db/client.js";
import { orderItems, orders, products } from "../db/schema.js";
import { ApiError } from "../http.js";
import { findUsableDiscountCode, registerDiscountUse } from "./discount-codes.js";
import { getProductById } from "./products.js";
import { getActiveShippingSector } from "./shipping-sectors.js";
import type { AuthUser, CartItem } from "../types.js";

type CreateOrderInput = {
  user?: AuthUser;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  deliveryMode: "retiro" | "envio";
  address?: string;
  comuna?: string;
  city?: string;
  region?: string;
  shippingSectorId?: string;
  items: Array<Pick<CartItem, "id" | "quantity" | "variantId">>;
  discountCode?: string;
};

const FREE_ANTOFAGASTA_SHIPPING_THRESHOLD = 90_000;
const normalizeLocation = (value: unknown) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();

type OrderRow = typeof orders.$inferSelect;
type OrderItemRow = typeof orderItems.$inferSelect;

const toOrderResponse = (order: OrderRow, items: OrderItemRow[] = []) => ({
  id: order.id,
  user_id: order.userId,
  customer_name: order.customerName,
  customer_email: order.customerEmail,
  customer_phone: order.customerPhone,
  delivery_mode: order.deliveryMode,
  address: order.address,
  items: items.map((item) => ({
    id: item.id,
    product_id: item.productId,
    variant_id: item.variantId,
    variant_name: item.variantName,
    name: item.name,
    quantity: item.quantity,
    unit_price: item.unitPrice,
    subtotal: item.subtotal
  })),
  subtotal: order.subtotal,
  shipping: order.shipping,
  discount: order.discount,
  discount_code: order.discountCode,
  total: order.total,
  status: order.status,
  metadata: order.metadata,
  created_at: order.createdAt.toISOString(),
  updated_at: order.updatedAt.toISOString()
});

const isAntofagastaDelivery = (input: Pick<CreateOrderInput, "comuna" | "city" | "region">) =>
  normalizeLocation(input.region) === "antofagasta" &&
  normalizeLocation(input.comuna) === "antofagasta" &&
  normalizeLocation(input.city) === "antofagasta";

export async function createOrder(input: CreateOrderInput) {
  const items = await Promise.all(
    input.items.map(async (item) => {
      const product = await getProductById(item.id);
      if (!product || !product.active) throw new ApiError(400, `Producto no disponible: ${item.id}`);
      const variant = item.variantId ? product.variants?.find((candidate) => candidate.id === item.variantId) : null;
      const availableStock = variant ? (variant.active === false ? 0 : variant.stock) : product.stock;
      if (product.variants?.length && !variant) {
        throw new ApiError(400, `Selecciona un diseño para ${product.name}`);
      }
      if (item.quantity < 1 || item.quantity > availableStock) {
        throw new ApiError(400, `Stock insuficiente para ${product.name}`);
      }

      return {
        product_id: product.id,
        variantId: variant?.id,
        variantName: variant?.name,
        variants: product.variants ?? null,
        name: variant ? `${product.name} - ${variant.name}` : product.name,
        quantity: item.quantity,
        unit_price: product.price,
        subtotal: product.price * item.quantity
      };
    })
  );

  const subtotal = items.reduce((total, item) => total + item.subtotal, 0);
  let shipping = 0;
  const metadata: Record<string, unknown> = {};

  if (input.deliveryMode === "envio" && isAntofagastaDelivery(input)) {
    if (!input.shippingSectorId) throw new ApiError(400, "Selecciona un sector de envio para Antofagasta");
    const shippingSector = await getActiveShippingSector(input.shippingSectorId);
    if (!shippingSector) throw new ApiError(400, "Sector de envio no disponible");

    shipping = subtotal > FREE_ANTOFAGASTA_SHIPPING_THRESHOLD ? 0 : Number(shippingSector.price);
    metadata.shipping_sector = {
      id: shippingSector.id,
      name: shippingSector.name,
      price: shippingSector.price,
      free_shipping_applied: shipping === 0
    };
  }

  if (input.deliveryMode === "envio") {
    metadata.delivery_address = {
      comuna: input.comuna ?? null,
      city: input.city ?? null,
      region: input.region ?? null,
      shipping_payment: isAntofagastaDelivery(input) ? "included" : "collect"
    };
  }
  const discountCode = input.discountCode ? await findUsableDiscountCode(input.discountCode, subtotal) : null;
  const discount = discountCode?.discount ?? 0;
  const total = Math.max(0, subtotal + shipping - discount);

  const localOrder = {
    id: randomUUID(),
    user_id: input.user?.id ?? null,
    customer_name: input.customerName,
    customer_email: input.customerEmail,
    customer_phone: input.customerPhone ?? null,
    delivery_mode: input.deliveryMode,
    address: input.address ?? null,
    items,
    subtotal,
    shipping,
    discount,
    discount_code: discountCode?.code ?? null,
    total,
    status: "pending",
    created_at: new Date().toISOString()
  };

  try {
    return await db.transaction(async (tx) => {
      const [order] = await tx
        .insert(orders)
        .values({
          id: localOrder.id,
          userId: input.user?.id ?? null,
          customerName: input.customerName,
          customerEmail: input.customerEmail,
          customerPhone: input.customerPhone ?? null,
          deliveryMode: input.deliveryMode,
          address: input.address ?? null,
          subtotal,
          shipping,
          discount,
          discountCode: discountCode?.code ?? null,
          total,
          status: "pending",
          metadata
        })
        .returning();

      const createdItems = await tx
        .insert(orderItems)
        .values(
          items.map((item) => ({
            orderId: order.id,
            productId: item.product_id,
            variantId: item.variantId ?? null,
            variantName: item.variantName ?? null,
            name: item.name,
            quantity: item.quantity,
            unitPrice: item.unit_price,
            subtotal: item.subtotal
          }))
        )
        .returning();

      for (const item of items) {
        if (item.variantId && item.variants?.length) {
          await tx
            .update(products)
            .set({
              variants: item.variants.map((variant) =>
                variant.id === item.variantId ? { ...variant, stock: Math.max(0, Number(variant.stock) - item.quantity) } : variant
              ),
              updatedAt: new Date()
            })
            .where(eq(products.id, item.product_id));
          continue;
        }

        await tx
          .update(products)
          .set({
            stock: sql`${products.stock} - ${item.quantity}`,
            updatedAt: new Date()
          })
          .where(eq(products.id, item.product_id));
      }

      if (discountCode?.code) await registerDiscountUse(discountCode.code);

      return toOrderResponse(order, createdItems);
    });
  } catch {
    throw new ApiError(500, "No se pudo crear el pedido");
  }
}

export async function updateOrderStatus(id: string, status: OrderRow["status"], user?: AuthUser) {
  if (user?.role !== "admin") throw new ApiError(403, "Permisos insuficientes");

  try {
    const [order] = await db
      .update(orders)
      .set({ status, updatedAt: new Date() })
      .where(eq(orders.id, id))
      .returning();

    if (!order) return null;

    const itemRows = await db.select().from(orderItems).where(eq(orderItems.orderId, order.id));
    return toOrderResponse(order, itemRows);
  } catch {
    throw new ApiError(500, "No se pudo actualizar el pedido");
  }
}

export async function listOrders(user?: AuthUser) {
  if (!user) throw new ApiError(401, "Sesion requerida");

  try {
    const orderRows =
      user.role === "admin"
        ? await db.select().from(orders).orderBy(desc(orders.createdAt))
        : await db.select().from(orders).where(eq(orders.userId, user.id)).orderBy(desc(orders.createdAt));

    if (orderRows.length === 0) return [];

    const itemRows = await db
      .select()
      .from(orderItems)
      .where(
        inArray(
          orderItems.orderId,
          orderRows.map((order) => order.id)
        )
      );

    return orderRows.map((order) =>
      toOrderResponse(
        order,
        itemRows.filter((item) => item.orderId === order.id)
      )
    );
  } catch {
    throw new ApiError(500, "No se pudieron obtener los pedidos");
  }
}

export async function getOrderById(id: string, user?: AuthUser) {
  try {
    const [order] =
      user?.role === "admin"
        ? await db.select().from(orders).where(eq(orders.id, id)).limit(1)
        : user
          ? await db.select().from(orders).where(eq(orders.id, id)).limit(1)
          : await db.select().from(orders).where(eq(orders.id, id)).limit(1);

    if (!order) return null;
    if (user?.role !== "admin" && order.userId && order.userId !== user?.id) throw new ApiError(403, "Permisos insuficientes");

    const itemRows = await db.select().from(orderItems).where(eq(orderItems.orderId, order.id));
    return toOrderResponse(order, itemRows);
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(500, "No se pudo obtener el pedido");
  }
}
