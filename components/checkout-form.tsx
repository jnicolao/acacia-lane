"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { kes } from "@/lib/format";
import { formatPhone, normalizePhone } from "@/lib/phone";
import { clearCart, useCart } from "./use-cart";

// What the shopper is told when an order cannot be placed. The reason PickSpot
// gave is for the shop owner: the server writes it to its log.
function problemText(status: number): string {
  if (status === 400) {
    return "We could not place your order. Check your WhatsApp number and try again.";
  }
  if (status === 429) {
    return "We are getting a lot of orders right now. Please try again in a moment.";
  }
  if (status === 401 || status === 403) {
    return "Sorry, we cannot take orders right now. Please try again later.";
  }
  return "Something went wrong and your order was not placed. Please try again.";
}

const STEPS = [
  "We send a link to your WhatsApp.",
  "Open it and tell PickSpot where to deliver.",
  "Pay the total by M-Pesa. A rider brings your order.",
];

export function CheckoutForm({ mock }: { mock: boolean }) {
  const router = useRouter();
  const { loaded, lines, items, subtotal } = useCart();
  const input = useRef<HTMLInputElement>(null);

  const [value, setValue] = useState("");
  // The "not a phone number" message waits until the buyer leaves the field
  // or tries to order, so it does not nag while they are still typing.
  const [checked, setChecked] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const phone = normalizePhone(value);
  const invalid = checked && !phone;

  async function placeOrder(event: React.FormEvent) {
    event.preventDefault();
    setChecked(true);
    if (!phone) return input.current?.focus();

    setProblem(null);
    setBusy(true);
    let result: { ok: true; reference: string } | { ok: false; status: number };
    try {
      const response = await fetch("/api/checkout/orders", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ items, phone }),
      });
      result = await response.json();
    } catch {
      result = { ok: false, status: 0 };
    }
    if (result.ok) {
      clearCart();
      router.push(`/orders/${result.reference}`);
      return;
    }
    setBusy(false);
    setProblem(problemText(result.status));
  }

  if (!loaded) return null;
  if (lines.length === 0) {
    return (
      <p className="text-stone-600">
        Your cart is empty.{" "}
        <Link href="/" className="font-medium text-emerald-700 underline">
          Browse the shop
        </Link>
      </p>
    );
  }

  return (
    <form
      onSubmit={placeOrder}
      noValidate
      className="grid gap-6 lg:grid-cols-[1fr_20rem]"
    >
      <section className="rounded-xl border border-stone-200 bg-white p-5">
        <h2 className="font-semibold">Delivery and payment</h2>
        <div className="mt-3 rounded-lg border-2 border-emerald-700 bg-emerald-50 p-4">
          <p className="font-semibold text-emerald-900">◉ Deliver with PickSpot</p>
          <p className="mt-1 text-sm text-emerald-900/80">
            You pay nothing here. A rider brings the order to your door.
          </p>
          <ol className="mt-3 space-y-2 text-sm text-emerald-950">
            {STEPS.map((step, index) => (
              <li key={step} className="flex items-start gap-2.5">
                <span
                  className="grid size-5 shrink-0 place-items-center rounded-full bg-emerald-700 text-[11px] font-semibold text-white tabular-nums"
                  aria-hidden
                >
                  {index + 1}
                </span>
                {step}
              </li>
            ))}
          </ol>
        </div>

        <label htmlFor="whatsapp" className="mt-5 block text-sm font-medium">
          WhatsApp number
        </label>
        <input
          ref={input}
          id="whatsapp"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="0712 345 678"
          value={value}
          disabled={busy}
          onChange={(event) => {
            setValue(event.target.value);
            setProblem(null);
          }}
          onBlur={() => setChecked(value.trim() !== "")}
          aria-invalid={invalid}
          aria-describedby="whatsapp-hint"
          className={`mt-1.5 w-full rounded-md border px-3 py-2.5 text-base transition-colors duration-150 focus:outline-none sm:max-w-xs ${
            invalid
              ? "border-red-400 focus:border-red-600"
              : "border-stone-300 focus:border-emerald-700"
          }`}
        />
        <p
          id="whatsapp-hint"
          aria-live="polite"
          className={`mt-1.5 text-sm ${
            invalid ? "text-red-700" : phone ? "text-emerald-800" : "text-stone-500"
          }`}
        >
          {invalid
            ? "Enter a mobile number, like 0712 345 678 or +254 712 345 678."
            : phone
              ? `The link goes to ${formatPhone(phone)} on WhatsApp.`
              : "Use the number you have WhatsApp on: the link is sent there."}
        </p>

        {mock && (
          <p className="mt-4 rounded-md bg-amber-100 p-3 text-xs text-amber-950">
            <strong>Practice mode.</strong> Any mobile number works and no
            message is really sent. A number ending in 000 stands for a
            customer who already uses PickSpot.
          </p>
        )}

        {problem && (
          <p
            role="alert"
            className="mt-4 rounded-lg border border-red-300 bg-red-50 p-4 text-sm"
          >
            {problem}
          </p>
        )}
      </section>

      <aside className="h-fit rounded-xl border border-stone-200 bg-white p-5">
        <h2 className="font-semibold">Order summary</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {lines.map(({ product, quantity }) => (
            <li key={product.id} className="flex justify-between gap-3">
              <span>
                {quantity} × {product.name}
              </span>
              <span className="shrink-0 tabular-nums">{kes(product.price * quantity)}</span>
            </li>
          ))}
        </ul>
        <dl className="mt-4 space-y-1 border-t border-stone-200 pt-4 text-sm">
          <div className="flex justify-between gap-3 font-semibold">
            <dt>Items</dt>
            <dd className="tabular-nums">{kes(subtotal)}</dd>
          </div>
          <div className="flex justify-between gap-3 text-stone-600">
            <dt>Delivery and service fee</dt>
            <dd className="text-right">Shown before you pay</dd>
          </div>
        </dl>
        <p className="mt-2 text-xs text-stone-500">
          PickSpot shows the fees and the total once it knows your address. You
          pay there by M-Pesa, not here.
        </p>
        <button
          type="submit"
          disabled={busy}
          className="mt-5 w-full rounded-md bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white transition-[transform,background-color] duration-150 ease-out hover:bg-emerald-800 active:scale-[0.98] disabled:opacity-40"
        >
          {busy ? "Placing order…" : "Place order"}
        </button>
      </aside>
    </form>
  );
}
