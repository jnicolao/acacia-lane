import { randomBytes } from "node:crypto";
import { readDataFile, updateDataFile } from "./data-file";
import { isMockMode } from "./settings";
import type { CreateOrderRequest, IntegrationOrder, OrderStatus } from "./types";

export type OrderLine = {
  productId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  // Key of the product picture sent to PickSpot with the order, if any.
  imageKey?: string;
};

export type TimelineEntry = {
  at: string; // when the store recorded it
  source: "checkout" | "webhook" | "refresh";
  event?: string; // webhook event name
  status: OrderStatus; // the status PickSpot reported
  pickspotTime: string; // the time used to order snapshots (see applySnapshot)
  note?: string;
  // True when the update was older than what the shop already knew, so it
  // was recorded but did not change the order.
  ignored?: boolean;
};

export type StoreOrder = {
  reference: string;
  createdAt: string;
  lines: OrderLine[];
  // The WhatsApp number given at checkout. `handle` is only on orders placed
  // while the store still took a PickSpot address.
  recipient: { handle?: string; phone?: string };
  // The body sent to PickSpot to create the order (absent on older orders).
  request?: CreateOrderRequest;
  status: OrderStatus;
  // Latest snapshot from PickSpot; null until the create call has answered.
  pickspot: IntegrationOrder | null;
  pickspotUpdatedAt: string | null;
  timeline: TimelineEntry[];
};

export type WebhookLogEntry = {
  receivedAt: string;
  signatureValid: boolean;
  reason?: string; // why the delivery was refused
  outcome:
    | "applied"
    | "duplicate"
    | "stale"
    | "unknown_reference"
    | "rejected"
    | "invalid_payload";
  deliveryId?: string;
  event?: string;
  reference?: string;
  status?: string;
  body: string;
};

export type Db = {
  // Random per-install tag in order numbers (AL-<tag>-1001), so two
  // copies of this store, or one whose data was reset, never reuse a
  // reference that the same merchant already sent to PickSpot.
  storeTag: string;
  nextOrderNumber: number;
  orders: StoreOrder[];
  webhookLog: WebhookLogEntry[];
  // Mock mode only: the orders as the fake PickSpot backend sees them.
  mockOrders: Record<string, IntegrationOrder>;
};

export function emptyDb(): Db {
  return {
    storeTag: randomBytes(2).toString("hex").toUpperCase(),
    nextOrderNumber: 1001,
    orders: [],
    webhookLog: [],
    mockOrders: {},
  };
}

// Mock orders are kept apart from orders placed against the real API.
const fileName = () => (isMockMode() ? "store.mock.json" : "store.json");

export function readDb(): Promise<Db> {
  return readDataFile(fileName(), emptyDb);
}

// The order with this number. When it is not in the cached copy, the database
// itself is asked: an order placed a moment ago may not be in the cache yet,
// and the buyer is sent to its page straight away.
export async function findOrder(reference: string): Promise<StoreOrder | undefined> {
  const find = (db: Db) => db.orders.find((order) => order.reference === reference);
  return find(await readDb()) ?? find(await readDataFile(fileName(), emptyDb, { cached: false }));
}

// Applies `change` and saves it, with no other change in between, even from
// another copy of the shop. Returns what `change` returns.
export function updateDb<T>(change: (db: Db) => T): Promise<T> {
  return updateDataFile(fileName(), emptyDb, change);
}
