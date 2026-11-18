import { describe, expect, it } from "vitest";
import { buildOrderRequest } from "./checkout";

describe("buildOrderRequest", () => {
  it("sends every item field the store has, the picture keys and the items total", () => {
    const lines = [
      {
        productId: "coffee",
        name: "Highland AA Coffee, 500 g",
        quantity: 2,
        unitPrice: 1450,
        imageKey: "parcels/items/2026-06-15/coffee.jpg",
      },
      // A picture that could not be uploaded: the item goes without imageKeys.
      { productId: "blanket", name: "Checked Shuka Blanket", quantity: 1, unitPrice: 2400 },
    ];

    expect(
      buildOrderRequest("AL-TEST-1001", lines, { phone: "+254712345678" }, ""),
    ).toEqual({
      reference: "AL-TEST-1001",
      recipient: { phone: "+254712345678" },
      items: [
        {
          description: "Highland AA Coffee, 500 g",
          quantity: 2,
          unitValue: 1450,
          currency: "KES",
          sku: "AL-COF-500",
          parcelClass: "SMALL",
          imageKeys: ["parcels/items/2026-06-15/coffee.jpg"],
        },
        {
          description: "Checked Shuka Blanket",
          quantity: 1,
          unitValue: 2400,
          currency: "KES",
          sku: "AL-BLK-RED",
          parcelClass: "MEDIUM",
        },
      ],
      declaredItemCostKes: 5300,
      autoDispatch: true,
      metadata: { platform: "CUSTOM" },
    });
  });

  it("adds the store and order links when the store has a public URL", () => {
    const request = buildOrderRequest(
      "AL-TEST-1002",
      [{ productId: "tea", name: "Purple Leaf Tea, 250 g", quantity: 1, unitPrice: 850 }],
      { phone: "+254712345678" },
      "https://shop.example.com",
    );
    expect(request.metadata).toEqual({
      platform: "CUSTOM",
      storeUrl: "https://shop.example.com",
      orderUrl: "https://shop.example.com/orders/AL-TEST-1002",
    });
  });
});
