import { relations } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid
} from "drizzle-orm/pg-core";

export const deliveryModeEnum = pgEnum("delivery_mode", ["retiro", "envio"]);
export const discountTypeEnum = pgEnum("discount_type", ["percent", "fixed"]);
export const orderStatusEnum = pgEnum("order_status", ["pending", "paid", "preparing", "shipped", "completed", "cancelled"]);
export const paymentProviderEnum = pgEnum("payment_provider", ["mercado_pago"]);
export const paymentStatusEnum = pgEnum("payment_status", ["created", "pending", "approved", "rejected", "cancelled", "refunded"]);
export const productKindEnum = pgEnum("product_kind", ["sealed", "single"]);
export const productLanguageEnum = pgEnum("product_language", ["japanese", "spanish", "english"]);
export const userRoleEnum = pgEnum("user_role", ["admin", "customer"]);

export const products = pgTable(
  "products",
  {
    id: text("id").primaryKey(),
    kind: productKindEnum("kind").notNull(),
    name: text("name").notNull(),
    category: text("category").notNull(),
    description: text("description"),
    set: text("set").notNull(),
    language: productLanguageEnum("language").notNull(),
    stock: integer("stock").notNull().default(0),
    variants: jsonb("variants").$type<Array<{ id: string; name: string; stock: number; active: boolean }>>(),
    price: numeric("price", { precision: 10, scale: 2, mode: "number" }).notNull(),
    previousPrice: numeric("previous_price", { precision: 10, scale: 2, mode: "number" }),
    image: text("image").notNull(),
    offer: text("offer"),
    active: boolean("active").notNull().default(true),
    illustrator: text("illustrator"),
    rarity: text("rarity"),
    playability: text("playability"),
    marketPrice: numeric("market_price", { precision: 10, scale: 2, mode: "number" }),
    manualSegment: text("manual_segment"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    kindIdx: index("products_kind_idx").on(table.kind),
    categoryIdx: index("products_category_idx").on(table.category),
    activeIdx: index("products_active_idx").on(table.active)
  })
);

export const appUsers = pgTable(
  "app_users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    username: text("username").notNull(),
    passwordHash: text("password_hash").notNull(),
    role: userRoleEnum("role").notNull().default("customer"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    usernameUnique: uniqueIndex("app_users_username_unique").on(table.username)
  })
);

export const orders = pgTable(
  "orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").references(() => appUsers.id, { onDelete: "set null" }),
    customerName: text("customer_name").notNull(),
    customerEmail: text("customer_email").notNull(),
    customerPhone: text("customer_phone"),
    deliveryMode: deliveryModeEnum("delivery_mode").notNull(),
    address: text("address"),
    subtotal: numeric("subtotal", { precision: 10, scale: 2, mode: "number" }).notNull(),
    shipping: numeric("shipping", { precision: 10, scale: 2, mode: "number" }).notNull(),
    discount: numeric("discount", { precision: 10, scale: 2, mode: "number" }).notNull().default(0),
    discountCode: text("discount_code"),
    total: numeric("total", { precision: 10, scale: 2, mode: "number" }).notNull(),
    status: orderStatusEnum("status").notNull().default("pending"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    userIdIdx: index("orders_user_id_idx").on(table.userId),
    statusIdx: index("orders_status_idx").on(table.status),
    createdAtIdx: index("orders_created_at_idx").on(table.createdAt)
  })
);

export const discountCodes = pgTable(
  "discount_codes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    code: text("code").notNull(),
    type: discountTypeEnum("type").notNull(),
    value: numeric("value", { precision: 10, scale: 2, mode: "number" }).notNull(),
    active: boolean("active").notNull().default(true),
    startsAt: timestamp("starts_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    maxUses: integer("max_uses"),
    usedCount: integer("used_count").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    codeUnique: uniqueIndex("discount_codes_code_unique").on(table.code),
    activeIdx: index("discount_codes_active_idx").on(table.active)
  })
);

export const orderItems = pgTable(
  "order_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
    productId: text("product_id").references(() => products.id, { onDelete: "set null" }),
    variantId: text("variant_id"),
    variantName: text("variant_name"),
    name: text("name").notNull(),
    quantity: integer("quantity").notNull(),
    unitPrice: numeric("unit_price", { precision: 10, scale: 2, mode: "number" }).notNull(),
    subtotal: numeric("subtotal", { precision: 10, scale: 2, mode: "number" }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    orderIdIdx: index("order_items_order_id_idx").on(table.orderId),
    productIdIdx: index("order_items_product_id_idx").on(table.productId)
  })
);

export const payments = pgTable(
  "payments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
    provider: paymentProviderEnum("provider").notNull(),
    status: paymentStatusEnum("status").notNull().default("created"),
    amount: numeric("amount", { precision: 10, scale: 2, mode: "number" }).notNull(),
    currency: text("currency").notNull(),
    providerPreferenceId: text("provider_preference_id"),
    providerPaymentId: text("provider_payment_id"),
    checkoutUrl: text("checkout_url"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    orderIdIdx: index("payments_order_id_idx").on(table.orderId),
    providerPaymentIdIdx: index("payments_provider_payment_id_idx").on(table.providerPaymentId),
    statusIdx: index("payments_status_idx").on(table.status)
  })
);

export const siteSettings = pgTable("site_settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").$type<Record<string, unknown>>().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
});

export const usersRelations = relations(appUsers, ({ many }) => ({
  orders: many(orders)
}));

export const productsRelations = relations(products, ({ many }) => ({
  orderItems: many(orderItems)
}));

export const ordersRelations = relations(orders, ({ one, many }) => ({
  user: one(appUsers, {
    fields: [orders.userId],
    references: [appUsers.id]
  }),
  items: many(orderItems),
  payments: many(payments)
}));

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, {
    fields: [orderItems.orderId],
    references: [orders.id]
  }),
  product: one(products, {
    fields: [orderItems.productId],
    references: [products.id]
  })
}));

export const paymentsRelations = relations(payments, ({ one }) => ({
  order: one(orders, {
    fields: [payments.orderId],
    references: [orders.id]
  })
}));
