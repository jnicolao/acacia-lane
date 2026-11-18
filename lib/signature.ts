import { createHmac, timingSafeEqual } from "node:crypto";

// X-Pickspot-Signature: t=<unix seconds>,v1=<hex>
// v1 = HMAC_SHA256(secret, "<t>.<raw request body>")
const HEADER_FORMAT = /^t=(\d+),v1=([0-9a-f]{64})$/i;
const TOLERANCE_SECONDS = 300;

export type SignatureCheck = { valid: true } | { valid: false; reason: string };

function hmac(rawBody: string, secret: string, timestamp: string): Buffer {
  return createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest();
}

export function signPayload(
  rawBody: string,
  secret: string,
  unixSeconds: number,
): string {
  const t = String(unixSeconds);
  return `t=${t},v1=${hmac(rawBody, secret, t).toString("hex")}`;
}

// `rawBody` must be the request body exactly as received, before JSON parsing.
export function verifySignature(
  rawBody: string,
  header: string | null,
  secret: string,
  nowMs: number = Date.now(),
): SignatureCheck {
  if (!secret) {
    return { valid: false, reason: "No signing secret saved in the store settings" };
  }
  if (!header) {
    return { valid: false, reason: "Missing X-Pickspot-Signature header" };
  }
  const match = HEADER_FORMAT.exec(header.trim());
  if (!match) {
    return { valid: false, reason: "Malformed X-Pickspot-Signature header" };
  }
  const [, t, v1] = match;
  // Both buffers are 32 bytes (the regex guarantees 64 hex characters).
  if (!timingSafeEqual(hmac(rawBody, secret, t), Buffer.from(v1, "hex"))) {
    return {
      valid: false,
      reason: "Signature does not match (wrong secret or altered body)",
    };
  }
  if (Math.abs(nowMs / 1000 - Number(t)) > TOLERANCE_SECONDS) {
    return { valid: false, reason: "Timestamp is more than 5 minutes from now" };
  }
  return { valid: true };
}
