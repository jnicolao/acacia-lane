import { describe, expect, it } from "vitest";
import { formatPhone, normalizePhone } from "./phone";

describe("normalizePhone", () => {
  it.each([
    ["0712 345 678", "+254712345678"],
    ["0112345678", "+254112345678"],
    ["712345678", "+254712345678"],
    ["254712345678", "+254712345678"],
    ["+254 712-345-678", "+254712345678"],
    ["00254712345678", "+254712345678"],
    ["(+44) 7911 123456", "+447911123456"],
  ])("reads %s as %s", (typed, expected) => {
    expect(normalizePhone(typed)).toBe(expected);
  });

  it.each(["", "hello", "0712", "071234567890", "+254 712 345", "+2540712345678", "12345"])(
    "refuses %j",
    (typed) => {
      expect(normalizePhone(typed)).toBeNull();
    },
  );
});

describe("formatPhone", () => {
  it("groups a Kenyan number and leaves others alone", () => {
    expect(formatPhone("+254712345678")).toBe("+254 712 345 678");
    expect(formatPhone("+447911123456")).toBe("+447911123456");
  });
});
