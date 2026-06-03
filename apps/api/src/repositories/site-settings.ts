import { eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { siteSettings } from "../db/schema.js";
import { ApiError } from "../http.js";

export type HeroSettings = {
  primaryBadge: string;
  secondaryBadge: string;
  title: string;
  description: string;
  launchSetName: string;
  launchTitle: string;
  launchLabel: string;
  primaryCtaLabel: string;
  primaryCtaHref: string;
  secondaryCtaLabel: string;
  secondaryCtaHref: string;
  backgroundImageUrl: string;
};

export type CatalogOptions = {
  sets: string[];
  categories: string[];
  illustrators: string[];
};

export const defaultHeroSettings: HeroSettings = {
  primaryBadge: "Set destacado",
  secondaryBadge: "Catalogo",
  title: "Productos disponibles",
  description: "Disponible en OnlyCartitas. ETB, blisters, bundles y singles del set para reservar antes de que cambie el stock.",
  launchSetName: "Journey Together",
  launchTitle: "Catalogo OnlyCartitas",
  launchLabel: "Nuevo",
  primaryCtaLabel: "Ver lanzamiento",
  primaryCtaHref: "/sellados",
  secondaryCtaLabel: "Ver ofertas",
  secondaryCtaHref: "/ofertas",
  backgroundImageUrl: ""
};

const HERO_SETTINGS_KEY = "hero";
const CATALOG_OPTIONS_KEY = "catalog_options";

export const defaultCatalogOptions: CatalogOptions = {
  sets: [],
  categories: [],
  illustrators: []
};

const normalizeHeroSettings = (value: Record<string, unknown> | null | undefined): HeroSettings => ({
  ...defaultHeroSettings,
  ...(value ?? {})
});

const normalizeOptionList = (value: unknown) =>
  Array.isArray(value)
    ? Array.from(new Set(value.map((item) => String(item ?? "").trim()).filter(Boolean))).sort((a, b) =>
        a.localeCompare(b, "es")
      )
    : [];

const normalizeCatalogOptions = (value: Record<string, unknown> | null | undefined): CatalogOptions => ({
  sets: normalizeOptionList(value?.sets),
  categories: normalizeOptionList(value?.categories),
  illustrators: normalizeOptionList(value?.illustrators)
});

export async function getHeroSettings() {
  try {
    const [row] = await db.select().from(siteSettings).where(eq(siteSettings.key, HERO_SETTINGS_KEY)).limit(1);
    return normalizeHeroSettings(row?.value);
  } catch {
    throw new ApiError(500, "No se pudo obtener la configuracion del hero");
  }
}

export async function updateHeroSettings(input: Partial<HeroSettings>) {
  const currentSettings = await getHeroSettings();
  const nextSettings = {
    ...currentSettings,
    ...input
  };

  try {
    const [row] = await db
      .insert(siteSettings)
      .values({
        key: HERO_SETTINGS_KEY,
        value: nextSettings
      })
      .onConflictDoUpdate({
        target: siteSettings.key,
        set: {
          value: nextSettings,
          updatedAt: new Date()
        }
      })
      .returning();

    return normalizeHeroSettings(row?.value);
  } catch {
    throw new ApiError(500, "No se pudo actualizar la configuracion del hero");
  }
}

export async function getCatalogOptions() {
  try {
    const [row] = await db.select().from(siteSettings).where(eq(siteSettings.key, CATALOG_OPTIONS_KEY)).limit(1);
    return normalizeCatalogOptions(row?.value);
  } catch {
    throw new ApiError(500, "No se pudieron obtener las opciones del catalogo");
  }
}

export async function updateCatalogOptions(input: Partial<CatalogOptions>) {
  const currentSettings = await getCatalogOptions();
  const nextSettings = normalizeCatalogOptions({
    ...currentSettings,
    ...input
  });

  try {
    const [row] = await db
      .insert(siteSettings)
      .values({
        key: CATALOG_OPTIONS_KEY,
        value: nextSettings
      })
      .onConflictDoUpdate({
        target: siteSettings.key,
        set: {
          value: nextSettings,
          updatedAt: new Date()
        }
      })
      .returning();

    return normalizeCatalogOptions(row?.value);
  } catch {
    throw new ApiError(500, "No se pudieron actualizar las opciones del catalogo");
  }
}
