import type { OrderStatus } from "@/lib/types";
import { STATUS_LABEL } from "@/lib/wording";

const WAITING = "bg-amber-100 text-amber-900";
const MOVING = "bg-sky-100 text-sky-900";
const ENDED_BADLY = "bg-red-100 text-red-900";

const COLOURS: Record<OrderStatus, string> = {
  AWAITING_RECIPIENT: WAITING,
  AWAITING_APPROVAL: WAITING,
  AWAITING_PAYMENT: WAITING,
  PAYMENT_FAILED: ENDED_BADLY,
  PAID: MOVING,
  SCHEDULED: MOVING,
  DISPATCHED: MOVING,
  IN_TRANSIT: MOVING,
  DELIVERED: "bg-emerald-100 text-emerald-900",
  RETURNED: ENDED_BADLY,
  CANCELLED: ENDED_BADLY,
  REJECTED: ENDED_BADLY,
  EXPIRED: ENDED_BADLY,
  UNKNOWN: "bg-stone-200 text-stone-700",
};

export function StatusBadge({ status }: { status: OrderStatus }) {
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap ${
        COLOURS[status] ?? COLOURS.UNKNOWN
      }`}
    >
      {STATUS_LABEL[status] ?? STATUS_LABEL.UNKNOWN}
    </span>
  );
}
