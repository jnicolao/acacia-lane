import type { Db, WebhookLogEntry } from "./db";
import { applySnapshot } from "./orders";
import { verifySignature } from "./signature";
import type { IntegrationOrder } from "./types";

const MAX_LOG_ENTRIES = 1000;
const MAX_LOGGED_BODY = 20_000;

export type WebhookResult = {
  httpStatus: 200 | 400 | 401;
  outcome: WebhookLogEntry["outcome"];
  reason?: string;
};

// The body is untrusted until the signature is verified, and is logged either
// way, so nothing is read from it without checking its type.
function parseObject(rawBody: string): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(rawBody);
    if (typeof parsed === "object" && parsed !== null) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // Not JSON: the delivery is still logged, with no event details.
  }
  return {};
}

const text = (value: unknown) => (typeof value === "string" ? value : undefined);

// Handles one delivery to the webhook URL. Every delivery is appended to
// `db.webhookLog`, whatever happens to it. Mutates `db`; the caller saves it.
export function processWebhook(
  db: Db,
  input: { rawBody: string; signature: string | null; secret: string; now?: Date },
): WebhookResult {
  const now = input.now ?? new Date();
  const envelope = parseObject(input.rawBody);
  const data =
    typeof envelope.data === "object" && envelope.data !== null
      ? (envelope.data as Record<string, unknown>)
      : {};

  const entry: WebhookLogEntry = {
    receivedAt: now.toISOString(),
    signatureValid: false,
    outcome: "rejected",
    deliveryId: text(envelope.id),
    event: text(envelope.event),
    reference: text(data.reference),
    status: text(data.status),
    body: input.rawBody.slice(0, MAX_LOGGED_BODY),
  };
  const finish = (
    httpStatus: WebhookResult["httpStatus"],
    outcome: WebhookLogEntry["outcome"],
    reason?: string,
  ): WebhookResult => {
    entry.outcome = outcome;
    entry.reason = reason;
    db.webhookLog.push(entry);
    db.webhookLog.splice(0, db.webhookLog.length - MAX_LOG_ENTRIES);
    return { httpStatus, outcome, reason };
  };

  const check = verifySignature(
    input.rawBody,
    input.signature,
    input.secret,
    now.getTime(),
  );
  if (!check.valid) return finish(401, "rejected", check.reason);
  entry.signatureValid = true;

  if (!entry.deliveryId || !entry.event || !entry.status) {
    return finish(400, "invalid_payload", "Body is not a PickSpot event envelope");
  }

  // The delivery id is the idempotency key: a retry or a repeat changes nothing.
  const seenBefore = db.webhookLog.some(
    (earlier) => earlier.signatureValid && earlier.deliveryId === entry.deliveryId,
  );
  if (seenBefore) return finish(200, "duplicate");

  const order = db.orders.find((o) => o.reference === entry.reference);
  if (!order) return finish(200, "unknown_reference");

  // Signed by PickSpot, so from here the payload is trusted to be an order.
  const applied = applySnapshot(
    order,
    data as IntegrationOrder,
    { at: entry.receivedAt, source: "webhook", event: entry.event },
    text(envelope.createdAt) ?? entry.receivedAt,
  );
  return finish(200, applied ? "applied" : "stale");
}
