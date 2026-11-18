import Link from "next/link";
import { connection } from "next/server";
import { CopyField, SettingsForm, TestConnection } from "@/components/admin-forms";
import { LocalOnly } from "@/components/local-only";
import { readDb, type WebhookLogEntry } from "@/lib/db";
import { isLocalRequest } from "@/lib/local-only";
import {
  getPublicUrl,
  getSettings,
  isMockMode,
  mask,
  WEBHOOK_PATH,
} from "@/lib/settings";

const OUTCOME_LABEL: Record<WebhookLogEntry["outcome"], string> = {
  applied: "Applied to the order",
  duplicate: "Duplicate delivery id: ignored",
  stale: "Older than the order's current state: not applied",
  unknown_reference: "No order with this reference: logged only",
  rejected: "Rejected with HTTP 401",
  invalid_payload: "Not an event envelope: answered HTTP 400",
};

function prettyBody(body: string): string {
  try {
    return JSON.stringify(JSON.parse(body), null, 2);
  } catch {
    return body;
  }
}

// This page shows live data, so it is fine for a navigation to wait for it.
export const instant = false;

export default async function AdminSettings() {
  await connection(); // always render from the data as it is now
  if (!(await isLocalRequest())) return <LocalOnly />;
  const settings = await getSettings();
  const publicUrl = await getPublicUrl();
  const db = await readDb();
  const known = new Set(db.orders.map((order) => order.reference));
  // Keyed by position in the log, so open rows stay open when new ones arrive.
  const deliveries = db.webhookLog.map((entry, key) => ({ entry, key })).reverse();

  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
      <p className="mb-6 mt-1 max-w-2xl text-sm text-stone-600">
        Connect your shop to PickSpot so your orders can be delivered. You
        find the API key and the signing secret in your PickSpot business
        account, under Settings → Integrations. They are stored on the
        shop&apos;s own computer and are never shown in full again.
      </p>
      {isMockMode() && (
        <p className="mb-6 rounded-md bg-amber-100 p-3 text-sm text-amber-950">
          Practice mode is on, so the shop works without an API key and
          nothing is sent to PickSpot.
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-stone-200 bg-white p-5">
          <h2 className="mb-4 font-semibold">PickSpot connection</h2>
          <SettingsForm
            publicUrl={settings.publicUrl}
            envPublicUrl={process.env.PUBLIC_URL ?? ""}
            maskedApiKey={mask(settings.apiKey)}
            maskedWebhookSecret={mask(settings.webhookSecret)}
          />
        </section>

        <div className="space-y-6">
          <section className="rounded-xl border border-stone-200 bg-white p-5">
            <h2 className="font-semibold">Is it working?</h2>
            <p className="mb-3 mt-1 text-sm text-stone-600">
              Checks that PickSpot accepts the saved API key.
            </p>
            <TestConnection />
          </section>

          <section className="rounded-xl border border-stone-200 bg-white p-5">
            <h2 className="font-semibold">Order updates</h2>
            <p className="mb-3 mt-1 text-sm text-stone-600">
              So PickSpot can tell your shop when an order is paid, collected
              and delivered, paste this webhook URL into your PickSpot
              business account (Settings → Integrations). PickSpot then shows
              a signing secret once: save it in the form on this page.
            </p>
            {publicUrl ? (
              <CopyField value={`${publicUrl}${WEBHOOK_PATH}`} />
            ) : (
              <p className="rounded-md bg-stone-100 p-3 text-sm">
                Save your shop&apos;s web address first. PickSpot needs it to
                reach your shop.
              </p>
            )}
          </section>
        </div>
      </div>

      {/* For whoever supports the shop: every update PickSpot has sent. */}
      <details className="mt-6 rounded-xl border border-stone-200 bg-white p-5 text-sm">
        <summary className="cursor-pointer font-medium text-stone-600">
          Connection log ({deliveries.length})
        </summary>
        <p className="mt-3 text-stone-600">
          Every request received on the webhook URL, accepted or not, newest
          first.
        </p>
        {deliveries.length === 0 ? (
          <p className="mt-3 text-stone-600">Nothing received yet.</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {deliveries.map(({ entry, key }) => (
              <li key={key} className="rounded-lg border border-stone-200 p-3">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                  <span className="font-mono font-semibold">
                    {entry.event ?? "(no event)"}
                  </span>
                  {entry.status && <span className="font-mono text-xs">{entry.status}</span>}
                  {entry.reference &&
                    (known.has(entry.reference) ? (
                      <Link
                        href={`/admin/orders/${entry.reference}`}
                        className="font-mono text-emerald-700 underline"
                      >
                        {entry.reference}
                      </Link>
                    ) : (
                      <span className="font-mono">{entry.reference}</span>
                    ))}
                  <span className="ml-auto font-mono text-xs text-stone-500">
                    {entry.receivedAt}
                  </span>
                </div>
                <p className="mt-2">
                  {entry.signatureValid ? (
                    <span className="font-medium text-emerald-800">Signature valid</span>
                  ) : (
                    <span className="font-medium text-red-800">
                      ✗ Signature not valid: {entry.reason}
                    </span>
                  )}
                  {" · "}
                  {OUTCOME_LABEL[entry.outcome]}
                  {entry.signatureValid && entry.reason ? ` (${entry.reason})` : ""}
                </p>
                <details className="mt-2">
                  <summary className="cursor-pointer text-xs text-stone-600">
                    Delivery id {entry.deliveryId ?? "(none)"} · show body
                  </summary>
                  <pre className="mt-2 overflow-x-auto rounded-md bg-stone-100 p-3 text-xs">
                    {prettyBody(entry.body)}
                  </pre>
                </details>
              </li>
            ))}
          </ul>
        )}
      </details>
    </>
  );
}
