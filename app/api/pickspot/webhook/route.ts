import { updateDb } from "@/lib/db";
import { getWebhookSecret } from "@/lib/settings";
import { processWebhook } from "@/lib/webhook";

// The URL PickSpot POSTs signed order events to. Reads the body as text
// because the signature covers the raw bytes, not the parsed JSON.
export async function POST(request: Request) {
  const rawBody = await request.text();
  const secret = await getWebhookSecret();
  const result = await updateDb((db) =>
    processWebhook(db, {
      rawBody,
      signature: request.headers.get("x-pickspot-signature"),
      secret,
    }),
  );
  return Response.json(
    { outcome: result.outcome, reason: result.reason },
    { status: result.httpStatus },
  );
}
