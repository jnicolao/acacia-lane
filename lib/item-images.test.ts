import { beforeEach, describe, expect, it, vi } from "vitest";
import type { OrderLine } from "./db";
import { attachItemImages } from "./item-images";
import { linesToPickspotItems } from "./products";

// The store's data files, kept in memory, and a store set up for real mode.
const files: Record<string, unknown> = {};
vi.mock("./data-file", () => ({
  readDataFile: async (name: string, fallback: () => unknown) =>
    structuredClone(files[name]) ?? fallback(),
  updateDataFile: async (name: string, fallback: () => unknown, change: (data: unknown) => unknown) => {
    const data = structuredClone(files[name]) ?? fallback();
    const result = change(data);
    files[name] = data;
    return result;
  },
}));
const settings = { apiBaseUrl: "https://api.test/v1", apiKey: "pk_test_unit" };
vi.mock("./settings", () => ({
  getSettings: async () => settings,
  isMockMode: () => false,
}));

// PickSpot's upload endpoint: answers each upload with a new key.
const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);
const acceptUploads = () =>
  fetchMock.mockImplementation(async () =>
    Response.json({ key: `pickspot-orders/${fetchMock.mock.calls.length}.jpg` }, { status: 201 }),
  );

const line = (productId: string): OrderLine => ({
  productId,
  name: productId,
  quantity: 1,
  unitPrice: 100,
});

beforeEach(() => {
  for (const name of Object.keys(files)) delete files[name];
  fetchMock.mockReset();
  settings.apiBaseUrl = "https://api.test/v1";
});

describe("attachItemImages", () => {
  it("uploads each product picture and sends its key with the item", async () => {
    acceptUploads();
    const lines = [line("coffee"), line("tea")];

    expect(await attachItemImages(lines)).toBeNull();
    expect(lines.map((l) => l.imageKey)).toEqual([
      "pickspot-orders/1.jpg",
      "pickspot-orders/2.jpg",
    ]);
    expect(linesToPickspotItems(lines).map((item) => item.imageKeys)).toEqual([
      ["pickspot-orders/1.jpg"],
      ["pickspot-orders/2.jpg"],
    ]);
  });

  it("sends the picture as the multipart field `image`, with the API key", async () => {
    acceptUploads();
    await attachItemImages([line("coffee")]);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.test/v1/integrations/images");
    expect(init.method).toBe("POST");
    // No content type of our own: fetch adds the multipart one with its boundary.
    expect(init.headers).toEqual({ "x-api-key": "pk_test_unit" });
    const file = (init.body as FormData).get("image") as File;
    expect(file.name).toBe("coffee.jpg");
    expect(file.type).toBe("image/jpeg");
    expect(file.size).toBeGreaterThan(1000);
  });

  it("uploads a picture once, and again for another PickSpot backend", async () => {
    acceptUploads();
    await attachItemImages([line("coffee")]);

    const again = [line("coffee")];
    await attachItemImages(again);
    expect(again[0].imageKey).toBe("pickspot-orders/1.jpg");
    expect(fetchMock).toHaveBeenCalledTimes(1);

    settings.apiBaseUrl = "https://other.test/v1";
    const elsewhere = [line("coffee")];
    await attachItemImages(elsewhere);
    expect(elsewhere[0].imageKey).toBe("pickspot-orders/2.jpg");
  });

  it("leaves the order without pictures and says why when PickSpot refuses the upload", async () => {
    fetchMock.mockImplementation(async () =>
      Response.json({ err: "You are required to provide auth credentials" }, { status: 401 }),
    );
    const lines = [line("coffee"), line("tea")];

    expect(await attachItemImages(lines)).toBe(
      "HTTP 401 · You are required to provide auth credentials",
    );
    expect(linesToPickspotItems(lines).some((item) => "imageKeys" in item)).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1); // no second try that would fail the same way
    expect(files).toEqual({}); // nothing remembered
  });
});
