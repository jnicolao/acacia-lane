import fs from "node:fs";
import path from "node:path";

// Everything the store remembers lives in JSON files under .data/ (git-ignored).
// Reads and writes are synchronous, so a read-modify-write is never interleaved
// with another one inside the single Next.js server process.
const DIR = path.join(process.cwd(), ".data");

export function readDataFile<T>(name: string, fallback: () => T): T {
  try {
    return JSON.parse(fs.readFileSync(path.join(DIR, name), "utf8")) as T;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return fallback();
    throw error;
  }
}

export function writeDataFile(name: string, data: unknown): void {
  fs.mkdirSync(DIR, { recursive: true });
  const file = path.join(DIR, name);
  fs.writeFileSync(`${file}.tmp`, JSON.stringify(data, null, 2));
  fs.renameSync(`${file}.tmp`, file);
}
