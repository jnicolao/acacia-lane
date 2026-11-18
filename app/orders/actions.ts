"use server";

import { readDb, updateDb } from "@/lib/db";
import { applySnapshot, isNews } from "@/lib/orders";
import { getOrder } from "@/lib/pickspot";
import type { OrderStatus } from "@/lib/types";

const FINISHED: OrderStatus[] = ["DELIVERED", "RETURNED", "CANCELLED", "REJECTED", "EXPIRED"];
const lastAsked = new Map<string, number>();

// Called by an open order page (the buyer's or the admin's). Asks PickSpot
// for the order when it is not finished, at most once every 15 seconds per
// order, and records the answer only when it is news. Webhooks stay the main
// channel; this keeps a page right when one was missed or cannot reach the
// store at all (no tunnel).
export async function catchUpAction(reference: string): Promise<void> {
  const order = readDb().orders.find((o) => o.reference === reference);
  if (!order || FINISHED.includes(order.status)) return;
  if (Date.now() - (lastAsked.get(reference) ?? 0) < 15_000) return;
  lastAsked.set(reference, Date.now());

  const result = await getOrder(reference);
  if (!result.ok) return;
  const snapshot = result.data.order;
  const now = new Date().toISOString();
  updateDb((db) => {
    const current = db.orders.find((o) => o.reference === reference);
    if (!current || !isNews(current, snapshot)) return;
    const note = "Caught up by asking PickSpot: no webhook had reported this";
    applySnapshot(current, snapshot, { at: now, source: "refresh", note }, now);
  });
}
