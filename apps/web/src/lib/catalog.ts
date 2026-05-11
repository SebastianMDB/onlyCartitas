export type ProductLanguage = "japanese" | "spanish" | "english";
export type ProductKind = "sealed" | "single";

export type Product = {
  id: string;
  kind: ProductKind;
  name: string;
  category: string;
  set: string;
  language: ProductLanguage;
  stock: number;
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

export const productLanguages: Array<{ value: ProductLanguage; label: string }> = [
  { value: "japanese", label: "Japones" },
  { value: "spanish", label: "Espanol" },
  { value: "english", label: "Ingles" }
];

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

export const uniqueValues = (values: Array<string | null | undefined>) =>
  Array.from(new Set(values.filter((value): value is string => Boolean(value)))).sort();

export const categoriesFromProducts = (products: Product[]) =>
  uniqueValues(products.map((product) => product.category));
