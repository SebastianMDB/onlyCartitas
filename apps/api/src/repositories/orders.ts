import { randomUUID } from "node:crypto";
import { desc, eq, inArray } from "drizzle-orm";
import { db } from "../db/client.js";
import { orderItems, orders } from "../db/schema.js";
import { ApiError } from "../http.js";
import { findUsableDiscountCode, registerDiscountUse } from "./discount-codes.js";
import { getProductById } from "./products.js";
import type { AuthUser, CartItem } from "../types.js";

type CreateOrderInput = {
  user?: AuthUser;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  deliveryMode: "retiro" | "envio";
  address?: string;
  items: Array<Pick<CartItem, "id" | "quantity">>;
  discountCode?: string;
};

const localOrders: unknown[] = [];
const SHIPPING_PRICE = 4990;

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
  created_at: order.createdAt.toISOString(),
  updated_at: order.updatedAt.toISOString()
});

export async function createOrder(input: CreateOrderInput) {
  const items = await Promise.all(
    input.items.map(async (item) => {
      const product = await getProductById(item.id);
      if (!product || !product.active) throw new ApiError(400, `Producto no disponible: ${item.id}`);
      if (item.quantity < 1 || item.quantity > product.stock) {
        throw new ApiError(400, `Stock insuficiente para ${product.name}`);
      }

      return {
        product_id: product.id,
        name: product.name,
        quantity: item.quantity,
        unit_price: product.price,
        subtotal: product.price * item.quantity
      };
    })
  );

  const subtotal = items.reduce((total, item) => total + item.subtotal, 0);
  const shipping = input.deliveryMode === "envio" ? SHIPPING_PRICE : 0;
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

  if (!db) {
    localOrders.unshift(localOrder);
    return localOrder;
  }

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
          status: "pending"
        })
        .returning();

      const createdItems = await tx
        .insert(orderItems)
        .values(
          items.map((item) => ({
            orderId: order.id,
            productId: item.product_id,
            name: item.name,
            quantity: item.quantity,
            unitPrice: item.unit_price,
            subtotal: item.subtotal
          }))
        )
        .returning();

      if (discountCode?.code) await registerDiscountUse(discountCode.code);

      return toOrderResponse(order, createdItems);
    });
  } catch {
    throw new ApiError(500, "No se pudo crear el pedido");
  }
}

export async function updateOrderStatus(id: string, status: OrderRow["status"], user?: AuthUser) {
  if (user?.role !== "admin") throw new ApiError(403, "Permisos insuficientes");

  if (!db) {
    const index = localOrders.findIndex((order) => (order as { id?: string }).id === id);
    if (index === -1) return null;
    localOrders[index] = {
      ...(localOrders[index] as Record<string, unknown>),
      status,
      updated_at: new Date().toISOString()
    };
    return localOrders[index];
  }

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

  if (!db) {
    return user.role === "admin"
      ? localOrders
      : localOrders.filter((order) => (order as { user_id?: string }).user_id === user.id);
  }

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
  if (!db) {
    const order = localOrders.find((item) => (item as { id?: string }).id === id) as
      | (ReturnType<typeof toOrderResponse> & { user_id?: string | null })
      | undefined;
    if (!order) return null;
    if (user?.role !== "admin" && order.user_id && order.user_id !== user?.id) throw new ApiError(403, "Permisos insuficientes");
    return order;
  }

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
