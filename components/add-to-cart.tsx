"use client";

import { setQuantity, useCart } from "./use-cart";

const STEP =
  "grid size-7 place-items-center rounded-full text-base leading-none text-stone-600 transition-[transform,background-color] duration-150 ease-out hover:bg-stone-100 active:scale-90";

// The − 1 + control used on product cards and in the cart. Going below 1
// removes the product from the cart.
export function QuantityStepper(props: {
  productId: string;
  name: string;
  quantity: number;
}) {
  const { productId, name, quantity } = props;
  return (
    <div className="flex h-8 shrink-0 items-center justify-between rounded-full border border-stone-200 bg-white px-px text-xs font-medium">
      <button
        type="button"
        aria-label={`Remove one ${name}`}
        onClick={() => setQuantity(productId, quantity - 1)}
        className={STEP}
      >
        −
      </button>
      <span className="min-w-4 text-center tabular-nums" aria-live="polite">
        {quantity}
      </span>
      <button
        type="button"
        aria-label={`Add one more ${name}`}
        onClick={() => setQuantity(productId, quantity + 1)}
        className={STEP}
      >
        +
      </button>
    </div>
  );
}

// "Add to cart" until the product is in the cart, then the stepper.
export function AddToCart({ productId, name }: { productId: string; name: string }) {
  const { lines } = useCart();
  const inCart = lines.find((l) => l.product.id === productId)?.quantity ?? 0;

  if (inCart > 0) {
    return <QuantityStepper productId={productId} name={name} quantity={inCart} />;
  }
  return (
    <button
      type="button"
      aria-label={`Add ${name} to cart`}
      onClick={() => setQuantity(productId, 1)}
      className="h-8 shrink-0 rounded-full bg-emerald-700 px-3.5 text-xs font-medium text-white transition-[transform,background-color] duration-150 ease-out hover:bg-emerald-800 active:scale-[0.97]"
    >
      Add to cart
    </button>
  );
}
