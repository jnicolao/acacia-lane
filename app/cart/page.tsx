"use client";

import Image from "next/image";
import Link from "next/link";
import { QuantityStepper } from "@/components/add-to-cart";
import { useCart } from "@/components/use-cart";
import { kes } from "@/lib/format";

export default function CartPage() {
  const { loaded, lines, subtotal } = useCart();

  return (
    <>
      <h1 className="mb-6 text-2xl font-semibold tracking-tight">Your cart</h1>
      {!loaded ? null : lines.length === 0 ? (
        <p className="text-stone-600">
          Your cart is empty.{" "}
          <Link href="/" className="font-medium text-emerald-700 underline">
            Browse the shop
          </Link>
        </p>
      ) : (
        <div className="rounded-xl border border-stone-200 bg-white">
          <ul className="divide-y divide-stone-200">
            {lines.map(({ product, quantity }) => (
              <li key={product.id} className="flex items-center gap-3 p-4 min-[480px]:gap-4">
                <Image
                  src={product.image}
                  alt=""
                  width={56}
                  height={56}
                  className="size-14 shrink-0 rounded-lg object-cover"
                />
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{product.name}</p>
                  <p className="text-sm text-stone-600">{kes(product.price)} each</p>
                </div>
                {/* On a phone the line total sits under the stepper, so the name keeps its room. */}
                <div className="flex shrink-0 flex-col items-end gap-1.5 min-[480px]:flex-row min-[480px]:items-center min-[480px]:gap-4">
                  <QuantityStepper
                    productId={product.id}
                    name={product.name}
                    quantity={quantity}
                  />
                  <span className="text-right font-medium tabular-nums min-[480px]:w-24">
                    {kes(product.price * quantity)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
          <div className="flex items-center justify-between border-t border-stone-200 p-4">
            <span className="text-stone-600">
              Items subtotal{" "}
              <span className="font-semibold text-stone-900">{kes(subtotal)}</span>
            </span>
            <Link
              href="/checkout"
              className="rounded-md bg-emerald-700 px-4 py-2 text-sm font-semibold text-white transition-[transform,background-color] duration-150 ease-out hover:bg-emerald-800 active:scale-[0.97]"
            >
              Checkout
            </Link>
          </div>
        </div>
      )}
    </>
  );
}
