import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { signPayload, verifySignature } from "./signature";

const SECRET = "whsec_test_secret";
const BODY = '{"id":"d1","event":"order.paid","data":{"reference":"AL-1001"}}';
const NOW_MS = Date.UTC(2026, 10, 17, 12, 0, 0);
const NOW_S = NOW_MS / 1000;

describe("verifySignature", () => {
  it("accepts a signature made exactly as the docs describe", () => {
    // Built by hand rather than with signPayload, so the two cannot agree by mistake.
    const v1 = createHmac("sha256", SECRET).update(`${NOW_S}.${BODY}`).digest("hex");
    expect(verifySignature(BODY, `t=${NOW_S},v1=${v1}`, SECRET, NOW_MS)).toEqual({
      valid: true,
    });
  });

  it("accepts a timestamp up to 5 minutes away, in either direction", () => {
    for (const t of [NOW_S - 300, NOW_S + 300]) {
      const header = signPayload(BODY, SECRET, t);
      expect(verifySignature(BODY, header, SECRET, NOW_MS).valid).toBe(true);
    }
  });

  it("rejects a signature made with another secret", () => {
    const header = signPayload(BODY, "whsec_other", NOW_S);
    expect(verifySignature(BODY, header, SECRET, NOW_MS)).toEqual({
      valid: false,
      reason: "Signature does not match (wrong secret or altered body)",
    });
  });

  it("rejects a stale timestamp, and one too far in the future", () => {
    for (const t of [NOW_S - 301, NOW_S + 301]) {
      const header = signPayload(BODY, SECRET, t);
      expect(verifySignature(BODY, header, SECRET, NOW_MS)).toEqual({
        valid: false,
        reason: "Timestamp is more than 5 minutes from now",
      });
    }
  });

  it("rejects a body that was altered after signing", () => {
    const header = signPayload(BODY, SECRET, NOW_S);
    const tampered = BODY.replace("order.paid", "order.delivered");
    const result = verifySignature(tampered, header, SECRET, NOW_MS);
    expect(result).toMatchObject({ valid: false, reason: /does not match/ });
  });

  it("rejects a timestamp that was changed to look fresh", () => {
    const old = signPayload(BODY, SECRET, NOW_S - 3600);
    const refreshed = old.replace(`t=${NOW_S - 3600}`, `t=${NOW_S}`);
    const result = verifySignature(BODY, refreshed, SECRET, NOW_MS);
    expect(result).toMatchObject({ valid: false, reason: /does not match/ });
  });

  it("rejects a missing header", () => {
    expect(verifySignature(BODY, null, SECRET, NOW_MS)).toEqual({
      valid: false,
      reason: "Missing X-Pickspot-Signature header",
    });
  });

  it("rejects malformed headers", () => {
    const good = signPayload(BODY, SECRET, NOW_S);
    const v1 = good.split("v1=")[1];
    const malformed = [
      "garbage",
      `t=${NOW_S}`, // no v1
      `v1=${v1}`, // no t
      `t=abc,v1=${v1}`, // t is not a number
      `t=${NOW_S},v1=${v1.slice(0, 20)}`, // v1 too short
      `t=${NOW_S},v1=${"z".repeat(64)}`, // v1 is not hex
      `t=${NOW_S},v1=${v1},extra=1`,
    ];
    for (const header of malformed) {
      expect(verifySignature(BODY, header, SECRET, NOW_MS)).toEqual({
        valid: false,
        reason: "Malformed X-Pickspot-Signature header",
      });
    }
  });

  it("rejects everything while no secret is saved", () => {
    const header = signPayload(BODY, "", NOW_S);
    expect(verifySignature(BODY, header, "", NOW_MS)).toEqual({
      valid: false,
      reason: "No signing secret saved in the store settings",
    });
  });
});
