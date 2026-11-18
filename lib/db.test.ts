import { beforeEach, describe, expect, it, vi } from "vitest";
import { emptyDb, findOrder, type Db, type StoreOrder } from "./db";

// What the shared cache holds, and what the database holds now.
const stored = { cached: emptyDb(), now: emptyDb() };
const readDataFile = vi.fn(async (_name: string, _fallback: () => Db, options?: { cached?: boolean }) =>
  options?.cached === false ? stored.now : stored.cached,
);
vi.mock("./data-file", () => ({ readDataFile: (...args: Parameters<typeof readDataFile>) => readDataFile(...args) }));
vi.mock("./settings", () => ({ isMockMode: () => false }));

const order = (reference: string) => ({ reference }) as StoreOrder;

beforeEach(() => {
  stored.cached = emptyDb();
  stored.now = emptyDb();
  readDataFile.mockClear();
});

describe("findOrder", () => {
  it("finds an order in the cached copy without asking the database", async () => {
    stored.cached.orders.push(order("AL-TEST-1001"));
    expect(await findOrder("AL-TEST-1001")).toEqual(order("AL-TEST-1001"));
    expect(readDataFile).toHaveBeenCalledTimes(1);
  });

  it("asks the database itself for an order placed a moment ago, not yet in the cache", async () => {
    stored.now.orders.push(order("AL-TEST-1002"));
    expect(await findOrder("AL-TEST-1002")).toEqual(order("AL-TEST-1002"));
    expect(readDataFile.mock.calls[1][2]).toEqual({ cached: false });
  });
});
