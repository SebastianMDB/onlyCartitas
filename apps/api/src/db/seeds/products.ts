import type { Product } from "../../types.js";

const tcgplayerImage = (productId: number) =>
  `https://tcgplayer-cdn.tcgplayer.com/product/${productId}_in_1000x1000.jpg`;

const cardImage = (set: string, number: number) => `https://images.pokemontcg.io/${set}/${number}_hires.png`;

export const seedProducts: Product[] = [
  {
    id: "etb-journey",
    kind: "sealed",
    name: "Journey Together Elite Trainer Box",
    category: "Elite Trainer Box",
    set: "Journey Together",
    language: "english",
    stock: 4,
    price: 54990,
    previousPrice: 64990,
    offer: "Oferta",
    image: tcgplayerImage(610950),
    active: true
  },
  {
    id: "etb-prismatic",
    kind: "sealed",
    name: "Prismatic Evolutions Elite Trainer Box",
    category: "Elite Trainer Box",
    set: "Prismatic Evolutions",
    language: "english",
    stock: 2,
    price: 59990,
    image: tcgplayerImage(593355),
    active: true
  },
  {
    id: "booster-journey",
    kind: "sealed",
    name: "Temporal Forces Booster Pack",
    category: "Sobres",
    set: "Temporal Forces",
    language: "english",
    stock: 8,
    price: 5990,
    previousPrice: 6990,
    offer: "Oferta",
    image: tcgplayerImage(532841),
    active: true
  },
  {
    id: "box-journey",
    kind: "sealed",
    name: "Journey Together Booster Bundle",
    category: "Cajas",
    set: "Journey Together",
    language: "english",
    stock: 3,
    price: 164990,
    previousPrice: 179990,
    offer: "Oferta",
    image: tcgplayerImage(610953),
    active: true
  },
  {
    id: "bundle-starter",
    kind: "sealed",
    name: "Journey Together Booster Bundle",
    category: "Pokemon TCG Bundles",
    set: "Journey Together",
    language: "english",
    stock: 3,
    price: 39990,
    previousPrice: 45990,
    offer: "Oferta",
    image: tcgplayerImage(610953),
    active: true
  },
  {
    id: "single-pikachu-ex",
    kind: "single",
    name: "Iono's Bellibolt ex Special Illustration",
    category: "Full Art",
    set: "Journey Together",
    language: "english",
    stock: 2,
    price: 24990,
    previousPrice: 29990,
    offer: "Oferta",
    image: cardImage("sv9", 183),
    active: true,
    rarity: "illustration-rare",
    playability: "medium",
    marketPrice: 24990,
    manualSegment: "hits",
    illustrator: "aky CG Works"
  },
  {
    id: "single-umbreon-graded",
    kind: "single",
    name: "N's Zoroark ex Special Illustration",
    category: "Graded",
    set: "Journey Together",
    language: "japanese",
    stock: 1,
    price: 349990,
    image: cardImage("sv9", 185),
    active: true,
    rarity: "special-illustration-rare",
    playability: "low",
    marketPrice: 349990,
    manualSegment: "hits",
    illustrator: "Mitsuhiro Arita"
  },
  {
    id: "single-charizard",
    kind: "single",
    name: "N's Zoroark ex",
    category: "Pokemon",
    set: "Journey Together",
    language: "english",
    stock: 4,
    price: 18990,
    image: cardImage("sv9", 98),
    active: true,
    rarity: "ultra-rare",
    playability: "high",
    marketPrice: 18990,
    manualSegment: "staples",
    illustrator: "PLANETA Mochizuki"
  }
];
