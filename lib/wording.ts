import type { Db, TimelineEntry } from "./db";
import type { OrderStatus } from "./types";

// Everything the shop says about an order's progress, in plain words. PickSpot
// reports progress as status codes and event names; nobody using the shop
// should have to read those.

// Short status names, for badges.
export const STATUS_LABEL: Record<OrderStatus, string> = {
  AWAITING_RECIPIENT: "Waiting for customer",
  AWAITING_APPROVAL: "Waiting for approval",
  AWAITING_PAYMENT: "Waiting for payment",
  PAYMENT_FAILED: "Payment failed",
  PAID: "Paid",
  SCHEDULED: "Pickup scheduled",
  DISPATCHED: "Rider on the way",
  IN_TRANSIT: "Out for delivery",
  DELIVERED: "Delivered",
  RETURNED: "Returned",
  CANCELLED: "Cancelled",
  REJECTED: "Declined",
  EXPIRED: "Expired",
  UNKNOWN: "Processing",
};

// What happened, for each kind of update PickSpot sends about an order.
export const EVENT_TEXT: Record<string, string> = {
  "order.created": "PickSpot received the order",
  "claim.sent": "The WhatsApp link was sent to the customer",
  "claim.claimed": "The customer opened the link and gave a delivery address",
  "claim.rejected": "The customer declined the order from the WhatsApp link",
  "claim.expired": "The WhatsApp link expired before the customer used it",
  "order.rejected": "The customer declined the order",
  "order.expired": "The order expired before the customer approved it",
  "order.paid": "The customer paid",
  "order.dispatch_scheduled": "A rider pickup was scheduled",
  "order.dispatched": "A rider is on the way to collect the order",
  "order.in_transit": "The order is on its way to the customer",
  "order.delivered": "The order was delivered",
  "order.return_initiated": "The order is being returned to the shop",
  "order.returned": "The order came back to the shop",
  "order.cancelled": "The order was cancelled",
  "order.availability_updated": "The customer changed when they will be home",
};

// The same, when all the shop knows is the status the order has reached.
const STATUS_TEXT: Record<OrderStatus, string> = {
  AWAITING_RECIPIENT: "Waiting for the customer to open the WhatsApp link",
  AWAITING_APPROVAL: "Waiting for the customer to approve the order and pay",
  AWAITING_PAYMENT: "The customer approved the order and is paying by M-Pesa",
  PAYMENT_FAILED: "The customer's M-Pesa payment did not go through",
  PAID: "The customer paid",
  SCHEDULED: "A rider pickup was scheduled",
  DISPATCHED: "A rider is on the way to collect the order",
  IN_TRANSIT: "The order is on its way to the customer",
  DELIVERED: "The order was delivered",
  RETURNED: "The order came back to the shop",
  CANCELLED: "The order was cancelled",
  REJECTED: "The customer declined the order",
  EXPIRED: "The order expired before the customer approved it",
  UNKNOWN: "Waiting to hear from PickSpot",
};

export type HistoryLine = { at: string; text: string };

// An order's history, oldest first. Left out: updates the shop set aside
// because it already knew something newer, and checks that found nothing new.
export function orderHistory(timeline: TimelineEntry[]): HistoryLine[] {
  const history: HistoryLine[] = [];
  let lastStatus: OrderStatus | null = null;
  for (const entry of timeline) {
    if (entry.ignored) continue;
    const nothingNew = entry.source === "refresh" && entry.status === lastStatus;
    lastStatus = entry.status;
    if (nothingNew) continue;

    const text =
      entry.source === "checkout"
        ? "Order placed. PickSpot is sending the customer a WhatsApp link"
        : ((entry.event && EVENT_TEXT[entry.event]) ?? STATUS_TEXT[entry.status]);
    history.push({ at: entry.pickspotTime, text });
  }
  return history;
}

export type ActivityLine = HistoryLine & { reference?: string; problem?: boolean };

// Everything that happened in the shop, newest first: each order's history,
// and the updates from PickSpot that the shop had to turn away.
export function shopActivity(db: Db): ActivityLine[] {
  const known = new Set(db.orders.map((order) => order.reference));
  const lines: ActivityLine[] = db.orders.flatMap((order) =>
    orderHistory(order.timeline).map((line) => ({ ...line, reference: order.reference })),
  );
  for (const entry of db.webhookLog) {
    const problem =
      entry.outcome === "rejected"
        ? "An update from PickSpot was turned away because the shop could not check it was genuine. Check the signing secret in Settings"
        : entry.outcome === "invalid_payload"
          ? "An update from PickSpot arrived in a form the shop could not read"
          : entry.outcome === "unknown_reference"
            ? `PickSpot sent an update about order ${entry.reference}, which this shop does not have`
            : null;
    if (!problem) continue;
    const reference =
      entry.reference && known.has(entry.reference) ? entry.reference : undefined;
    lines.push({ at: entry.receivedAt, text: problem, reference, problem: true });
  }
  return lines.sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
}
