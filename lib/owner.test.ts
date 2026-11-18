import { describe, expect, it, vi } from "vitest";
import { isValidSession, sessionToken, tryPassword, type SignInData } from "./owner";

vi.mock("./data-file", () => ({}));
vi.mock("./local-only", () => ({}));

const SECRET = "a".repeat(64);
const PASSWORD = "correct horse battery staple";
const NOW = Date.parse("2026-11-18T10:00:00Z");
const MINUTE = 60_000;
const data = (): SignInData => ({ secret: SECRET, wrong: {} });

describe("the sign-in cookie", () => {
  it("is accepted until it runs out", () => {
    const token = sessionToken(SECRET, PASSWORD, NOW + MINUTE);
    expect(isValidSession(token, SECRET, PASSWORD, NOW)).toBe(true);
    expect(isValidSession(token, SECRET, PASSWORD, NOW + 2 * MINUTE)).toBe(false);
  });

  it("stops working when the password is changed", () => {
    const token = sessionToken(SECRET, PASSWORD, NOW + MINUTE);
    expect(isValidSession(token, SECRET, "a new password", NOW)).toBe(false);
  });

  it("cannot be made without the shop's secret, or stretched by editing it", () => {
    const forged = sessionToken("b".repeat(64), PASSWORD, NOW + MINUTE);
    expect(isValidSession(forged, SECRET, PASSWORD, NOW)).toBe(false);
    const [, signature] = sessionToken(SECRET, PASSWORD, NOW + MINUTE).split(".");
    expect(isValidSession(`${NOW + 99 * MINUTE}.${signature}`, SECRET, PASSWORD, NOW)).toBe(false);
    expect(isValidSession("nonsense", SECRET, PASSWORD, NOW)).toBe(false);
  });
});

describe("trying the password", () => {
  it("lets the right password in and forgets earlier wrong tries", () => {
    const signIn = data();
    expect(tryPassword(signIn, "home", "guess", PASSWORD, NOW)).toBe("wrong");
    expect(tryPassword(signIn, "home", PASSWORD, PASSWORD, NOW)).toBe("ok");
    expect(signIn.wrong).toEqual({});
  });

  it("makes an address wait after 5 wrong tries, even with the right password", () => {
    const signIn = data();
    for (let i = 0; i < 5; i++) {
      expect(tryPassword(signIn, "attacker", `guess ${i}`, PASSWORD, NOW + i)).toBe("wrong");
    }
    expect(tryPassword(signIn, "attacker", PASSWORD, PASSWORD, NOW + 5)).toBe("wait");
    // Another address is not held up.
    expect(tryPassword(signIn, "owner", PASSWORD, PASSWORD, NOW + 5)).toBe("ok");
  });

  it("lets the address try again 15 minutes after its wrong tries", () => {
    const signIn = data();
    for (let i = 0; i < 5; i++) tryPassword(signIn, "attacker", "guess", PASSWORD, NOW);
    expect(tryPassword(signIn, "attacker", PASSWORD, PASSWORD, NOW + 14 * MINUTE)).toBe("wait");
    expect(tryPassword(signIn, "attacker", PASSWORD, PASSWORD, NOW + 15 * MINUTE)).toBe("ok");
  });
});
