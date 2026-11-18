import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { readDataFile, writeDataFile } from "./data-file";
import type { OrderLine } from "./db";
import { uploadItemImage } from "./pickspot";
import { products } from "./products";
import { getSettings, isMockMode } from "./settings";

// The PickSpot app shows a picture next to each item of an order. The order
// request carries no picture itself: each one is uploaded first, and the key
// PickSpot answers with goes in the item's `imageKeys`.
//
// A picture is uploaded once. Its key is remembered per PickSpot backend and
// per file content, so a replaced picture is uploaded again. Deleting the
// file under .data/ makes the store upload everything afresh.
const keysFile = () => (isMockMode() ? "image-keys.mock.json" : "image-keys.json");

// Sets `imageKey` on each line whose product picture PickSpot has. Returns
// null when every line got one, otherwise why not. A missing picture never
// stops an order: it goes out without one.
export async function attachItemImages(lines: OrderLine[]): Promise<string | null> {
  const { apiBaseUrl } = getSettings();
  const remembered = readDataFile<Record<string, string>>(keysFile(), () => ({}));
  let uploaded = false;
  let problem: string | null = null;

  for (const line of lines) {
    const product = products.find((p) => p.id === line.productId)!;
    const picture = readFileSync(path.join(process.cwd(), "public", product.image));
    const id = `${apiBaseUrl} ${createHash("sha256").update(picture).digest("hex")}`;

    if (!remembered[id]) {
      const result = await uploadItemImage(
        new Blob([picture], { type: "image/jpeg" }),
        path.basename(product.image),
      );
      if (!result.ok || typeof result.data.key !== "string") {
        problem = result.ok
          ? `HTTP ${result.status} · the answer had no key`
          : `${result.status ? `HTTP ${result.status}` : "No response"} · ${result.message}`;
        break; // the next upload would fail the same way
      }
      remembered[id] = result.data.key;
      uploaded = true;
    }
    line.imageKey = remembered[id];
  }

  if (uploaded) writeDataFile(keysFile(), remembered);
  return problem;
}
