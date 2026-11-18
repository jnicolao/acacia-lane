import { readDataFile, writeDataFile } from "./data-file";

export const WEBHOOK_PATH = "/api/pickspot/webhook";

// Used to sign and verify test webhooks in mock mode when no secret is saved.
const MOCK_WEBHOOK_SECRET = "whsec_mock_mode_only";

export type Settings = {
  apiBaseUrl: string;
  apiKey: string;
  webhookSecret: string;
  publicUrl: string;
};

export function isMockMode(): boolean {
  return process.env.PICKSPOT_MOCK === "1";
}

const stripSlashes = (url: string) => url.trim().replace(/\/+$/, "");

export function getSettings(): Settings {
  const saved = readDataFile<Partial<Settings>>("settings.json", () => ({}));
  return {
    // Which PickSpot the shop talks to is decided where the shop is installed
    // (the PICKSPOT_API_URL environment variable), not on the settings page.
    apiBaseUrl: stripSlashes(process.env.PICKSPOT_API_URL ?? ""),
    apiKey: saved.apiKey ?? "",
    webhookSecret: saved.webhookSecret ?? "",
    publicUrl: saved.publicUrl ?? "",
  };
}

// The address PickSpot can reach this store on (the tunnel address while
// testing locally). The saved setting wins; the PUBLIC_URL environment
// variable is used when none is saved.
export function getPublicUrl(): string {
  return stripSlashes(getSettings().publicUrl || process.env.PUBLIC_URL || "");
}

export function saveSettings(settings: Omit<Settings, "apiBaseUrl">): void {
  writeDataFile("settings.json", {
    ...settings,
    publicUrl: stripSlashes(settings.publicUrl),
  });
}

export function getWebhookSecret(): string {
  return getSettings().webhookSecret || (isMockMode() ? MOCK_WEBHOOK_SECRET : "");
}

// "pk_test_h3Kq••••••••9f2a": enough to recognise which credential is saved.
export function mask(secret: string): string {
  if (!secret) return "";
  if (secret.length < 20) return "••••••••";
  const prefixLength = secret.startsWith("pk_") ? 12 : 6;
  return `${secret.slice(0, prefixLength)}••••••••${secret.slice(-4)}`;
}
