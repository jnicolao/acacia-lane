import { connection } from "next/server";
import { CheckoutForm } from "@/components/checkout-form";
import { isMockMode } from "@/lib/settings";

// This page shows live data, so it is fine for a navigation to wait for it.
export const instant = false;

export default async function CheckoutPage() {
  await connection(); // read the mock flag per request, not at build time
  return (
    <>
      <h1 className="mb-6 text-2xl font-semibold tracking-tight">Checkout</h1>
      <CheckoutForm mock={isMockMode()} />
    </>
  );
}
