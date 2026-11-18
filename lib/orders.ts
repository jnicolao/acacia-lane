import type { StoreOrder, TimelineEntry } from "./db";
import type { IntegrationOrder } from "./types";

// True when `snapshot` says something the store has not recorded yet: a later
// `updatedAt`, or, when PickSpot sends none, a different status.
export function isNews(order: StoreOrder, snapshot: IntegrationOrder): boolean {
  if (!snapshot.updatedAt || order.pickspotUpdatedAt === null) {
    return snapshot.status !== order.status;
  }
  return Date.parse(snapshot.updatedAt) > Date.parse(order.pickspotUpdatedAt);
}

// Records a PickSpot snapshot of an order (from the create call, a webhook or
// a refresh) on its timeline, and makes it the order's current state unless a
// newer snapshot is already recorded. "Newer" is decided by the snapshot's own
// `updatedAt`; when PickSpot does not send one, by `fallbackTime`.
// Returns false when the snapshot was older and the status was left alone.
export function applySnapshot(
  order: StoreOrder,
  snapshot: IntegrationOrder,
  entry: Pick<TimelineEntry, "at" | "source" | "event" | "note">,
  fallbackTime: string,
): boolean {
  const pickspotTime = snapshot.updatedAt ?? fallbackTime;
  const stale =
    order.pickspotUpdatedAt !== null &&
    Date.parse(pickspotTime) < Date.parse(order.pickspotUpdatedAt);

  order.timeline.push({
    ...entry,
    status: snapshot.status,
    pickspotTime,
    note: stale ? "Ignored: older than the state already recorded" : entry.note,
    ...(stale && { ignored: true }),
  });
  if (stale) return false;

  order.status = snapshot.status;
  order.pickspot = snapshot;
  order.pickspotUpdatedAt = pickspotTime;
  return true;
}
