import { z } from "zod";

const trimTrailingSlashes = (value: unknown) => (typeof value === "string" ? value.replace(/\/+$/, "") : value);

const envSchema = z
  .object({
    NODE_ENV: z.string().default("development"),
    PORT: z.coerce.number().int().positive().default(3000),
    WEB_ORIGIN: z.preprocess(trimTrailingSlashes, z.string().default("http://localhost:4321")),
    API_SECRET: z.string().default("dev-onlycartitas-secret"),
    SESSION_TTL_SECONDS: z.coerce.number().int().positive().default(60 * 60 * 24 * 7),
    AUTH_REGISTER_ENABLED: z.coerce.boolean().default(true),
    DATABASE_URL: z.string().url(),
    API_PUBLIC_URL: z.preprocess(trimTrailingSlashes, z.string().url().optional().or(z.literal(""))),
    MERCADO_PAGO_ACCESS_TOKEN: z.string().optional().or(z.literal("")),
    MERCADO_PAGO_CURRENCY_ID: z.string().default("CLP"),
    MERCADO_PAGO_CHECKOUT_MODE: z.enum(["sandbox", "production"]).default("sandbox")
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV !== "production") return;

    if (!env.API_SECRET || env.API_SECRET === "dev-onlycartitas-secret" || env.API_SECRET === "change-me") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["API_SECRET"],
        message: "API_SECRET debe ser un secreto fuerte en produccion"
      });
    }

    if (env.API_SECRET.length < 32) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["API_SECRET"],
        message: "API_SECRET debe tener al menos 32 caracteres en produccion"
      });
    }

    if (env.WEB_ORIGIN === "*") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["WEB_ORIGIN"],
        message: "WEB_ORIGIN no puede ser * en produccion"
      });
    }

    if (env.MERCADO_PAGO_CHECKOUT_MODE === "production") {
      if (!env.MERCADO_PAGO_ACCESS_TOKEN) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["MERCADO_PAGO_ACCESS_TOKEN"],
          message: "MERCADO_PAGO_ACCESS_TOKEN es obligatorio con Mercado Pago en produccion"
        });
      }

      if (!env.API_PUBLIC_URL || !env.API_PUBLIC_URL.startsWith("https://")) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["API_PUBLIC_URL"],
          message: "API_PUBLIC_URL debe ser https en produccion"
        });
      }
    }
  });

export const env = envSchema.parse(process.env);
