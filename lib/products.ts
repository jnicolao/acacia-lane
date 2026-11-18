import type { OrderLine } from "./db";
import type { IntegrationOrderItem } from "./types";

export type Product = {
  id: string;
  sku: string;
  name: string;
  description: string;
  price: number; // KES
  parcelClass: IntegrationOrderItem["parcelClass"];
  // A JPEG under public/: shown in the shop and sent to PickSpot with an
  // order. Photo credits are in the README.
  image: string;
};

export const products: Product[] = [
  {
    id: "coffee",
    sku: "AL-COF-500",
    name: "Highland AA Coffee, 500 g",
    description: "Medium roast whole beans from the slopes of Mount Kenya.",
    price: 1450,
    parcelClass: "SMALL",
    image: "/products/coffee.jpg",
  },
  {
    id: "tea",
    sku: "AL-TEA-250",
    name: "Purple Leaf Tea, 250 g",
    description: "Loose-leaf purple tea, bright and lightly floral.",
    price: 850,
    parcelClass: "SMALL",
    image: "/products/tea.jpg",
  },
  {
    id: "honey",
    sku: "AL-HON-1KG",
    name: "Wildflower Honey, 1 kg",
    description: "Raw, unfiltered honey from acacia woodland hives.",
    price: 1200,
    parcelClass: "SMALL",
    image: "/products/honey.jpg",
  },
  {
    id: "basket",
    sku: "AL-BSK-M",
    name: "Handwoven Sisal Basket",
    description: "A sturdy handwoven market basket with two handles.",
    price: 2800,
    parcelClass: "MEDIUM",
    image: "/products/basket.jpg",
  },
  {
    id: "blanket",
    sku: "AL-BLK-RED",
    name: "Checked Shuka Blanket",
    description: "Warm woven throw in a bright red check, 150 × 200 cm.",
    price: 2400,
    parcelClass: "MEDIUM",
    image: "/products/blanket.jpg",
  },
  {
    id: "stool",
    sku: "AL-STL-ACA",
    name: "Carved Acacia Stool",
    description: "Solid hand-carved stool, 45 cm tall.",
    price: 6500,
    parcelClass: "LARGE",
    image: "/products/stool.jpg",
  },
];

export type CartItem = { productId: string; quantity: number };

// Turns what the browser sent into order lines priced from the catalogue.
// Returns null when the cart is empty or anything in it is not valid.
export function cartToLines(items: unknown): OrderLine[] | null {
  if (!Array.isArray(items) || items.length === 0) return null;
  const lines: OrderLine[] = [];
  for (const item of items as Partial<CartItem>[]) {
    const product = products.find((p) => p.id === item?.productId);
    const quantity = item?.quantity;
    if (!product || !Number.isInteger(quantity) || quantity! < 1) return null;
    lines.push({
      productId: product.id,
      name: product.name,
      quantity: quantity!,
      unitPrice: product.price,
    });
  }
  return lines;
}

export function linesToPickspotItems(lines: OrderLine[]): IntegrationOrderItem[] {
  return lines.map((line) => {
    const product = products.find((p) => p.id === line.productId)!;
    return {
      description: line.name,
      quantity: line.quantity,
      unitValue: line.unitPrice,
      currency: "KES",
      sku: product.sku,
      parcelClass: product.parcelClass,
      ...(line.imageKey && { imageKeys: [line.imageKey] }),
    };
  });
}
