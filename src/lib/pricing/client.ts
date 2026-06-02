// pricing/client.ts — server-side adapter to the pricing-function.
//
// The pricing function returns the unified aggregator shape:
//   { sources: [{ id, ok, data: { Decoder, VehicleData, Pricing, KBBPricing }}], ... }
//
// The webclient wants the FLAT Molicar payload (no sources wrapper) plus a
// few diagnostics. This module:
//   1. Builds the Function App base URL from PRICING_API_APP_ID and calls
//      GET <base>/pricing/plate/{placa} with PRICING_API_KEY in the
//      x-functions-key header. The function key never reaches the browser.
//   2. Picks the first ok Molicar-shaped source.
//   3. Zod-validates so a vendor-shape regression surfaces here, not in
//      the UI.
//
// Strictly server-side. The function key never reaches the browser.

import "server-only";
import { MolicarPayloadSchema, type MolicarPayload } from "./types";

const TIMEOUT_MS = 12_000;

function envOrThrow(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not set in the webclient environment`);
  return v;
}

/**
 * Resolves the pricing-function base URL.
 *
 * PRICING_API_APP_ID is the Azure Function App resource name (e.g.
 * "dadocar-dev-pricing"), so the URL becomes
 * `https://<APP_ID>.azurewebsites.net/api`.
 *
 * Convenience: if PRICING_API_APP_ID is set to a full https:// or http://
 * URL, it is used verbatim. That makes pointing at a local Functions host
 * ("http://localhost:7072/api") trivial for development.
 *
 * If you swap the gateway to APIM in the future, replace this helper — and
 * only this helper — with one that returns the APIM product URL, and treat
 * PRICING_API_KEY as the Ocp-Apim-Subscription-Key in the fetch call below.
 */
function pricingBaseUrl(): string {
  const appId = envOrThrow("PRICING_API_APP_ID");
  if (/^https?:\/\//i.test(appId)) {
    return appId.replace(/\/$/, "");
  }
  return `https://${appId}.azurewebsites.net/api`;
}

export type PricingOk = {
  ok: true;
  /** Validated Molicar payload (Decoder + VehicleData + Pricing + KBBPricing). */
  payload: MolicarPayload;
  /** Provider id that produced the payload (today always "molicar"). */
  sourceId: string;
  /** Round-trip latency reported by the function for that provider. */
  upstreamLatencyMs: number | null;
  /** The full unwrapped aggregator response, for diagnostics/JSON view. */
  raw: unknown;
};
export type PricingErr = { ok: false; error: string; status?: number };

export async function fetchPricingByPlate(
  placa: string,
  signal?: AbortSignal,
): Promise<PricingOk | PricingErr> {
  const base = pricingBaseUrl();
  const key = envOrThrow("PRICING_API_KEY");

  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(new Error("pricing_timeout")), TIMEOUT_MS);
  const onUpstreamAbort = () => ac.abort(signal?.reason);
  signal?.addEventListener("abort", onUpstreamAbort, { once: true });

  let res: Response;
  try {
    // Two auth styles both work on Azure Functions: the header is cleaner
    // and doesn't show up in route logs.
    res = await fetch(`${base}/pricing/plate/${encodeURIComponent(placa)}`, {
      headers: {
        "x-functions-key": key,
        Accept: "application/json",
      },
      signal: ac.signal,
      cache: "no-store",
    });
  } catch (err) {
    return { ok: false, error: (err as Error).message || "pricing_unreachable" };
  } finally {
    clearTimeout(t);
    signal?.removeEventListener("abort", onUpstreamAbort);
  }

  if (!res.ok) {
    // Map the documented PricingAPI v3.0.6 §6 HTTP codes into stable error
    // tags. The action layer translates these into friendly Portuguese.
    switch (res.status) {
      case 400: return { ok: false, error: "invalid_plate",            status: 400 };
      case 401: return { ok: false, error: "pricing_auth_invalid",     status: 401 };
      case 403: return { ok: false, error: "pricing_forbidden",        status: 403 };
      case 404: return { ok: false, error: "plate_not_found",          status: 404 };
      case 429: return { ok: false, error: "pricing_rate_limited",     status: 429 };
      case 502: return { ok: false, error: "pricing_upstream_timeout", status: 502 };
      default:  return { ok: false, error: `pricing_${res.status}`,    status: res.status };
    }
  }

  let body: unknown;
  try {
    body = await res.json();
  } catch {
    return { ok: false, error: "pricing_invalid_json", status: res.status };
  }

  const wrapped = body as {
    sources?: Array<{
      id?: string;
      ok?: boolean;
      data?: unknown;
      upstream_status?: number | null;
      latency_ms?: number | null;
      error?: string;
      message?: string;
    }>;
  };

  const sources = wrapped.sources ?? [];
  if (!sources.length) return { ok: false, error: "no_providers_ready", status: res.status };

  const source = sources.find((s) => s?.ok && s.data) ?? sources[0];

  if (!source.ok || !source.data) {
    // The function returned 200 with sources[].ok=false because the
    // upstream (Molicar) failed. Translate the upstream's own HTTP code
    // into our stable error tags, same as the outer switch above.
    const upstream = source.upstream_status;
    switch (upstream) {
      case 404: return { ok: false, error: "plate_not_found",          status: 404 };
      case 401: return { ok: false, error: "pricing_auth_invalid",     status: 401 };
      case 403: return { ok: false, error: "pricing_forbidden",        status: 403 };
      case 429: return { ok: false, error: "pricing_rate_limited",     status: 429 };
      case 502: return { ok: false, error: "pricing_upstream_timeout", status: 502 };
      default: {
        return {
          ok: false,
          error: source.error || "upstream_failure",
          status: typeof upstream === "number" ? upstream : 502,
        };
      }
    }
  }

  const parsed = MolicarPayloadSchema.safeParse(source.data);
  if (!parsed.success) {
    return { ok: false, error: "pricing_schema_mismatch" };
  }

  return {
    ok: true,
    payload: parsed.data,
    sourceId: source.id ?? "molicar",
    upstreamLatencyMs: source.latency_ms ?? null,
    raw: body,
  };
}
