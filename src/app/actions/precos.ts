"use server";

// app/actions/precos.ts — Server Action for the /precos page.
//
// Wraps fetchPricingByPlate with input normalisation, a 90-day SQL cache
// (kbb_consultas table), and a stable `LookupResult` envelope the client
// component can switch on without awareness of platform internals.

import { fetchPricingByPlate } from "@/lib/pricing/client";
import type { MolicarPayload } from "@/lib/pricing/types";
import { isValidPlaca, normalizePlaca } from "@/lib/placa/normalize";
import * as kbb from "@/lib/db/kbbConsultas";
import { requireUserId } from "@/lib/auth/server";

export type PrecosLookupResult =
  | {
      ok: true;
      placa: string;
      payload: MolicarPayload;
      sourceId: string;
      upstreamLatencyMs: number | null;
      raw: unknown;
      /** True when served from kbb_consultas (cache hit). */
      fromCache: boolean;
      /** ISO timestamp the cached row was originally consulted at. */
      cachedAt: string | null;
      /** Row id when this lookup ended up persisted, for deep-linking. */
      consultaId: string | null;
    }
  | { ok: false; error: string };

// Translations for every error tag the client.ts adapter can emit, including
// the HTTP code mappings documented in PricingAPI v3.0.6 §6.
const ERROR_MESSAGES: Record<string, string> = {
  pricing_timeout: "Tempo esgotado consultando os preços.",
  pricing_unreachable: "Não foi possível conectar ao serviço de preços.",
  pricing_invalid_json: "Resposta inválida do serviço de preços.",
  pricing_schema_mismatch: "Formato da resposta mudou — contate o suporte.",
  pricing_auth_invalid: "Credenciais do serviço de preços inválidas ou expiradas.",
  pricing_forbidden: "Sem permissão no plano atual para consultar este recurso.",
  pricing_rate_limited: "Limite de consultas excedido. Tente novamente em instantes.",
  pricing_upstream_timeout: "O fornecedor de preços demorou demais para responder.",
  plate_not_found: "Placa não encontrada na base de preços.",
  no_providers_ready:
    "Nenhum provedor de preços disponível. Verifique credenciais do Molicar no Key Vault.",
  invalid_plate: "Placa inválida. Use 7 caracteres (ex.: ABC1D23 ou ABC1234).",
};

export type LookupOptions = {
  /** Bypass the 90-day cache and force a new Molicar call. */
  forceRefresh?: boolean;
};

export async function lookupPlacaPrecos(
  rawPlaca: string,
  opts: LookupOptions = {},
): Promise<PrecosLookupResult> {
  const placa = normalizePlaca(rawPlaca);
  if (!isValidPlaca(placa)) {
    return { ok: false, error: ERROR_MESSAGES.invalid_plate };
  }
  const ownerId = await requireUserId();

  // 1. Cache check — return the most recent saved row for this placa (kept
  //    indefinitely; cleared only manually).
  if (!opts.forceRefresh) {
    try {
      const hit = await kbb.findFreshByPlaca(placa, ownerId);
      if (hit) {
        return {
          ok: true,
          placa,
          payload: hit.payload,
          sourceId: hit.row.source_id,
          upstreamLatencyMs: hit.row.upstream_latency_ms,
          raw: { sources: [{ id: hit.row.source_id, ok: true, data: hit.payload }] },
          fromCache: true,
          cachedAt: hit.row.consulted_at,
          consultaId: hit.row.id,
        };
      }
    } catch {
      // Cache failure must not block live consults — log + fall through.
    }
  }

  // 2. Live call to the pricing function.
  const result = await fetchPricingByPlate(placa);
  if (!result.ok) {
    const friendly =
      ERROR_MESSAGES[result.error] ??
      (result.status ? `Erro do serviço de preços (HTTP ${result.status}).` : "Erro desconhecido.");
    return { ok: false, error: friendly };
  }

  // 3. Persist (fire-and-forget semantics — failure here does not fail the
  //    lookup).
  let consultaId: string | null = null;
  try {
    const ins = await kbb.insert({
      placa,
      payload: result.payload,
      sourceId: result.sourceId,
      upstreamLatencyMs: result.upstreamLatencyMs,
      ownerId,
    });
    consultaId = ins.id;
  } catch {
    // ignore — already returned 200, history will just miss this row
  }

  return {
    ok: true,
    placa,
    payload: result.payload,
    sourceId: result.sourceId,
    upstreamLatencyMs: result.upstreamLatencyMs,
    raw: result.raw,
    fromCache: false,
    cachedAt: null,
    consultaId,
  };
}
