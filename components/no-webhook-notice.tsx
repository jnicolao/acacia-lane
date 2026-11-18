import Link from "next/link";
import { getPublicUrl, isMockMode } from "@/lib/settings";

// Shown in the admin when PickSpot has no way to tell the shop about changes.
export function NoWebhookNotice() {
  if (isMockMode() || getPublicUrl()) return null;
  return (
    <p className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
      <strong>Live updates are off.</strong> PickSpot cannot reach this shop
      yet, so an order only updates while its page is open.{" "}
      <Link href="/admin/settings" className="font-medium underline">
        Add your shop&apos;s web address in Settings
      </Link>
    </p>
  );
}
