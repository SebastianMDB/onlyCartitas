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
  quantity: number;
};

export type AuthUser = {
  id: string;
  username: string;
  role: "admin" | "customer";
};
