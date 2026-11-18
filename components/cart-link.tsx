"use client";

import Link from "next/link";
import { useCart } from "./use-cart";

export function CartLink() {
  const { count } = useCart();
  return (
    <Link href="/cart" className="hover:text-emerald-700">
      Cart
      {count > 0 && (
        <span className="ml-1.5 rounded-full bg-emerald-700 px-2 py-0.5 text-xs text-white">
          {count}
        </span>
      )}
    </Link>
  );
}
