import { headers } from "next/headers";

const LOCAL_HOST = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/;

// The admin area has no login, and it can change where the saved API key is
// sent. So it only answers requests made directly to this machine: a request
// that came through a tunnel carries the tunnel's public name in Host or
// X-Forwarded-Host. Every admin page and every admin action must check this.
export async function isLocalRequest(): Promise<boolean> {
  const requestHeaders = await headers();
  const hosts = [
    requestHeaders.get("host"),
    requestHeaders.get("x-forwarded-host"),
  ].filter((host) => host !== null);
  return hosts.length > 0 && hosts.every((host) => LOCAL_HOST.test(host));
}
