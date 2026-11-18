// Shapes of the PickSpot Integrations API, copied from its OpenAPI spec (tag
// "Integrations") on 2026-11-17.

export const ORDER_STATUSES = [
  "AWAITING_RECIPIENT",
  "AWAITING_APPROVAL",
  "AWAITING_PAYMENT",
  "PAYMENT_FAILED",
  "PAID",
  "SCHEDULED",
  "DISPATCHED",
  "IN_TRANSIT",
  "DELIVERED",
  "RETURNED",
  "CANCELLED",
  "REJECTED",
  "EXPIRED",
  "UNKNOWN",
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const WEBHOOK_EVENTS = [
  "order.created",
  "claim.sent",
  "claim.claimed",
  "claim.rejected",
  "claim.expired",
  "order.rejected",
  "order.expired",
  "order.paid",
  "order.dispatch_scheduled",
  "order.dispatched",
  "order.in_transit",
  "order.delivered",
  "order.return_initiated",
  "order.returned",
  "order.cancelled",
  "order.availability_updated",
] as const;

export type IntegrationOrderItem = {
  description: string;
  quantity: number;
  unitValue: number;
  currency: "KES";
  sku?: string;
  parcelClass: "SMALL" | "MEDIUM" | "LARGE";
  // Keys of pictures uploaded beforehand (see lib/item-images.ts). The
  // PickSpot app shows them next to the item.
  imageKeys?: string[];
};

export type Pricing = {
  currency?: string;
  itemValue?: number | null;
  deliveryFee?: number | null;
  platformFee?: number | null;
  total?: number | null;
};

export type IntegrationOrder = {
  orderId: string;
  kind: "PARCEL" | "CLAIM";
  reference?: string | null;
  status: OrderStatus;
  rawStatus?: string;
  parcelCode?: string | null;
  claimId?: string | null;
  recipient?: {
    handle?: string | null;
    phone?: string | null;
    displayName?: string | null;
  };
  claim?: {
    claimUrl?: string;
    branchUrl?: string | null;
    expiresAt?: string | null;
    whatsapp?: "pending" | "sent" | "failed" | null;
  } | null;
  pricing?: Pricing | null;
  recipientAvailability?: { start: string; end: string; timezone: string } | null;
  dispatch?: {
    scheduledFor?: string | null;
    scheduleReason?: string | null;
    status?: string | null;
    trackingUrl?: string | null;
    courier?: { name?: string | null; phone?: string | null } | null;
  } | null;
  autoDispatch?: boolean;
  integration?: {
    platform?: "WOOCOMMERCE" | "SHOPIFY" | "CUSTOM";
    storeUrl?: string | null;
    orderUrl?: string | null;
  } | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

export type OrderResponse = { order: IntegrationOrder };

export type MeResponse = {
  merchantId?: string;
  businessName?: string | null;
  operatingCountry?: string | null;
  timezone?: string;
  hasDefaultLocation?: boolean;
  apiKeyPrefix?: string;
};

// The buyer, by WhatsApp number (E.164). PickSpot sends them a link to claim
// the order. `forceClaim` sends that link even when the number already has a
// PickSpot account. The API can also take a PickSpot address (`handle`); this
// store does not use it.
export type Recipient = { phone: string; forceClaim?: boolean };

export type CreateOrderRequest = {
  reference: string;
  recipient: Recipient;
  items: IntegrationOrderItem[];
  // Optional. PickSpot checks it against the sum of quantity × unitValue.
  declaredItemCostKes?: number;
  // True (the default): PickSpot requests the rider itself once the order is
  // paid. False: the merchant does it by hand from the portal.
  autoDispatch?: boolean;
  metadata: { platform: "CUSTOM"; storeUrl?: string; orderUrl?: string };
};

// Result of one call to the PickSpot API. `status` is the HTTP status, or 0
// when the request never got an answer (no key saved, network error, timeout).
export type ApiFailure = {
  ok: false;
  status: number;
  message: string;
  code?: string;
};
export type ApiResult<T> =
  | { ok: true; status: number; data: T; replay: boolean }
  | ApiFailure;

export type WebhookEnvelope = {
  id: string;
  event: string;
  createdAt: string;
  data: IntegrationOrder;
};
