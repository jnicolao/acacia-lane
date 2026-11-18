import { describe, expect, it } from "vitest";
import { emptyDb, type TimelineEntry } from "./db";
import { orderHistory, shopActivity } from "./wording";

const at = (minute: number) => new Date(Date.UTC(2026, 10, 18, 9, minute)).toISOString();
const entry = (minute: number, fields: Partial<TimelineEntry>): TimelineEntry => ({
  at: at(minute),
  pickspotTime: at(minute),
  source: "webhook",
  status: "UNKNOWN",
  ...fields,
});

const TIMELINE: TimelineEntry[] = [
  entry(0, { source: "checkout", status: "AWAITING_RECIPIENT" }),
  entry(1, { event: "claim.sent", status: "AWAITING_RECIPIENT" }),
  entry(2, { source: "refresh", status: "AWAITING_RECIPIENT" }), // a check, nothing new
  entry(5, { event: "order.paid", status: "PAID" }),
  entry(6, { event: "claim.claimed", status: "AWAITING_APPROVAL", ignored: true }), // arrived late
  entry(9, { source: "refresh", status: "DELIVERED" }), // caught up without an event
  entry(10, { event: "order.made_up", status: "DELIVERED" }), // an event the shop has no words for
];

describe("orderHistory", () => {
  it("tells an order's story in plain words, without codes or event names", () => {
    expect(orderHistory(TIMELINE).map((line) => line.text)).toEqual([
      "Order placed. PickSpot is sending the customer a WhatsApp link",
      "The WhatsApp link was sent to the customer",
      "The customer paid",
      "The order was delivered",
      "The order was delivered",
    ]);
  });
});

describe("shopActivity", () => {
  it("lists every order's history and the updates that were turned away, newest first", () => {
    const db = emptyDb();
    db.orders.push({
      reference: "AL-TEST-1001",
      createdAt: at(0),
      lines: [],
      recipient: { phone: "+254712345678" },
      status: "PAID",
      pickspot: null,
      pickspotUpdatedAt: at(5),
      timeline: TIMELINE.slice(0, 4),
    });
    const refused = { signatureValid: false, body: "{}" };
    db.webhookLog.push(
      { ...refused, receivedAt: at(3), outcome: "duplicate", signatureValid: true },
      { ...refused, receivedAt: at(7), outcome: "rejected", reason: "Signature does not match" },
      { ...refused, receivedAt: at(8), outcome: "unknown_reference", reference: "AL-OTHER-7" },
    );

    const activity = shopActivity(db);
    expect(activity.map((line) => [line.reference, line.problem ?? false])).toEqual([
      [undefined, true],
      [undefined, true],
      ["AL-TEST-1001", false],
      ["AL-TEST-1001", false],
      ["AL-TEST-1001", false],
    ]);
    expect(activity[0].text).toContain("AL-OTHER-7");
    expect(activity[1].text).toContain("signing secret");
    expect(activity.map((line) => line.text).join(" ")).not.toMatch(/webhook|HTTP|signature/i);
  });
});
