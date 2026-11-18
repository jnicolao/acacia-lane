"use client";

import { useMemo, useSyncExternalStore } from "react";
import { products, type CartItem } from "@/lib/products";

// The cart lives in the browser's localStorage as { productId: quantity }.
const KEY = "cart";
type Cart = Record<string, number>;

const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

function parse(raw: string | null): Cart {
  try {
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

const read = () => localStorage.getItem(KEY);

function write(cart: Cart) {
  localStorage.setItem(KEY, JSON.stringify(cart));
  listeners.forEach((listener) => listener());
}

export function setQuantity(productId: string, quantity: number) {
  const cart = parse(read());
  if (quantity > 0) cart[productId] = quantity;
  else delete cart[productId];
  write(cart);
}

export function clearCart() {
  write({});
}

// `loaded` is false on the server and until the browser has read the cart, so
// pages can avoid flashing "your cart is empty".
export function useCart() {
  const raw = useSyncExternalStore(subscribe, read, () => undefined);
  return useMemo(() => {
    const cart = parse(raw ?? null);
    const lines = products
      .filter((product) => cart[product.id] > 0)
      .map((product) => ({ product, quantity: cart[product.id] }));
    const items: CartItem[] = lines.map((line) => ({
      productId: line.product.id,
      quantity: line.quantity,
    }));
    return {
      loaded: raw !== undefined,
      lines,
      items,
      count: lines.reduce((sum, line) => sum + line.quantity, 0),
      subtotal: lines.reduce((sum, l) => sum + l.quantity * l.product.price, 0),
    };
  }, [raw]);
}
