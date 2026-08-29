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
  previousPrice?: number;
  image: string;
  offer?: string;
  active: boolean;
  illustrator?: string;
  rarity?: string;
  playability?: string;
  marketPrice?: number;
  manualSegment?: string;
};

export type CartItem = Pick<
  Product,
  "id" | "name" | "category" | "set" | "language" | "stock" | "price" | "image"
> & {
  variantId?: string;
  variantName?: string;
  quantity: number;
};

export type AuthUser = {
  id: string;
  username: string;
  email: string | null;
  role: "admin" | "customer";
  sessionVersion: number;
};
