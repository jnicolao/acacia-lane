import { describe, expect, it } from "vitest";
import { emptyDb, type Db } from "./db";
import { signPayload } from "./signature";
import type { IntegrationOrder, OrderStatus } from "./types";
import { isNews } from "./orders";
import { processWebhook } from "./webhook";

const SECRET = "whsec_test_secret";
const REFERENCE = "AL-TEST-1001";
const T0 = Date.UTC(2026, 10, 17, 12, 0, 0);
const iso = (minutesAfterT0: number) =>
  new Date(T0 + minutesAfterT0 * 60_000).toISOString();

// A store with one order, created at T0 and waiting for the buyer's approval.
function storeWithOrder(): Db {
  const db = emptyDb();
  db.orders.push({
    reference: REFERENCE,
    createdAt: iso(0),
    lines: [],
    recipient: { handle: "amina@pickspot.world" },
    status: "AWAITING_APPROVAL",
    pickspot: null,
    pickspotUpdatedAt: iso(0),
    timeline: [],
  });
  return db;
}

type Delivery = {
  id: string;
  event: string;
  status: OrderStatus;
  updatedAt: string | null; // data.updatedAt
  createdAt?: string; // envelope createdAt
  reference?: string;
  secret?: string;
};

// Delivers a signed event to the handler one minute after it was created.
function deliver(db: Db, d: Delivery) {
  const createdAt = d.createdAt ?? d.updatedAt ?? iso(0);
  const data: IntegrationOrder = {
    orderId: "PS-KE-TEST0001",
    kind: "PARCEL",
    reference: d.reference ?? REFERENCE,
    status: d.status,
    updatedAt: d.updatedAt,
  };
  const rawBody = JSON.stringify({ id: d.id, event: d.event, createdAt, data });
  const now = new Date(Date.parse(createdAt) + 60_000);
  const signature = signPayload(rawBody, d.secret ?? SECRET, now.getTime() / 1000);
  return processWebhook(db, { rawBody, signature, secret: SECRET, now });
}

