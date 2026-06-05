// checktudo/client.ts — server-side adapter to the pricing-function-checktudo.
//
// Calls GET <base>/checktudo/plate/{placa}?product=<code> with CHECKTUDO_API_KEY
// in the x-functions-key header (the function key never reaches the browser),
// validates the envelope, and returns a stable discriminated union. Mirrors the
// shape/structure of lib/pricing/client.ts so the two integrations feel the same.
//
// Strictly server-side.

import "server-only";
import { ChecktudoEnvelopeSchema, productName, type ChecktudoData } from "./types";

const TIMEOUT_MS = 62_000; // the function polls up to ~55s; allow headroom.

function envOrThrow(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not set in the webclient environment`);
  return v;
}

/**
 * Resolves the CheckTudo function base URL.
 *
 * CHECKTUDO_API_APP_ID is the Azure Function App resource name (e.g.
 * "dadocar-dev-func-checktudo-brs") → `https://<APP_ID>.azurewebsites.net/api`.
 * A full https?:// value is used verbatim (handy for "http://localhost:7073/api").
 */
function checktudoBaseUrl(): string {
  const appId = envOrThrow("CHECKTUDO_API_APP_ID");
  if (/^https?:\/\//i.test(appId)) return appId.replace(/\/$/, "");
  return `https://${appId}.azurewebsites.net/api`;
}

export type ChecktudoOk = {
  ok: true;
  product: { code: number; name: string };
  data: ChecktudoData;
  queryId: string | null;
  refClass: string | null;
  upstreamLatencyMs: number | null;
  cachedUpstream: boolean;
  /** The full unwrapped function envelope, for the JSON viewer. */
  raw: unknown;
};
export type ChecktudoErr = { ok: false; error: string; status?: number; message?: string };

export async function fetchChecktudoByPlate(
  placa: string,
  productCode: number,
  signal?: AbortSignal,
): Promise<ChecktudoOk | ChecktudoErr> {
  const base = checktudoBaseUrl();
  const key = envOrThrow("CHECKTUDO_API_KEY");

  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(new Error("checktudo_timeout")), TIMEOUT_MS);
  const onUpstreamAbort = () => ac.abort(signal?.reason);
  signal?.addEventListener("abort", onUpstreamAbort, { once: true });

  let res: Response;
  try {
    const url = `${base}/checktudo/plate/${encodeURIComponent(placa)}?product=${encodeURIComponent(productCode)}`;
    res = await fetch(url, {
      headers: { "x-functions-key": key, Accept: "application/json" },
      signal: ac.signal,
      cache: "no-store",
    });
  } catch (err) {
    return { ok: false, error: (err as Error).message || "checktudo_unreachable" };
  } finally {
    clearTimeout(t);
    signal?.removeEventListener("abort", onUpstreamAbort);
  }

  if (!res.ok) {
    switch (res.status) {
      case 400: return { ok: false, error: "invalid_request", status: 400 };
      case 401: return { ok: false, error: "checktudo_auth_invalid", status: 401 };
      case 403: return { ok: false, error: "checktudo_forbidden", status: 403 };
      case 404: return { ok: false, error: "plate_not_found", status: 404 };
      case 429: return { ok: false, error: "checktudo_rate_limited", status: 429 };
      default:  return { ok: false, error: `checktudo_${res.status}`, status: res.status };
    }
  }

  let body: unknown;
  try {
    body = await res.json();
  } catch {
    return { ok: false, error: "checktudo_invalid_json", status: res.status };
  }

  const parsed = ChecktudoEnvelopeSchema.safeParse(body);
  if (!parsed.success) return { ok: false, error: "checktudo_schema_mismatch" };
  const env = parsed.data;

  if (!env.ok) {
    // Function reached CheckTudo but the consult failed. Map upstream codes to
    // stable tags; otherwise surface the function's error tag.
    const upstream = env.upstream_status;
    if (upstream === 404) return { ok: false, error: "plate_not_found", status: 404, message: env.message };
    if (upstream === 401) return { ok: false, error: "checktudo_auth_invalid", status: 401, message: env.message };
    return {
      ok: false,
      error: env.error || "upstream_failure",
      status: typeof upstream === "number" ? upstream : 502,
      message: env.message,
    };
  }

  const code = env.product?.code ?? productCode;
  const data = (env.data ?? {}) as ChecktudoData;

  return {
    ok: true,
    product: { code, name: env.product?.name ?? productName(code) },
    data,
    queryId: env.queryId ?? null,
    refClass: env.refClass ?? null,
    upstreamLatencyMs: env.latency_ms ?? null,
    cachedUpstream: Boolean(env.cached_upstream),
    raw: body,
  };
}
