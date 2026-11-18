import type { OrderLine } from "./db";
import { normalizePhone } from "./phone";
import { cartToLines, linesToPickspotItems } from "./products";
import type { CreateOrderRequest, Recipient } from "./types";

// Reads `{ items, phone }` as sent by the checkout page. Null when the cart is
// not valid or the WhatsApp number cannot be read as a phone number.
export function parseCheckoutRequest(body: unknown) {
  const { items, phone } = (body ?? {}) as Record<string, unknown>;
  const lines = cartToLines(items);
  const number = typeof phone === "string" ? normalizePhone(phone) : null;
  return lines && number ? { lines, phone: number } : null;
}

// The body of POST /integrations/checkout/orders. It carries everything the
// store knows about the order: each item with its SKU, size class and picture
// keys, and the items total. The store does not ask the buyer when they will
// be home, so `recipientAvailability` is left out.
export function buildOrderRequest(
  reference: string,
  lines: OrderLine[],
  recipient: Recipient,
  publicUrl: string,
): CreateOrderRequest {
  return {
    reference,
    recipient,
    items: linesToPickspotItems(lines),
    declaredItemCostKes: lines.reduce((sum, l) => sum + l.quantity * l.unitPrice, 0),
    autoDispatch: true,
    metadata: {
      platform: "CUSTOM",
      ...(publicUrl && {
        storeUrl: publicUrl,
        orderUrl: `${publicUrl}/orders/${reference}`,
      }),
    },
  };
}

export const INVALID_CHECKOUT_REQUEST = { ok: false, status: 400 } as const;
