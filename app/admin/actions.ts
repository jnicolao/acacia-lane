"use server";

import { refresh } from "next/cache";
import { headers } from "next/headers";
import { updateDb } from "@/lib/db";
import { isLocalRequest } from "@/lib/local-only";
import { applySnapshot } from "@/lib/orders";
import { getMe, getOrder } from "@/lib/pickspot";
import { recordMockEvent } from "@/lib/pickspot-mock";
import {
  getSettings,
  getWebhookSecret,
  isMockMode,
  saveSettings,
  WEBHOOK_PATH,
} from "@/lib/settings";
import { signPayload } from "@/lib/signature";
import { EVENT_TEXT, STATUS_LABEL } from "@/lib/wording";

// Every action here checks isLocalRequest() itself: a Server Action can be
// called from any page, so the check on the admin pages does not cover it.

export type ActionResult = { ok: boolean; message: string; detail?: string } | null;

const NOT_LOCAL: ActionResult = {
  ok: false,
  message: "This can only be done on the computer the shop runs on.",
};

const field = (form: FormData, name: string) => String(form.get(name) ?? "").trim();
const isHttpUrl = (value: string) => /^https?:\/\/\S+$/.test(value);

export async function saveSettingsAction(
  _previous: ActionResult,
  form: FormData,
): Promise<ActionResult> {
  if (!(await isLocalRequest())) return NOT_LOCAL;

  const publicUrl = field(form, "publicUrl");
  if (publicUrl && !isHttpUrl(publicUrl)) {
    return {
      ok: false,
      message: "The shop's web address must start with http:// or https://.",
    };
  }

  // An empty key or secret field means "keep the one that is saved".
  const saved = await getSettings();
  await saveSettings({
    publicUrl,
    apiKey: field(form, "apiKey") || saved.apiKey,
    webhookSecret: field(form, "webhookSecret") || saved.webhookSecret,
  });
  refresh();
  return { ok: true, message: "Saved." };
}

// What went wrong when PickSpot would not talk to the shop, for the owner.
function pickspotProblem(status: number): string {
  if (status === 401) {
    return "PickSpot did not recognise the API key. Check that the whole key was pasted, and that it has not been replaced or removed in your PickSpot account.";
  }
  if (status === 403) {
    return "PickSpot has paused this business account, or online shop connections are not switched on for it.";
  }
  if (status === 429) return "PickSpot is busy. Wait a moment and try again.";
  return "The shop could not reach PickSpot. Check the internet connection and try again.";
}

export async function testConnectionAction(): Promise<ActionResult> {
  if (!(await isLocalRequest())) return NOT_LOCAL;

  const result = await getMe();
  if (!result.ok) {
    return {
      ok: false,
      message: result.status
        ? pickspotProblem(result.status)
        : result.message, // nothing was sent: no key saved, or PickSpot unreachable
      detail: result.status ? `HTTP ${result.status} · ${result.message}` : undefined,
    };
  }
  const me = result.data;
  return {
    ok: true,
    message: `Connected to PickSpot as ${me.businessName ?? "your business"}.`,
    detail: me.hasDefaultLocation
      ? undefined
      : "One thing left: add a pickup location in your PickSpot account. Orders cannot be placed until riders know where to collect them.",
  };
}

// Asks PickSpot where the order is now, for when the shop may have missed news.
export async function checkForUpdatesAction(
  _previous: ActionResult,
  form: FormData,
): Promise<ActionResult> {
  if (!(await isLocalRequest())) return NOT_LOCAL;

  const reference = field(form, "reference");
  const result = await getOrder(reference);
  if (!result.ok) {
    return {
      ok: false,
      message:
        result.status === 404
          ? "PickSpot cannot find this order."
          : pickspotProblem(result.status),
    };
  }

  const now = new Date().toISOString();
  const { order: snapshot } = result.data;
  await updateDb((db) => {
    const order = db.orders.find((o) => o.reference === reference);
    if (order) applySnapshot(order, snapshot, { at: now, source: "refresh" }, now);
  });
  refresh();
  return { ok: true, message: `Up to date: ${STATUS_LABEL[snapshot.status].toLowerCase()}.` };
}

// Practice mode: makes `event` happen at the pretend PickSpot, then delivers
// the signed update to this shop's own receiver over HTTP, as PickSpot would.
export async function practiceUpdateAction(
  _previous: ActionResult,
  form: FormData,
): Promise<ActionResult> {
  if (!(await isLocalRequest())) return NOT_LOCAL;
  if (!isMockMode()) return { ok: false, message: "Only available in practice mode." };

  const envelope = await recordMockEvent(field(form, "reference"), field(form, "event"));
  if (!envelope) return { ok: false, message: "This order is not a practice order." };

  const rawBody = JSON.stringify(envelope);
  const signature = signPayload(rawBody, await getWebhookSecret(), Math.floor(Date.now() / 1000));

  // isLocalRequest() has established that Host is this machine.
  const host = (await headers()).get("host");
  const response = await fetch(`http://${host}${WEBHOOK_PATH}`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-pickspot-signature": signature },
    body: rawBody,
  });
  refresh();
  return response.ok
    ? { ok: true, message: `Done: ${(EVENT_TEXT[envelope.event] ?? envelope.event).toLowerCase()}.` }
    : { ok: false, message: "The shop did not accept the update.", detail: await response.text() };
}
