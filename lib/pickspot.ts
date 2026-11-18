import * as mock from "./pickspot-mock";
import { getSettings, isMockMode } from "./settings";
import type {
  ApiResult,
  CreateOrderRequest,
  MeResponse,
  OrderResponse,
} from "./types";

// Server-side client for the PickSpot Integrations API. The API key is read
// from the saved settings on every call and only ever leaves this process in
// the x-api-key header of a request to the configured API base URL.
async function request<T>(
  method: "GET" | "POST",
  path: string,
  body?: unknown,
): Promise<ApiResult<T>> {
  const { apiBaseUrl, apiKey } = await getSettings();
  if (!apiBaseUrl) {
    return {
      ok: false,
      status: 0,
      message:
        "The shop has not been told where PickSpot is. Whoever installed it needs to set PICKSPOT_API_URL.",
    };
  }
  if (!apiKey) {
    return {
      ok: false,
      status: 0,
      message: "No API key is saved yet. Add one in Admin → Settings.",
    };
  }

  // A form (file upload) goes out as it is; anything else is sent as JSON.
  const isForm = body instanceof FormData;
  let response: Response;
  try {
    response = await fetch(`${apiBaseUrl}${path}`, {
      method,
      headers: {
        "x-api-key": apiKey,
        ...(body === undefined || isForm ? {} : { "content-type": "application/json" }),
      },
      body: body === undefined || isForm ? body : JSON.stringify(body),
      signal: AbortSignal.timeout(15_000),
    });
  } catch (error) {
    return {
      ok: false,
      status: 0,
      message: `Could not reach PickSpot at ${apiBaseUrl} (${(error as Error).message}).`,
    };
  }

  let json: Record<string, unknown> = {};
  try {
    json = await response.json();
  } catch {
    // Empty or non-JSON body: the status code is all there is to report.
  }

  if (response.ok) {
    return {
      ok: true,
      status: response.status,
      data: json as T,
      replay: response.headers.get("x-idempotent-replay") === "true",
    };
  }
  // Errors are `{ err }`; the 409 is `{ code, error, account }`. The account
  // (whose number it is) is deliberately not kept: the store never shows it.
  const message = json.err ?? json.error ?? json.message ?? response.statusText;
  return {
    ok: false,
    status: response.status,
    message: String(message),
    code: typeof json.code === "string" ? json.code : undefined,
  };
}

export async function getMe(): Promise<ApiResult<MeResponse>> {
  return isMockMode() ? mock.getMe() : request("GET", "/integrations/me");
}

export async function createOrder(
  body: CreateOrderRequest,
): Promise<ApiResult<OrderResponse>> {
  return isMockMode()
    ? mock.createOrder(body)
    : request("POST", "/integrations/checkout/orders", body);
}

// `id` may be the orderId, a parcelCode, a claim id or the store reference.
export async function getOrder(id: string): Promise<ApiResult<OrderResponse>> {
  return isMockMode()
    ? mock.getOrder(id)
    : request("GET", `/integrations/checkout/orders/${encodeURIComponent(id)}`);
}

// Uploads one item picture (JPEG, PNG or WebP, at most 10 MB) and returns the
// key to pass in `items[].imageKeys` when creating the order.
export async function uploadItemImage(
  image: Blob,
  fileName: string,
): Promise<ApiResult<{ key: string }>> {
  if (isMockMode()) return mock.uploadItemImage();
  const form = new FormData();
  form.append("image", image, fileName);
  return request("POST", "/file/upload-image/parcel-item", form);
}
