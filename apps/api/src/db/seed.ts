import "dotenv/config";
import { seedProducts } from "./seeds/products.js";
import { db } from "./client.js";
import { products } from "./schema.js";

let count = 0;

for (const product of seedProducts) {
  const values = {
    id: product.id,
    kind: product.kind,
    name: product.name,
    category: product.category,
    set: product.set,
    language: product.language,
    stock: product.stock,
    price: product.price,
    previousPrice: product.previousPrice ?? null,
    image: product.image,
    offer: product.offer ?? null,
    active: product.active,
    illustrator: product.illustrator ?? null,
    rarity: product.rarity ?? null,
    playability: product.playability ?? null,
    marketPrice: product.marketPrice ?? null,
    manualSegment: product.manualSegment ?? null,
    updatedAt: new Date()
  };

  await db
    .insert(products)
    .values(values)
    .onConflictDoUpdate({
      target: products.id,
      set: values
    });

  count += 1;
}

console.log(`Seed completado: ${count} productos sincronizados.`);
