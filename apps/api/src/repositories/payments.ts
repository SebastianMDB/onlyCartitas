import { eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { orders, payments } from "../db/schema.js";
import { env } from "../env.js";
import { ApiError } from "../http.js";
import { getOrderById } from "./orders.js";
import type { AuthUser } from "../types.js";

type MercadoPagoPreferenceResponse = {
  id: string;
  init_point?: string;
  sandbox_init_point?: string;
};

type MercadoPagoPaymentResponse = {
  id: number;
  status?: string;
  external_reference?: string;
  transaction_amount?: number;
  currency_id?: string;
};

const mercadoPagoApiUrl = "https://api.mercadopago.com";

const normalizePaymentStatus = (status?: string) => {
  if (status === "approved") return "approved";
  if (status === "rejected") return "rejected";
  if (status === "cancelled") return "cancelled";
  if (status === "refunded" || status === "charged_back") return "refunded";
  if (status === "pending" || status === "in_process" || status === "in_mediation") return "pending";
  return "created";
};

const requireMercadoPagoToken = () => {
  if (!env.MERCADO_PAGO_ACCESS_TOKEN) {
    throw new ApiError(503, "Mercado Pago no esta configurado");
  }

  return env.MERCADO_PAGO_ACCESS_TOKEN;
};

const getApiPublicUrl = () => env.API_PUBLIC_URL || `http://localhost:${env.PORT}`;

const toPaymentResponse = (payment: typeof payments.$inferSelect) => ({
  id: payment.id,
  order_id: payment.orderId,
  provider: payment.provider,
  status: payment.status,
  amount: payment.amount,
  currency: payment.currency,
  provider_preference_id: payment.providerPreferenceId,
  provider_payment_id: payment.providerPaymentId,
  checkout_url: payment.checkoutUrl,
  created_at: payment.createdAt.toISOString(),
  updated_at: payment.updatedAt.toISOString()
});

const assertPaymentMatchesOrder = async (payload: MercadoPagoPaymentResponse) => {
  const orderId = payload.external_reference;
  if (!orderId) throw new ApiError(400, "Pago sin referencia de pedido");

  const order = await getOrderById(orderId);
  if (!order) throw new ApiError(404, "Pedido no encontrado para el pago");

  const paidAmount = Math.round(Number(payload.transaction_amount ?? 0));
  const expectedAmount = Math.round(Number(order.total));
  if (paidAmount !== expectedAmount) {
    throw new ApiError(400, "Monto de pago no coincide con el pedido");
  }

  const currency = payload.currency_id ?? "";
  if (currency !== env.MERCADO_PAGO_CURRENCY_ID) {
    throw new ApiError(400, "Moneda de pago no coincide con el pedido");
  }

  return order;
};

export async function createMercadoPagoPreference(orderId: string, user?: AuthUser) {
  const token = requireMercadoPagoToken();
  const order = await getOrderById(orderId, user);
  if (!order) throw new ApiError(404, "Pedido no encontrado");

  const siteUrl = env.WEB_ORIGIN.replace(/\/$/, "");
  const apiUrl = getApiPublicUrl().replace(/\/$/, "");
  const body = {
    items: [
      {
        id: order.id,
        title: `Pedido OnlyCartitas ${order.id.slice(0, 8)}`,
        quantity: 1,
        unit_price: Math.round(Number(order.total)),
        currency_id: env.MERCADO_PAGO_CURRENCY_ID
      }
    ],
    payer: {
      name: order.customer_name,
      email: order.customer_email,
      phone: order.customer_phone ? { number: order.customer_phone } : undefined
    },
    external_reference: order.id,
    back_urls: {
      success: `${siteUrl}/pago/resultado?status=success&order_id=${order.id}`,
      failure: `${siteUrl}/pago/resultado?status=failure&order_id=${order.id}`,
      pending: `${siteUrl}/pago/resultado?status=pending&order_id=${order.id}`
    },
    notification_url: `${apiUrl}/api/payments/mercadopago/webhook`,
    auto_return: "approved"
  };

  const response = await fetch(`${mercadoPagoApiUrl}/checkout/preferences`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });

  const payload = (await response.json().catch(() => null)) as MercadoPagoPreferenceResponse | { message?: string } | null;
  if (!response.ok || !payload || !("id" in payload)) {
    throw new ApiError(502, payload && "message" in payload && payload.message ? payload.message : "No se pudo crear el pago");
  }

  const checkoutUrl =
    env.MERCADO_PAGO_CHECKOUT_MODE === "production" ? payload.init_point : payload.sandbox_init_point ?? payload.init_point;

  const [payment] = await db
    .insert(payments)
    .values({
      orderId: order.id,
      provider: "mercado_pago",
      status: "created",
      amount: order.total,
      currency: env.MERCADO_PAGO_CURRENCY_ID,
      providerPreferenceId: payload.id,
      checkoutUrl,
      metadata: { preference: payload }
    })
    .returning();

  return toPaymentResponse(payment);
}

export async function syncMercadoPagoPayment(providerPaymentId: string) {
  const token = requireMercadoPagoToken();
  const response = await fetch(`${mercadoPagoApiUrl}/v1/payments/${providerPaymentId}`, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  const payload = (await response.json().catch(() => null)) as MercadoPagoPaymentResponse | { message?: string } | null;
  if (!response.ok || !payload || !("id" in payload)) {
    throw new ApiError(502, payload && "message" in payload && payload.message ? payload.message : "No se pudo consultar el pago");
  }

  const status = normalizePaymentStatus(payload.status);
  const order = await assertPaymentMatchesOrder(payload);

  const [existingPayment] = await db
    .select()
    .from(payments)
    .where(eq(payments.providerPaymentId, String(payload.id)))
    .limit(1);

  if (existingPayment) {
    await db
      .update(payments)
      .set({
        status,
        metadata: payload as unknown as Record<string, unknown>,
        updatedAt: new Date()
      })
      .where(eq(payments.id, existingPayment.id));
  } else {
    await db.insert(payments).values({
      orderId: order.id,
      provider: "mercado_pago",
      status,
      amount: Number(payload.transaction_amount ?? 0),
      currency: payload.currency_id ?? env.MERCADO_PAGO_CURRENCY_ID,
      providerPaymentId: String(payload.id),
      metadata: payload as unknown as Record<string, unknown>
    });
  }

  if (status === "approved") {
    await db.update(orders).set({ status: "paid", updatedAt: new Date() }).where(eq(orders.id, order.id));
  }

  return {
    provider_payment_id: String(payload.id),
    order_id: order.id,
    status
  };
}
