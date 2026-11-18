import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { AutoRefresh } from "@/components/auto-refresh";
import { StatusBadge } from "@/components/status-badge";
import { readDb } from "@/lib/db";
import { kes } from "@/lib/format";
import { formatPhone } from "@/lib/phone";
import type { OrderStatus } from "@/lib/types";

// What the buyer should do or expect at each status.
const NEXT_STEP: Record<OrderStatus, string> = {
  AWAITING_RECIPIENT:
    "Check WhatsApp: PickSpot is sending you a link. Open it and tell PickSpot where to deliver; you then see the total and pay by M-Pesa.",
  AWAITING_APPROVAL:
    "Almost there: approve the order in PickSpot and pay the total by M-Pesa. Nothing has been charged yet.",
  AWAITING_PAYMENT: "Check your phone: an M-Pesa prompt is waiting for your PIN.",
  PAYMENT_FAILED:
    "The M-Pesa payment did not go through. You can try again from the PickSpot app.",
  PAID: "Payment received. PickSpot is finding a rider.",
  SCHEDULED: "Payment received. The rider pickup is scheduled.",
  DISPATCHED: "A rider has been sent to collect your order from the shop.",
  IN_TRANSIT: "Your order is on its way to you.",
  DELIVERED: "Your order was delivered. Enjoy!",
  RETURNED: "The parcel was returned to the shop.",
  CANCELLED: "This order was cancelled.",
  REJECTED: "This order was declined in the PickSpot app.",
  EXPIRED: "This order expired before it was approved.",
  UNKNOWN: "We are arranging your delivery with PickSpot.",
};

// This page shows live data, so it is fine for a navigation to wait for it.
export const instant = false;

export default async function OrderConfirmation({
  params,
}: PageProps<"/orders/[reference]">) {
  await connection(); // always render from the data as it is now
  const { reference } = await params;
  const order = readDb().orders.find((o) => o.reference === reference);
  if (!order) notFound();

  const { pickspot } = order;
  // Older orders were placed with a PickSpot address instead of a number.
  const contact = order.recipient.phone
    ? formatPhone(order.recipient.phone)
    : (order.recipient.handle ?? "—");
  const pricing = pickspot?.pricing;
  const itemsTotal = order.lines.reduce((sum, l) => sum + l.quantity * l.unitPrice, 0);

  return (
    <div className="mx-auto max-w-2xl">
      <AutoRefresh catchUp={order.reference} />
      <h1 className="text-2xl font-semibold tracking-tight">Thank you! Your order is placed.</h1>
      <p className="mt-1 text-stone-600">
        Order <span className="font-mono font-semibold">{order.reference}</span>
      </p>

      <section className="mt-6 rounded-xl border-2 border-emerald-700 bg-emerald-50 p-5">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="font-semibold text-emerald-950">What happens next</h2>
          <StatusBadge status={order.status} />
        </div>
        <p className="mt-2 text-emerald-950">{NEXT_STEP[order.status]}</p>
        {order.status === "AWAITING_RECIPIENT" && pickspot?.claim?.claimUrl && (
          <p className="mt-3 text-sm">
            Sent to <strong>{contact}</strong>. No message?{" "}
            <a
              href={pickspot.claim.claimUrl}
              className="font-semibold text-emerald-800 underline"
            >
              Open the link here
            </a>
          </p>
        )}
        {pickspot?.dispatch?.trackingUrl && (
          <p className="mt-3 text-sm">
            <a
              href={pickspot.dispatch.trackingUrl}
              className="font-semibold text-emerald-800 underline"
            >
              Track the rider
            </a>
          </p>
        )}
      </section>

      <section className="mt-6 rounded-xl border border-stone-200 bg-white p-5 text-sm">
        <h2 className="font-semibold">Order summary</h2>
        <ul className="mt-3 space-y-2">
          {order.lines.map((line) => (
            <li key={line.productId} className="flex justify-between gap-3">
              <span>
                {line.quantity} × {line.name}
              </span>
              <span className="tabular-nums">{kes(line.quantity * line.unitPrice)}</span>
            </li>
          ))}
        </ul>
        <dl className="mt-4 space-y-1 border-t border-stone-200 pt-4">
          <Row label="Items" value={kes(itemsTotal)} />
          <Row label="Delivery fee" value={amount(pricing?.deliveryFee)} />
          <Row label="Service fee" value={amount(pricing?.platformFee)} />
          <Row label="Total, paid by M-Pesa in PickSpot" value={amount(pricing?.total)} />
          <Row label="WhatsApp number" value={contact} />
        </dl>
      </section>

      <p className="mt-6 text-sm">
        <Link href="/" className="font-medium text-emerald-700 underline">
          Back to the shop
        </Link>
      </p>
    </div>
  );
}

const amount = (value: number | null | undefined) =>
  typeof value === "number" ? kes(value) : "Shown in PickSpot";

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-stone-600">{label}</dt>
      <dd className="text-right tabular-nums">{value}</dd>
    </div>
  );
}
