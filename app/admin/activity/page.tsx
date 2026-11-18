import Link from "next/link";
import { connection } from "next/server";
import { AutoRefresh } from "@/components/auto-refresh";
import { LocalOnly } from "@/components/local-only";
import { NoWebhookNotice } from "@/components/no-webhook-notice";
import { readDb } from "@/lib/db";
import { dateTime } from "@/lib/format";
import { isLocalRequest } from "@/lib/local-only";
import { shopActivity } from "@/lib/wording";

// This page shows live data, so it is fine for a navigation to wait for it.
export const instant = false;

export default async function AdminActivity() {
  await connection(); // always render from the data as it is now
  if (!(await isLocalRequest())) return <LocalOnly />;
  const activity = shopActivity(await readDb()).slice(0, 100);

  return (
    <>
      <AutoRefresh />
      <h1 className="text-2xl font-semibold tracking-tight">Activity</h1>
      <p className="mb-4 mt-1 text-sm text-stone-600">
        What has happened to your orders, newest first.
      </p>
      <NoWebhookNotice />
      {activity.length === 0 ? (
        <p className="text-stone-600">Nothing yet. Activity appears here once an order is placed.</p>
      ) : (
        <ul className="divide-y divide-stone-100 rounded-xl border border-stone-200 bg-white text-sm">
          {activity.map((line, index) => (
            <li
              key={activity.length - index}
              className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-4 py-3"
            >
              <span className="w-28 shrink-0 text-xs text-stone-500 tabular-nums">
                {dateTime(line.at)}
              </span>
              <span className={`min-w-0 flex-1 ${line.problem ? "text-red-800" : ""}`}>
                {line.problem && "⚠ "}
                {line.text}.
              </span>
              {line.reference && (
                <Link
                  href={`/admin/orders/${line.reference}`}
                  className="shrink-0 font-medium text-emerald-700 underline"
                >
                  {line.reference}
                </Link>
              )}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
