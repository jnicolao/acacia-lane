import Link from "next/link";
import { connection } from "next/server";
import { AutoRefresh } from "@/components/auto-refresh";
import { LocalOnly } from "@/components/local-only";
import { NoWebhookNotice } from "@/components/no-webhook-notice";
import { StatusBadge } from "@/components/status-badge";
import { readDb } from "@/lib/db";
import { dateTime, kes } from "@/lib/format";
import { formatPhone } from "@/lib/phone";
import { isLocalRequest } from "@/lib/local-only";

// This page shows live data, so it is fine for a navigation to wait for it.
export const instant = false;

export default async function AdminOrders() {
  await connection(); // always render from the data as it is now
  if (!(await isLocalRequest())) return <LocalOnly />;
  const orders = readDb().orders.toReversed();

  return (
    <>
      <AutoRefresh />
      <h1 className="mb-4 text-2xl font-semibold tracking-tight">Orders</h1>
      <NoWebhookNotice />
      {orders.length === 0 ? (
        <p className="text-stone-600">
          No orders yet. Place one from the{" "}
          <Link href="/" className="font-medium text-emerald-700 underline">
            shop
          </Link>
          .
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-stone-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-stone-200 text-xs uppercase tracking-wide text-stone-500">
              <tr>
                <th className="px-4 py-3">Order</th>
                <th className="px-4 py-3">Placed</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Customer pays</th>
                <th className="px-4 py-3">Last update</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {orders.map((order) => {
                const total = order.pickspot?.pricing?.total;
                const last = order.timeline.at(-1);
                return (
                  <tr key={order.reference}>
                    <td className="px-4 py-3 font-semibold whitespace-nowrap">
                      <Link
                        href={`/admin/orders/${order.reference}`}
                        className="text-emerald-700 underline"
                      >
                        {order.reference}
                      </Link>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">{dateTime(order.createdAt)}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {order.recipient.phone
                        ? formatPhone(order.recipient.phone)
                        : order.recipient.handle}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={order.status} />
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap tabular-nums">
                      {typeof total === "number" ? kes(total) : "—"}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {last ? dateTime(last.at) : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
