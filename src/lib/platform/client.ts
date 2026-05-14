// platform/client.ts — server-side adapter to the Dadocar platform.
//
// The platform returns a unified aggregator response:
//   { sources: [{ id, ok, data: { dados: { dadosDoVeiculo, fipes }}}], ... }
//
// The webclient wants a FLAT object (see types.ts). This module:
//   1. Calls GET {DADOCAR_API_URL}/vehicle/plate/{placa} via APIM gateway,
//      authenticating with the per-customer `Ocp-Apim-Subscription-Key`.
//      DADOCAR_API_URL points at the product path (e.g. .../v1) so we only
//      append the operation here. APIM injects the backend function-key
//      and forwards to the enrichment Function App.
//   2. Picks the first ok Infocar-shaped source.
//   3. Flattens dadosDoVeiculo + fipes[0] into the canonical payload.
//   4. Zod-validates so a payload-shape regression surfaces here, not in
//      the UI.
//
// Strictly server-side. The subscription key never reaches the browser.

import "server-only";
import { VehiclePayloadSchema, FipeOptionSchema, type VehiclePayload, type FipeOption } from "./types";

const TIMEOUT_MS = 8_000;

function envOrThrow(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not set in the webclient environment`);
  return v;
}

export type PlatformOk = {
  ok: true;
  /** Flattened payload — dadosDoVeiculo + fipes[0] merged for the form. */
  payload: VehiclePayload;
  /** Every FIPE entry the vendor returned (0..N). UI uses this for the
   *  picker when length > 1; flattened payload already reflects fipes[0]. */
  fipeOptions: FipeOption[];
  /** The full unwrapped aggregator response, for the "Ler JSON" modal. */
  raw: unknown;
  cached: boolean;
};
export type PlatformErr = { ok: false; error: string; status?: number };

export async function fetchVehicleByPlate(placa: string, signal?: AbortSignal): Promise<PlatformOk | PlatformErr> {
  const base = envOrThrow("DADOCAR_API_URL").replace(/\/$/, "");
  const key = envOrThrow("DADOCAR_API_KEY");

  // Timeout via AbortController. Composed with the caller's signal so an
  // upstream cancel (user typed a new plate before this one resolved)
  // wins immediately.
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(new Error("platform_timeout")), TIMEOUT_MS);
  const onUpstreamAbort = () => ac.abort(signal?.reason);
  signal?.addEventListener("abort", onUpstreamAbort, { once: true });

  let res: Response;
  try {
    // Goes through APIM gateway (dadocar-dev-apim-brs.azure-api.net/v1).
    // APIM injects the function-key on the backend hop; the customer-facing
    // credential is the per-subscription Ocp-Apim-Subscription-Key. Base
    // URL already includes the /v1 product path — append the operation only.
    res = await fetch(`${base}/vehicle/plate/${encodeURIComponent(placa)}`, {
      headers: { "Ocp-Apim-Subscription-Key": key, Accept: "application/json" },
      signal: ac.signal,
      cache: "no-store",
    });
  } catch (err) {
    return { ok: false, error: (err as Error).message || "platform_unreachable" };
  } finally {
    clearTimeout(t);
    signal?.removeEventListener("abort", onUpstreamAbort);
  }

  if (!res.ok) {
    return { ok: false, error: `platform_${res.status}`, status: res.status };
  }

  let body: unknown;
  try {
    body = await res.json();
  } catch {
    return { ok: false, error: "platform_invalid_json", status: res.status };
  }

  // Aggregator response — find the first source that actually has data.
  const wrapped = body as {
    sources?: Array<{
      id?: string;
      ok?: boolean;
      data?: {
        dados?: {
          dadosDoVeiculo?: Record<string, unknown>;
          fipes?: Array<Record<string, unknown>>;
        };
      };
    }>;
    cached?: boolean;
  };

  const source = (wrapped.sources || []).find(
    (s) => s?.ok && s.data?.dados?.dadosDoVeiculo,
  );
  if (!source) return { ok: false, error: "no_data_for_plate", status: res.status };

  const veiculo = source.data!.dados!.dadosDoVeiculo!;
  const fipesRaw = source.data!.dados!.fipes ?? [];

  // Validate each FIPE option through the schema so the UI sees a clean
  // array. Drop entries that fail to parse (extremely defensive — schema
  // fields are all optional today). Keep ORIGINAL order; Infocar puts the
  // best-match trim first in our limited sample.
  const fipeOptions: FipeOption[] = fipesRaw
    .map((f) => FipeOptionSchema.safeParse(f))
    .filter((r) => r.success)
    .map((r) => r.data!);

  // Default-flatten with the first FIPE option; the UI may overwrite these
  // form fields when the operator picks a different one from the dropdown.
  const fipe = fipeOptions[0] ?? { codigoFipe: "", descricao: "", valor: "" };
  const flat = {
    ...veiculo,
    codigoFipe: fipe.codigoFipe ?? "",
    descricao: fipe.descricao ?? "",
    valor: fipe.valor ?? "",
  };

  const parsed = VehiclePayloadSchema.safeParse(flat);
  if (!parsed.success) {
    return { ok: false, error: "platform_schema_mismatch" };
  }

  return {
    ok: true,
    payload: parsed.data,
    fipeOptions,
    raw: body,
    cached: Boolean(wrapped.cached),
  };
}
