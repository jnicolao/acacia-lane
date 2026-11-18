import { headers } from "next/headers";

const LOCAL_HOST = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/;

// True for a request made directly to this machine: a request that came
// through a tunnel or a public address carries that name in Host or
// X-Forwarded-Host. On the shop's own computer the owner's side opens without
// a password (see isOwner in lib/owner.ts), and practice steps need it.
export async function isLocalRequest(): Promise<boolean> {
  const requestHeaders = await headers();
  const hosts = [
    requestHeaders.get("host"),
    requestHeaders.get("x-forwarded-host"),
  ].filter((host) => host !== null);
  return hosts.length > 0 && hosts.every((host) => LOCAL_HOST.test(host));
}
