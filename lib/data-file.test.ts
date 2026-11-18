import { describe, expect, it, vi } from "vitest";
import { readDataFile, updateDataFile, writeDataFile } from "./data-file";

// The database side, as on Vercel, against a real Postgres (PGlite, in memory)
// in place of the `pg` connection pool.
vi.mock("pg", async () => {
  const { PGlite } = await import("@electric-sql/pglite");
  const pglite = new PGlite();
  const query = (text: string, params?: unknown[]) => pglite.query(text, params);
  class Pool {
    query = query;
    async connect() {
      return { query, release() {} };
    }
  }
  return { Pool };
});
vi.mock("@vercel/functions", () => ({ attachDatabasePool: () => {} }));
const { revalidateTag } = vi.hoisted(() => ({ revalidateTag: vi.fn() }));
vi.mock("next/cache", () => ({ cacheLife: () => {}, cacheTag: () => {}, revalidateTag }));
vi.stubEnv("DATABASE_URL", "postgres://unit-test");

const counter = () => ({ count: 0 });

describe("data kept in Postgres", () => {
  it("reads the fallback while nothing is saved", async () => {
    expect(await readDataFile("empty.json", counter)).toEqual({ count: 0 });
  });

  it("saves each change, starting from the fallback, and returns what the change returns", async () => {
    expect(await updateDataFile("count.json", counter, (data) => ++data.count)).toBe(1);
    expect(await updateDataFile("count.json", counter, (data) => ++data.count)).toBe(2);
    expect(await readDataFile("count.json", counter)).toEqual({ count: 2 });
  });

  it("can read the database itself instead of the cache", async () => {
    await writeDataFile("fresh.json", { count: 3 });
    expect(await readDataFile("fresh.json", counter, { cached: false })).toEqual({ count: 3 });
    expect(await readDataFile("missing.json", counter, { cached: false })).toEqual({ count: 0 });
  });

  it("replaces a whole document", async () => {
    await writeDataFile("settings.json", { apiKey: "pk_test_one" });
    await writeDataFile("settings.json", { publicUrl: "https://shop.test" });
    expect(await readDataFile("settings.json", () => ({}))).toEqual({
      publicUrl: "https://shop.test",
    });
  });

  it("leaves the document as it was when a change fails", async () => {
    await updateDataFile("kept.json", counter, (data) => ++data.count);
    const failing = updateDataFile("kept.json", counter, (data) => {
      data.count = 99;
      throw new Error("no");
    });
    await expect(failing).rejects.toThrow("no");
    expect(await readDataFile("kept.json", counter)).toEqual({ count: 1 });
    // The connection is usable again afterwards.
    expect(await updateDataFile("kept.json", counter, (data) => ++data.count)).toBe(2);
  });

  it("empties the shared cache of a document each time it is saved", async () => {
    revalidateTag.mockClear();
    await updateDataFile("cached.json", counter, (data) => ++data.count);
    await writeDataFile("cached.json", { count: 5 });
    expect(revalidateTag.mock.calls).toEqual([
      ["data:cached.json", { expire: 0 }],
      ["data:cached.json", { expire: 0 }],
    ]);
  });
});
