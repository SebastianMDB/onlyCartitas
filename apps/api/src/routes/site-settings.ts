import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { ApiError } from "../http.js";
import { getHeroSettings, updateHeroSettings } from "../repositories/site-settings.js";
import { verifySessionToken } from "../security/tokens.js";

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

const requireAdmin = (authorization: string | undefined) => {
  const session = verifySessionToken(authorization);
  if (session?.role !== "admin") throw new ApiError(403, "Permisos insuficientes");
};

export async function siteSettingsRoutes(app: FastifyInstance) {
  app.get("/api/site-settings/hero", async () => {
    const data = await getHeroSettings();
    return { data };
  });

  app.patch("/api/admin/site-settings/hero", async (request) => {
    requireAdmin(request.headers.authorization);
    const input = heroSettingsSchema.parse(request.body);
    const data = await updateHeroSettings(input);
    return { data };
  });
}
