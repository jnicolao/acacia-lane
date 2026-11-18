import {
  buildOrderRequest,
  INVALID_CHECKOUT_REQUEST,
  parseCheckoutRequest,
} from "@/lib/checkout";
import { updateDb } from "@/lib/db";
import { attachItemImages } from "@/lib/item-images";
import { SHOP_INITIALS } from "@/lib/brand";
import { applySnapshot } from "@/lib/orders";
import { createOrder } from "@/lib/pickspot";
import { getPublicUrl } from "@/lib/settings";

// Called when the buyer presses "Place order" with "Deliver with PickSpot".
export async function POST(request: Request) {
  const checkout = parseCheckoutRequest(await request.json().catch(() => null));
  if (!checkout) return Response.json(INVALID_CHECKOUT_REQUEST, { status: 400 });
  const { lines, phone } = checkout;

  // Product pictures are uploaded first; the keys travel with the order.
  const imageProblem = await attachItemImages(lines);

  // Like a real shop, save the order under its own number first. A webhook
  // that arrives before PickSpot's answer then already finds the order.
  const publicUrl = await getPublicUrl();
  const orderRequest = await updateDb((db) => {
    const reference = `${SHOP_INITIALS}-${db.storeTag}-${db.nextOrderNumber++}`;
    const orderRequest = buildOrderRequest(reference, lines, { phone }, publicUrl);
    db.orders.push({
      reference,
      createdAt: new Date().toISOString(),
      lines,
      recipient: { phone },
      request: orderRequest,
      status: "UNKNOWN",
      pickspot: null,
      pickspotUpdatedAt: null,
      timeline: [],
    });
    return orderRequest;
  });
  const { reference } = orderRequest;

  let result = await createOrder(orderRequest);
  // The number already has a PickSpot account. The store does not ask whose
  // it is or show it: every buyer gets the WhatsApp link, so send it anyway.
  const linked = !result.ok && result.code === "PHONE_LINKED_TO_ACCOUNT";
  if (linked) {
    orderRequest.recipient = { phone, forceClaim: true };
    result = await createOrder(orderRequest);
  }

  if (!result.ok) {
    // PickSpot did not take the order, so the shop does not keep it either.
    await updateDb((db) => {
      db.orders = db.orders.filter((order) => order.reference !== reference);
    });
    console.error(`Order ${reference} was not placed: ${result.status} ${result.message}`);
    return Response.json({ ok: false, status: result.status }, { status: result.status || 502 });
  }

  const { status, replay, data } = result;
  const now = new Date().toISOString();
  await updateDb((db) => {
    const order = db.orders.find((o) => o.reference === reference);
    if (!order) return;
    order.request = orderRequest;
    const notes = [
      replay
        ? "PickSpot already had an order with this reference and returned it (X-Idempotent-Replay)"
        : `Order created at PickSpot (HTTP ${status})`,
    ];
    if (linked) {
      notes.push(
        "PickSpot first answered 409: the number already has a PickSpot account. Resent with forceClaim, so the buyer still gets the WhatsApp link",
      );
    }
    if (imageProblem) {
      notes.push(`Sent without item pictures: the upload failed (${imageProblem})`);
    }
    applySnapshot(order, data.order, { at: now, source: "checkout", note: notes.join(". ") }, now);
  });
  return Response.json({ ok: true, reference });
}
