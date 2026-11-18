import { randomBytes, randomUUID } from "node:crypto";
import { readDb, updateDb } from "./db";
import type {
  ApiFailure,
  ApiResult,
  CreateOrderRequest,
  IntegrationOrder,
  IntegrationOrderItem,
  MeResponse,
  OrderResponse,
  OrderStatus,
  Pricing,
  WebhookEnvelope,
} from "./types";

// A stand-in for the PickSpot backend, used when PICKSPOT_MOCK=1. It follows
// the documented contract for orders by WhatsApp number; the fees and names
// are made up. Magic inputs:
//   phone ending in 000   the number already has a PickSpot account: 409
//                         unless the order is sent with forceClaim
//   any other phone       no account: WhatsApp claim
const DELIVERY_FEE = 180;
const PLATFORM_FEE = 50;
const E164 = /^\+[1-9]\d{7,14}$/;
const BAD_PHONE = "phone must be in E.164 format, e.g. +254712345678";

const ok = <T>(data: T, status = 200, replay = false): ApiResult<T> => ({
  ok: true,
  status,
  data,
  replay,
});
const fail = (
  status: number,
  message: string,
  extra?: Pick<ApiFailure, "code">,
): ApiFailure => ({ ok: false, status, message, ...extra });

function priced(items: IntegrationOrderItem[]): Required<Pricing> {
  const itemValue = items.reduce((sum, i) => sum + i.quantity * i.unitValue, 0);
  return {
    currency: "KES",
    itemValue,
    deliveryFee: DELIVERY_FEE,
    platformFee: PLATFORM_FEE,
    total: itemValue + DELIVERY_FEE + PLATFORM_FEE,
  };
}

const newParcelCode = () => `PS-KE-${randomBytes(4).toString("hex").toUpperCase()}`;

export function getMe(): ApiResult<MeResponse> {
  return ok({
    merchantId: "MC-KE-MOCK001",
    businessName: "Mock Merchant Ltd",
    operatingCountry: "KE",
    timezone: "Africa/Nairobi",
    hasDefaultLocation: true,
    apiKeyPrefix: "pk_test_mock",
  });
}

export function createOrder(body: CreateOrderRequest): ApiResult<OrderResponse> {
  const { reference, recipient, items, metadata } = body;
  const existing = readDb().mockOrders[reference];
  if (existing) return ok({ order: existing }, 200, true);

  const now = new Date();
  const common = {
    reference,
    autoDispatch: true,
    integration: metadata,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };

  const { phone, forceClaim } = recipient;
  if (!E164.test(phone)) return fail(400, BAD_PHONE);
  if (phone.endsWith("000") && !forceClaim) {
    return fail(409, "This phone number already belongs to a Pickspot account", {
      code: "PHONE_LINKED_TO_ACCOUNT",
    });
  }
  const claimId = randomUUID();
  const order: IntegrationOrder = {
    ...common,
    orderId: claimId,
    kind: "CLAIM",
    status: "AWAITING_RECIPIENT",
    parcelCode: null,
    claimId,
    recipient: { handle: null, phone, displayName: null },
    claim: {
      claimUrl: `https://claim.pickspot.example/${claimId}`,
      branchUrl: null,
      expiresAt: new Date(now.getTime() + 48 * 3600 * 1000).toISOString(),
      whatsapp: "pending",
    },
    // The delivery fee is unknown until the buyer claims and gives an address.
    pricing: {
      ...priced(items),
      deliveryFee: null,
      platformFee: null,
      total: null,
    },
  };

  updateDb((db) => {
    db.mockOrders[reference] = order;
  });
  return ok({ order }, 201);
}

export function getOrder(id: string): ApiResult<OrderResponse> {
  const order = Object.values(readDb().mockOrders).find((o) =>
    [o.reference, o.orderId, o.parcelCode, o.claimId].includes(id),
  );
  return order ? ok({ order }) : fail(404, "Order not found");
}

export function uploadItemImage(): ApiResult<{ key: string }> {
  return ok({ key: `mock/pickspot-orders/${randomUUID()}.jpg` }, 201);
}

// The status each event leaves the order in. `order.return_initiated` and
// `order.availability_updated` are not listed: they keep the current status.
const STATUS_AFTER: Record<string, OrderStatus> = {
  "order.created": "AWAITING_APPROVAL",
  "claim.sent": "AWAITING_RECIPIENT",
  "claim.claimed": "AWAITING_APPROVAL",
  "claim.rejected": "REJECTED",
  "claim.expired": "EXPIRED",
  "order.rejected": "REJECTED",
  "order.expired": "EXPIRED",
  "order.paid": "PAID",
  "order.dispatch_scheduled": "SCHEDULED",
  "order.dispatched": "DISPATCHED",
  "order.in_transit": "IN_TRANSIT",
  "order.delivered": "DELIVERED",
  "order.returned": "RETURNED",
  "order.cancelled": "CANCELLED",
};

// Makes `event` happen to a mock order, as if the buyer or a rider had acted,
// and returns the webhook PickSpot would send for it. Null if there is no such
// order.
export function recordMockEvent(
  reference: string,
  event: string,
): WebhookEnvelope | null {
  const now = new Date().toISOString();
  return updateDb((db) => {
    const current = db.mockOrders[reference];
    if (!current) return null;

    const data: IntegrationOrder = {
      ...current,
      status: STATUS_AFTER[event] ?? current.status,
      updatedAt: now,
    };
    if (event === "claim.sent" && data.claim) {
      data.claim = { ...data.claim, whatsapp: "sent" };
    }
    if (event === "claim.claimed" && data.kind === "CLAIM") {
      // The buyer signed up through the claim link: the claim becomes a parcel.
      const parcelCode = newParcelCode();
      data.kind = "PARCEL";
      data.orderId = parcelCode;
      data.parcelCode = parcelCode;
      data.recipient = {
        ...data.recipient,
        handle: "newbuyer@pickspot.world",
        displayName: "New Buyer",
      };
      const itemValue = data.pricing?.itemValue ?? 0;
      data.pricing = {
        currency: "KES",
        itemValue,
        deliveryFee: DELIVERY_FEE,
        platformFee: PLATFORM_FEE,
        total: itemValue + DELIVERY_FEE + PLATFORM_FEE,
      };
    }
    if (event === "order.dispatched") {
      data.dispatch = {
        status: "DISPATCHED",
        trackingUrl: `https://track.pickspot.example/${data.orderId}`,
        courier: { name: "Brian O.", phone: "+254700000001" },
      };
    }

    db.mockOrders[reference] = data;
    return { id: randomUUID(), event, createdAt: now, data };
  });
}
