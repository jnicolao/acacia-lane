import fs from "node:fs";
import path from "node:path";
import { attachDatabasePool } from "@vercel/functions";
import { cacheLife, cacheTag, revalidateTag } from "next/cache";
import { Pool } from "pg";

// Everything the store remembers is a few named JSON documents: the orders and
// update log, the settings, and the keys of uploaded pictures.
//
// - Without DATABASE_URL (the shop's own computer) each one is a file under
//   .data/ (git-ignored). A change reads, changes and writes the file without
//   pausing, so two requests in the one server process never interleave.
// - With DATABASE_URL (Vercel, where files do not last) each one is a row in
//   a Postgres table. A change locks the row until it is saved, so copies of
//   the shop running at the same time never overwrite each other. Reads come
//   from Next.js's shared cache, emptied on every save, so pages that redraw
//   every few seconds do not keep the database awake.
const DIR = path.join(process.cwd(), ".data");

let pool: Pool | undefined;
let tableReady: Promise<unknown> | undefined;

async function database(): Promise<Pool | null> {
  const url = process.env.DATABASE_URL;
  if (!url) return null;
  if (!pool) {
    pool = new Pool({ connectionString: url });
    attachDatabasePool(pool); // closes idle connections before Vercel suspends
  }
  tableReady ??= pool
    .query("create table if not exists shop_data (name text primary key, data jsonb not null)")
    .catch((error) => {
      tableReady = undefined; // try again on the next call
      throw error;
    });
  await tableReady;
  return pool;
}

const tagFor = (name: string) => `data:${name}`;

// `cached: false` reads the database itself, for when what was just saved must
// be seen: a save empties the cache, but may do so just after it answers.
export async function readDataFile<T>(
  name: string,
  fallback: () => T,
  { cached = true } = {},
): Promise<T> {
  const db = await database();
  if (!db) return (readFile(name) as T | undefined) ?? fallback();
  if (cached) return ((await readRow(name)) as T | null) ?? fallback();
  const { rows } = await db.query("select data from shop_data where name = $1", [name]);
  return (rows[0]?.data as T | undefined) ?? fallback();
}

// Replaces the whole document.
export async function writeDataFile(name: string, data: unknown): Promise<void> {
  const db = await database();
  if (!db) return writeFile(name, data);
  await db.query(
    "insert into shop_data (name, data) values ($1, $2::jsonb) on conflict (name) do update set data = excluded.data",
    [name, JSON.stringify(data)],
  );
  revalidateTag(tagFor(name), { expire: 0 });
}

// Applies `change` to the document and saves it, as one step: nothing else can
// change the document in between. Returns what `change` returns.
export async function updateDataFile<T, R>(
  name: string,
  fallback: () => T,
  change: (data: T) => R,
): Promise<R> {
  const db = await database();
  if (!db) {
    const data = (readFile(name) as T | undefined) ?? fallback();
    const result = change(data);
    writeFile(name, data);
    return result;
  }

  const client = await db.connect();
  try {
    await client.query("begin");
    // The row has to exist to be locked.
    await client.query(
      "insert into shop_data (name, data) values ($1, $2::jsonb) on conflict (name) do nothing",
      [name, JSON.stringify(fallback())],
    );
    const { rows } = await client.query("select data from shop_data where name = $1 for update", [
      name,
    ]);
    const data = rows[0].data as T;
    const result = change(data);
    await client.query("update shop_data set data = $2::jsonb where name = $1", [
      name,
      JSON.stringify(data),
    ]);
    await client.query("commit");
    revalidateTag(tagFor(name), { expire: 0 });
    return result;
  } catch (error) {
    await client.query("rollback").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

// Shared by every copy of the shop. Emptied by each save of the same document;
// otherwise asked again at most once an hour.
async function readRow(name: string): Promise<unknown> {
  "use cache: remote";
  cacheTag(tagFor(name));
  cacheLife("hours");
  const db = (await database())!;
  const { rows } = await db.query("select data from shop_data where name = $1", [name]);
  return rows[0]?.data ?? null;
}

function readFile(name: string): unknown {
  try {
    return JSON.parse(fs.readFileSync(path.join(DIR, name), "utf8"));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }
}

function writeFile(name: string, data: unknown): void {
  fs.mkdirSync(DIR, { recursive: true });
  const file = path.join(DIR, name);
  fs.writeFileSync(`${file}.tmp`, JSON.stringify(data, null, 2));
  fs.renameSync(`${file}.tmp`, file);
}
