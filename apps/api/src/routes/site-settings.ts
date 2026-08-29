import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { getCatalogOptions, getHeroSettings, updateCatalogOptions, updateHeroSettings } from "../repositories/site-settings.js";
import { requireAdmin } from "../security/auth.js";

const optionalText = (max = 240) => z.string().trim().max(max).optional();
const pathOrUrl = z
  .string()
  .trim()
  .max(1000)
  .refine((value) => {
    if (!value) return true;
    if (value.startsWith("/")) return true;
    try {
      const url = new URL(value);
      return url.protocol === "https:" || url.protocol === "http:";
    } catch {
      return false;
    }
  }, "Debe ser una ruta local o URL valida")
  .optional();

const heroSettingsSchema = z.object({
  primaryBadge: optionalText(80),
  secondaryBadge: optionalText(80),
  title: optionalText(120),
  description: optionalText(400),
  launchSetName: optionalText(120),
  launchTitle: optionalText(120),
  launchLabel: optionalText(60),
  primaryCtaLabel: optionalText(80),
  primaryCtaHref: pathOrUrl,
  secondaryCtaLabel: optionalText(80),
  secondaryCtaHref: pathOrUrl,
  backgroundImageUrl: pathOrUrl
});

const optionListSchema = z.array(z.string().trim().min(1).max(120)).max(120).optional();
const catalogOptionsSchema = z.object({
  sets: optionListSchema,
  categories: optionListSchema,
  illustrators: optionListSchema
});

export async function siteSettingsRoutes(app: FastifyInstance) {
  app.get("/api/site-settings/hero", async (_request, reply) => {
    reply.header("Cache-Control", "public, max-age=300, s-maxage=1800, stale-while-revalidate=3600");
    const data = await getHeroSettings();
    return { data };
  });

  app.patch("/api/admin/site-settings/hero", async (request) => {
    await requireAdmin(request.headers.authorization);
    const input = heroSettingsSchema.parse(request.body);
    const data = await updateHeroSettings(input);
    return { data };
  });

  app.get("/api/site-settings/catalog-options", async (_request, reply) => {
    reply.header("Cache-Control", "public, max-age=300, s-maxage=1800, stale-while-revalidate=3600");
    const data = await getCatalogOptions();
    return { data };
  });

  app.patch("/api/admin/site-settings/catalog-options", async (request) => {
    await requireAdmin(request.headers.authorization);
    const input = catalogOptionsSchema.parse(request.body);
    const data = await updateCatalogOptions(input);
    return { data };
  });
}
