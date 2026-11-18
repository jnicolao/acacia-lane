import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies, headers } from "next/headers";
import { readDataFile, updateDataFile } from "./data-file";
import { isLocalRequest } from "./local-only";

// Who may open the owner's side: a browser on the shop's own computer, or one
// signed in with the owner's password, ADMIN_PASSWORD, set where the shop is
// hosted. A signed-in browser keeps a cookie saying until when. It is signed
// with a random secret the shop keeps with its data, mixed with the password,
// so changing the password signs every browser out.
const COOKIE = "owner_session";
const SESSION_MS = 7 * 24 * 3600_000;
const MAX_WRONG = 5; // wrong passwords from one address...
const WRONG_WINDOW_MS = 15 * 60_000; // ...within this long, then it waits

export type SignInData = {
  secret: string;
  // Times of recent wrong passwords, by a hash of the address they came from.
  wrong: Record<string, number[]>;
};
const FILE = "sign-in.json";
const newSignInData = (): SignInData => ({ secret: randomBytes(32).toString("hex"), wrong: {} });

const sha256 = (text: string) => createHash("sha256").update(text).digest();

export const canSignIn = () => Boolean(process.env.ADMIN_PASSWORD);

export function sessionToken(secret: string, password: string, expires: number): string {
  const signature = createHmac("sha256", secret)
    .update(`${expires}.`)
    .update(sha256(password))
    .digest("hex");
  return `${expires}.${signature}`;
}

export function isValidSession(
  token: string,
  secret: string,
  password: string,
  now: number,
): boolean {
  const expires = token.split(".")[0];
  if (!/^\d+$/.test(expires) || Number(expires) < now) return false;
  const expected = Buffer.from(sessionToken(secret, password, Number(expires)));
  const given = Buffer.from(token);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

// One try at the password from `address`. Forgets wrong tries older than the
// window, refuses to check at all after too many, and records a wrong one.
export function tryPassword(
  data: SignInData,
  address: string,
  given: string,
  password: string,
  now: number,
): "ok" | "wrong" | "wait" {
  for (const [key, times] of Object.entries(data.wrong)) {
    const recent = times.filter((time) => now - time < WRONG_WINDOW_MS);
    if (recent.length) data.wrong[key] = recent;
    else delete data.wrong[key];
  }
  const wrong = data.wrong[address] ?? [];
  if (wrong.length >= MAX_WRONG) return "wait";
  if (timingSafeEqual(sha256(given), sha256(password))) {
    delete data.wrong[address];
    return "ok";
  }
  data.wrong[address] = [...wrong, now];
  return "wrong";
}

// Every owner's page and every owner's button calls this itself.
export async function isOwner(): Promise<boolean> {
  return (await isLocalRequest()) || (await isSignedIn());
}

// Signed in with the password, as opposed to opened on the shop's computer.
export async function isSignedIn(): Promise<boolean> {
  const password = process.env.ADMIN_PASSWORD;
  const token = (await cookies()).get(COOKIE)?.value;
  if (!password || !token) return false;
  const { secret } = await readDataFile(FILE, newSignInData);
  return isValidSession(token, secret, password, Date.now());
}

export async function signIn(given: string): Promise<"ok" | "wrong" | "wait" | "off"> {
  const password = process.env.ADMIN_PASSWORD;
  if (!password) return "off";
  // Vercel sets x-real-ip to the visitor's address. Only a hash is kept.
  const requestHeaders = await headers();
  const ip =
    requestHeaders.get("x-real-ip") ??
    requestHeaders.get("x-forwarded-for")?.split(",")[0].trim() ??
    "unknown";
  const address = createHash("sha256").update(ip).digest("hex").slice(0, 16);
  const now = Date.now();
  const { result, secret } = await updateDataFile(FILE, newSignInData, (data) => ({
    result: tryPassword(data, address, given, password, now),
    secret: data.secret,
  }));
  if (result === "ok") {
    (await cookies()).set(COOKIE, sessionToken(secret, password, now + SESSION_MS), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_MS / 1000,
    });
  }
  return result;
}

export async function signOut(): Promise<void> {
  (await cookies()).delete(COOKIE);
}
