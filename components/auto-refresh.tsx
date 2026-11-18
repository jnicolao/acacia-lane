"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { catchUpAction } from "@/app/orders/actions";

// Re-renders the current page with fresh server data every 3 seconds while
// the tab is visible, so status changes from webhooks appear without a reload.
// With `catchUp` (an order reference) it also asks PickSpot about that order
// when the page opens and every 15 seconds, in case a webhook was missed.
export function AutoRefresh({ catchUp }: { catchUp?: string }) {
  const router = useRouter();
  useEffect(() => {
    let tick = 0;
    const refresh = async () => {
      if (document.visibilityState !== "visible") return;
      if (catchUp && tick++ % 5 === 0) await catchUpAction(catchUp);
      router.refresh();
    };
    if (catchUp) refresh();
    const timer = setInterval(refresh, 3000);
    return () => clearInterval(timer);
  }, [router, catchUp]);
  return null;
}
