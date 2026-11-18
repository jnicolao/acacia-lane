import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { CheckForUpdates, PracticePanel } from "@/components/admin-forms";
import { AutoRefresh } from "@/components/auto-refresh";
import { LocalOnly } from "@/components/local-only";
import { NoWebhookNotice } from "@/components/no-webhook-notice";
import { StatusBadge } from "@/components/status-badge";
import { readDb } from "@/lib/db";
import { dateTime, kes } from "@/lib/format";
import { isLocalRequest } from "@/lib/local-only";
import { formatPhone } from "@/lib/phone";
import { products } from "@/lib/products";
import { isMockMode } from "@/lib/settings";
import { orderHistory } from "@/lib/wording";

const WHATSAPP_MESSAGE = {
  pending: "On its way",
  sent: "Sent",
  failed: "Could not be sent",
} as const;

const money = (value: number | null | undefined) =>
  typeof value === "number" ? kes(value) : "Not known yet";

// This page shows live data, so it is fine for a navigation to wait for it.
export const instant = false;

export default async function AdminOrder({
  params,
}: PageProps<"/admin/orders/[reference]">) {
  await connection(); // always render from the data as it is now
  if (!(await isLocalRequest())) return <LocalOnly />;
  const { reference } = await params;
  const order = readDb().orders.find((o) => o.reference === reference);
  if (!order) notFound();

  const { pickspot } = order;
  const history = orderHistory(order.timeline).toReversed();
  const itemsTotal = order.lines.reduce((sum, l) => sum + l.quantity * l.unitPrice, 0);
  const scheduledFor = pickspot?.dispatch?.scheduledFor;
  const details: [string, React.ReactNode][] = [
    [
      "Customer's WhatsApp",
      order.recipient.phone ? formatPhone(order.recipient.phone) : order.recipient.handle,
    ],
    [
      "WhatsApp message",
      // Only matters until the customer has used the link.
      order.status === "AWAITING_RECIPIENT" &&
        pickspot?.claim?.whatsapp &&
        WHATSAPP_MESSAGE[pickspot.claim.whatsapp],
    ],
    ["Items", kes(itemsTotal)],
    ["Delivery fee", money(pickspot?.pricing?.deliveryFee)],
    ["Service fee", money(pickspot?.pricing?.platformFee)],
    ["Customer pays", money(pickspot?.pricing?.total)],
    ["PickSpot parcel number", pickspot?.parcelCode],
    ["Rider pickup", scheduledFor && dateTime(scheduledFor)],
    ["Rider", pickspot?.dispatch?.courier?.name],
  ];

  return (
    <>
      <AutoRefresh catchUp={order.reference} />
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Order {order.reference}</h1>
        <StatusBadge status={order.status} />
        <Link
          href={`/orders/${order.reference}`}
          className="ml-auto text-sm font-medium text-emerald-700 underline"
        >
          See what the customer sees
        </Link>
      </div>

      <NoWebhookNotice />
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-stone-200 bg-white p-5">
          <h2 className="font-semibold">Order history</h2>
          <p className="mt-1 text-xs text-stone-500">
            Newest first. New steps appear here by themselves.
          </p>
          {history.length === 0 ? (
            <p className="mt-4 text-sm text-stone-600">
              The order is on its way to PickSpot.
            </p>
          ) : (
            <ol className="mt-4 space-y-4">
              {history.map((line, index) => (
                <li
                  key={history.length - index}
                  className={`border-l-2 pl-4 text-sm ${
                    index === 0 ? "border-emerald-600" : "border-stone-300"
                  }`}
                >
                  <p className={index === 0 ? "font-medium" : ""}>{line.text}.</p>
                  <p className="mt-0.5 text-xs text-stone-500">{dateTime(line.at)}</p>
                </li>
              ))}
            </ol>
          )}
        </section>

        <div className="space-y-6">
          <section className="rounded-xl border border-stone-200 bg-white p-5 text-sm">
            <h2 className="font-semibold">Order details</h2>
            <ul className="mt-3 space-y-3">
              {order.lines.map((line) => {
                const product = products.find((p) => p.id === line.productId);
                return (
                  <li key={line.productId} className="flex items-center gap-3">
                    {product && (
                      <Image
                        src={product.image}
                        alt=""
                        width={40}
                        height={40}
                        className="size-10 shrink-0 rounded-md object-cover"
                      />
                    )}
                    <span className="min-w-0 flex-1">
                      {line.quantity} × {line.name}
                    </span>
                    <span className="shrink-0 tabular-nums">
                      {kes(line.quantity * line.unitPrice)}
                    </span>
                  </li>
                );
              })}
            </ul>
            <dl className="mt-4 space-y-1.5 border-t border-stone-200 pt-4">
              {details
                .filter(([, value]) => value)
                .map(([label, value]) => (
                  <div key={label} className="flex justify-between gap-4">
                    <dt className="text-stone-600">{label}</dt>
                    <dd className="text-right tabular-nums">{value}</dd>
                  </div>
                ))}
            </dl>
            {pickspot?.dispatch?.trackingUrl && (
              <p className="mt-4">
                <a
                  href={pickspot.dispatch.trackingUrl}
                  className="font-medium text-emerald-700 underline"
                >
                  Follow the rider on the map
                </a>
              </p>
            )}
          </section>

          <section className="rounded-xl border border-stone-200 bg-white p-5">
            <h2 className="mb-1 font-semibold">Is this up to date?</h2>
            <p className="mb-3 text-sm text-stone-600">
              Ask PickSpot for the latest on this order.
            </p>
            <CheckForUpdates reference={order.reference} />
          </section>

          {isMockMode() && <PracticePanel reference={order.reference} />}
        </div>
      </div>

      {/* For whoever supports the shop: what was exchanged with PickSpot. */}
      <details className="mt-6 rounded-xl border border-stone-200 bg-white p-5 text-sm">
        <summary className="cursor-pointer font-medium text-stone-600">
          Technical details
        </summary>
        <dl className="mt-4 grid gap-x-6 gap-y-1 sm:grid-cols-2">
          {(
            [
              ["PickSpot order id", pickspot?.orderId],
              ["Kind", pickspot?.kind],
              ["Status", order.status],
              ["Raw status", pickspot?.rawStatus],
              ["Claim id", pickspot?.claimId],
              ["Claim link", pickspot?.claim?.claimUrl],
            ] as const
          )
            .filter(([, value]) => value)
            .map(([label, value]) => (
              <div key={label} className="flex justify-between gap-4">
                <dt className="text-stone-600">{label}</dt>
                <dd className="text-right font-mono text-xs break-all">{value}</dd>
              </div>
            ))}
        </dl>
        <h3 className="mt-5 font-semibold">Product pictures sent</h3>
        <ul className="mt-2 space-y-1 font-mono text-xs break-all">
          {order.lines.map((line) => (
            <li key={line.productId}>
              {line.productId}: {line.imageKey ?? "no picture sent"}
            </li>
          ))}
        </ul>
        <h3 className="mt-5 font-semibold">Every update, as recorded</h3>
        <ul className="mt-2 space-y-2 font-mono text-xs">
          {order.timeline.map((entry, index) => (
            <li key={index} className="break-words">
              {entry.at} · {entry.source}
              {entry.event ? ` · ${entry.event}` : ""} · {entry.status} · PickSpot time{" "}
              {entry.pickspotTime}
              {entry.note && <span className="block text-stone-600">{entry.note}</span>}
            </li>
          ))}
        </ul>
        {order.request && (
          <>
            <h3 className="mt-5 font-semibold">Order request sent to PickSpot</h3>
            <pre className="mt-2 overflow-x-auto rounded-md bg-stone-100 p-3 text-xs">
              {JSON.stringify(order.request, null, 2)}
            </pre>
          </>
        )}
        <h3 className="mt-5 font-semibold">Latest answer from PickSpot</h3>
        <pre className="mt-2 overflow-x-auto rounded-md bg-stone-100 p-3 text-xs">
          {JSON.stringify(pickspot, null, 2)}
        </pre>
      </details>
    </>
  );
}
