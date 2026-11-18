"use client";

import { useActionState, useState } from "react";
import {
  checkForUpdatesAction,
  practiceUpdateAction,
  saveSettingsAction,
  testConnectionAction,
  type ActionResult,
} from "@/app/admin/actions";
import { WEBHOOK_EVENTS } from "@/lib/types";
import { EVENT_TEXT } from "@/lib/wording";

const INPUT =
  "mt-1 w-full rounded-md border border-stone-300 px-3 py-2 font-mono text-sm focus:border-emerald-700 focus:outline-none";
const BUTTON =
  "rounded-md border border-stone-900 px-4 py-2 text-sm font-semibold transition-[transform,background-color] duration-150 ease-out hover:bg-stone-100 active:scale-[0.97] disabled:opacity-40";
const PRIMARY_BUTTON =
  "rounded-md bg-emerald-700 px-4 py-2 text-sm font-semibold text-white transition-[transform,background-color] duration-150 ease-out hover:bg-emerald-800 active:scale-[0.97] disabled:opacity-40";

function Result({ result }: { result: ActionResult }) {
  if (!result) return null;
  return (
    <p
      role="status"
      className={`rounded-md border p-3 text-sm ${
        result.ok ? "border-emerald-300 bg-emerald-50" : "border-red-300 bg-red-50"
      }`}
    >
      {result.ok ? "✓ " : "✗ "}
      {result.message}
      {result.detail && (
        <span className="mt-1 block text-xs break-words text-stone-600">
          {result.detail}
        </span>
      )}
    </p>
  );
}

// The one place in the shop that speaks PickSpot's technical language: these
// are the names the PickSpot business account uses for the same things.
export function SettingsForm(props: {
  publicUrl: string;
  envPublicUrl: string;
  maskedApiKey: string;
  maskedWebhookSecret: string;
}) {
  const [result, save, saving] = useActionState(saveSettingsAction, null);
  return (
    <form action={save} className="space-y-4">
      <label className="block text-sm font-medium">
        API key
        <input
          name="apiKey"
          type="password"
          autoComplete="off"
          placeholder={props.maskedApiKey || "pk_test_… or pk_live_…"}
          className={INPUT}
        />
        <Saved masked={props.maskedApiKey} />
      </label>
      <label className="block text-sm font-medium">
        Webhook signing secret
        <input
          name="webhookSecret"
          type="password"
          autoComplete="off"
          placeholder={props.maskedWebhookSecret || "whsec_…"}
          className={INPUT}
        />
        <Saved masked={props.maskedWebhookSecret} />
      </label>
      <label className="block text-sm font-medium">
        Your shop&apos;s web address
        <input
          name="publicUrl"
          defaultValue={props.publicUrl}
          placeholder={props.envPublicUrl || "https://www.your-shop.com"}
          className={INPUT}
        />
        <span className="mt-1 block text-xs font-normal text-stone-500">
          Where customers find your shop on the internet. PickSpot sends order
          updates to this address.
          {props.envPublicUrl && ` Leave empty to use ${props.envPublicUrl}.`}
        </span>
      </label>
      <button type="submit" disabled={saving} className={PRIMARY_BUTTON}>
        {saving ? "Saving…" : "Save"}
      </button>
      <Result result={result} />
    </form>
  );
}

function Saved({ masked }: { masked: string }) {
  return (
    <span className="mt-1 block text-xs font-normal text-stone-500">
      {masked ? (
        <>
          Saved: <span className="font-mono">{masked}</span>. Leave empty to keep
          it, or paste a new one to replace it.
        </>
      ) : (
        "Nothing saved yet."
      )}
    </span>
  );
}

export function TestConnection() {
  const [result, test, testing] = useActionState(testConnectionAction, null);
  return (
    <form action={test} className="space-y-3">
      <button type="submit" disabled={testing} className={BUTTON}>
        {testing ? "Checking…" : "Check connection"}
      </button>
      <Result result={result} />
    </form>
  );
}

export function CopyField({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex gap-2">
      <input readOnly value={value} aria-label="Webhook URL" className={`${INPUT} mt-0`} />
      <button
        type="button"
        className={BUTTON}
        onClick={async () => {
          await navigator.clipboard.writeText(value);
          setCopied(true);
        }}
      >
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}

export function CheckForUpdates({ reference }: { reference: string }) {
  const [result, check, checking] = useActionState(checkForUpdatesAction, null);
  return (
    <form action={check} className="space-y-3">
      <input type="hidden" name="reference" value={reference} />
      <button type="submit" disabled={checking} className={BUTTON}>
        {checking ? "Checking…" : "Check for updates"}
      </button>
      <Result result={result} />
    </form>
  );
}

// Practice mode only: lets you play the customer and the rider.
export function PracticePanel({ reference }: { reference: string }) {
  const [result, apply, applying] = useActionState(practiceUpdateAction, null);
  // Controlled, so the choice survives the form reset that follows each send.
  const [event, setEvent] = useState("claim.claimed");
  return (
    <form action={apply} className="space-y-3 rounded-xl border border-amber-300 bg-amber-50 p-4">
      <h2 className="font-semibold">Practice mode: move this order along</h2>
      <p className="text-sm text-stone-700">
        Pick what happens next, as if the customer or the rider had done it.
      </p>
      <input type="hidden" name="reference" value={reference} />
      <div className="flex flex-wrap items-center gap-3">
        <select
          name="event"
          value={event}
          onChange={(change) => setEvent(change.target.value)}
          aria-label="What happens next"
          className="min-w-0 flex-1 rounded-md border border-stone-300 bg-white px-3 py-2 text-sm"
        >
          {WEBHOOK_EVENTS.map((name) => (
            <option key={name} value={name}>
              {EVENT_TEXT[name]}
            </option>
          ))}
        </select>
        <button type="submit" disabled={applying} className={BUTTON}>
          {applying ? "Working…" : "Make it happen"}
        </button>
      </div>
      <Result result={result} />
    </form>
  );
}
