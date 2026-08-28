export type ProductLanguage = "japanese" | "spanish" | "english";
export type ProductKind = "sealed" | "single";

export type ProductVariant = {
  id: string;
  name: string;
  stock: number;
  active: boolean;
};

export type Product = {
  id: string;
  kind: ProductKind;
  name: string;
  category: string;
  description?: string | null;
  set: string;
  language: ProductLanguage;
  stock: number;
  variants?: ProductVariant[] | null;
  price: number;
  previousPrice?: number | null;
  image: string;
  offer?: string | null;
  active: boolean;
  illustrator?: string | null;
  rarity?: string | null;
  playability?: string | null;
  marketPrice?: number | null;
  manualSegment?: string | null;
};

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

export const productLanguages: Array<{ value: ProductLanguage; label: string }> = [
  { value: "japanese", label: "Japones" },
  { value: "spanish", label: "Espanol" },
  { value: "english", label: "Ingles" }
];

export const productCategories: Record<ProductKind, string[]> = {
  sealed: [
    "Elite Trainer Box",
    "Booster Box",
    "Booster Bundle",
    "Sobres",
    "Cajas",
    "Pokemon TCG Bundles",
    "UPC",
    "Colecciones",
    "Latas",
    "Accesorios"
  ],
  single: [
    "Pokemon",
    "Trainer",
    "Energy",
    "Full Art",
    "Illustration Rare",
    "Special Illustration Rare",
    "Secret Rare",
    "Graded"
  ]
};

const apiBaseUrl = import.meta.env.PUBLIC_API_URL ?? "http://localhost:3000";

type ProductFilters = {
  kind?: ProductKind;
  offer?: boolean;
  includeInactive?: boolean;
};

export const fetchProducts = async (filters: ProductFilters = {}): Promise<Product[]> => {
  const url = new URL("/api/products", apiBaseUrl);

  if (filters.kind) url.searchParams.set("kind", filters.kind);
  if (filters.offer !== undefined) url.searchParams.set("offer", String(filters.offer));
  if (filters.includeInactive !== undefined) {
    url.searchParams.set("includeInactive", String(filters.includeInactive));
  }

  try {
    const response = await fetch(url);
    if (!response.ok) return [];

    const payload = await response.json();
    return Array.isArray(payload.data) ? payload.data : [];
  } catch {
    return [];
  }
};

export const fetchHeroSettings = async (): Promise<HeroSettings | null> => {
  try {
    const response = await fetch(new URL("/api/site-settings/hero", apiBaseUrl));
    if (!response.ok) return null;

    const payload = await response.json();
    return payload.data ?? null;
  } catch {
    return null;
  }
};

export const uniqueValues = (values: Array<string | null | undefined>) =>
  Array.from(new Set(values.filter((value): value is string => Boolean(value)))).sort();

export const serializeJsonForInlineScript = (value: unknown) => JSON.stringify(value).replaceAll("<", "\\u003C");

export const categoriesFromProducts = (products: Product[]) =>
  uniqueValues(products.map((product) => product.category));