describe("processWebhook", () => {
  it("updates the order from data.status and logs the delivery", () => {
    const db = storeWithOrder();
    const result = deliver(db, {
      id: "d1",
      event: "order.paid",
      status: "PAID",
      updatedAt: iso(5),
    });

    expect(result).toMatchObject({ httpStatus: 200, outcome: "applied" });
    expect(db.orders[0].status).toBe("PAID");
    expect(db.orders[0].pickspot?.orderId).toBe("PS-KE-TEST0001");
    expect(db.orders[0].timeline).toMatchObject([
      { source: "webhook", event: "order.paid", status: "PAID" },
    ]);
    expect(db.webhookLog).toMatchObject([
      {
        signatureValid: true,
        outcome: "applied",
        deliveryId: "d1",
        event: "order.paid",
        reference: REFERENCE,
        status: "PAID",
      },
    ]);
  });

  it("ignores a delivery id it has already processed", () => {
    const db = storeWithOrder();
    const paid = {
      id: "d1",
      event: "order.paid",
      status: "PAID",
      updatedAt: iso(5),
    } as const;
    deliver(db, paid);
    deliver(db, {
      id: "d2",
      event: "order.dispatched",
      status: "DISPATCHED",
      updatedAt: iso(10),
    });

    const repeat = deliver(db, paid);

    expect(repeat).toMatchObject({ httpStatus: 200, outcome: "duplicate" });
    expect(db.orders[0].status).toBe("DISPATCHED");
    expect(db.orders[0].timeline).toHaveLength(2);
    expect(db.webhookLog.map((e) => e.outcome)).toEqual([
      "applied",
      "applied",
      "duplicate",
    ]);
  });

  it("does not let an event that arrives late regress the status", () => {
    const db = storeWithOrder();
    deliver(db, {
      id: "d2",
      event: "order.delivered",
      status: "DELIVERED",
      updatedAt: iso(30),
    });

    const late = deliver(db, {
      id: "d1",
      event: "order.paid",
      status: "PAID",
      updatedAt: iso(5),
    });

    expect(late).toMatchObject({ httpStatus: 200, outcome: "stale" });
    expect(db.orders[0].status).toBe("DELIVERED");
    expect(db.orders[0].pickspotUpdatedAt).toBe(iso(30));
    // The late event is still shown on the timeline, marked as ignored.
    expect(db.orders[0].timeline[1]).toMatchObject({
      event: "order.paid",
      status: "PAID",
      note: expect.stringContaining("Ignored"),
    });
  });

  it("orders events by the envelope createdAt when data.updatedAt is missing", () => {
    const db = storeWithOrder();
    deliver(db, {
      id: "d2",
      event: "order.delivered",
      status: "DELIVERED",
      updatedAt: null,
      createdAt: iso(30),
    });
    const late = deliver(db, {
      id: "d1",
      event: "order.paid",
      status: "PAID",
      updatedAt: null,
      createdAt: iso(5),
    });

    expect(late.outcome).toBe("stale");
    expect(db.orders[0].status).toBe("DELIVERED");
  });

  it("logs an event for an unknown reference without failing", () => {
    const db = storeWithOrder();
    const result = deliver(db, {
      id: "d1",
      event: "order.paid",
      status: "PAID",
      updatedAt: iso(5),
      reference: "SOMEONE-ELSE-1",
    });

    expect(result).toMatchObject({ httpStatus: 200, outcome: "unknown_reference" });
    expect(db.orders[0].status).toBe("AWAITING_APPROVAL");
    expect(db.webhookLog).toMatchObject([
      { signatureValid: true, outcome: "unknown_reference", reference: "SOMEONE-ELSE-1" },
    ]);
  });

  it("answers 401 to a bad signature, logs why, and changes nothing", () => {
    const db = storeWithOrder();
    const result = deliver(db, {
      id: "d1",
      event: "order.paid",
      status: "PAID",
      updatedAt: iso(5),
      secret: "whsec_rotated_away",
    });

    expect(result).toMatchObject({ httpStatus: 401, outcome: "rejected" });
    expect(db.orders[0].status).toBe("AWAITING_APPROVAL");
    expect(db.orders[0].timeline).toHaveLength(0);
    expect(db.webhookLog).toMatchObject([
      {
        signatureValid: false,
        outcome: "rejected",
        event: "order.paid",
        reason: expect.stringContaining("does not match"),
      },
    ]);
  });

  it("does not count a rejected delivery as seen: the retry is processed", () => {
    const db = storeWithOrder();
    const paid = {
      id: "d1",
      event: "order.paid",
      status: "PAID",
      updatedAt: iso(5),
    } as const;
    deliver(db, { ...paid, secret: "whsec_rotated_away" });

    const retry = deliver(db, paid);

    expect(retry.outcome).toBe("applied");
    expect(db.orders[0].status).toBe("PAID");
  });

  it("logs a body that is not JSON instead of throwing", () => {
    const db = storeWithOrder();
    const now = new Date(T0);
    const unsigned = processWebhook(db, {
      rawBody: "not json",
      signature: null,
      secret: SECRET,
      now,
    });
    const signed = processWebhook(db, {
      rawBody: "not json",
      signature: signPayload("not json", SECRET, T0 / 1000),
      secret: SECRET,
      now,
    });

    expect(unsigned).toMatchObject({ httpStatus: 401, outcome: "rejected" });
    expect(signed).toMatchObject({ httpStatus: 400, outcome: "invalid_payload" });
    expect(db.webhookLog.map((e) => e.body)).toEqual(["not json", "not json"]);
  });
});

describe("isNews", () => {
  const snapshot = (status: OrderStatus, updatedAt?: string): IntegrationOrder => ({
    orderId: "PS-KE-TEST",
    kind: "PARCEL",
    reference: REFERENCE,
    status,
    updatedAt,
  });

  it("is news when PickSpot's state is later than the one recorded", () => {
    const order = storeWithOrder().orders[0];
    expect(isNews(order, snapshot("PAID", iso(5)))).toBe(true);
    expect(isNews(order, snapshot("AWAITING_APPROVAL", iso(0)))).toBe(false);
    expect(isNews(order, snapshot("AWAITING_RECIPIENT", iso(-5)))).toBe(false);
  });

  it("falls back to the status when PickSpot sends no time", () => {
    const order = storeWithOrder().orders[0];
    expect(isNews(order, snapshot("PAID"))).toBe(true);
    expect(isNews(order, snapshot("AWAITING_APPROVAL"))).toBe(false);
  });
});
