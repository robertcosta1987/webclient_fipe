"use server";

// app/actions/precos.ts — Server Action for the /precos page.
//
// Wraps fetchPricingByPlate with input normalisation and a stable
// `LookupResult` envelope the client component can switch on without
// awareness of platform internals.

import { fetchPricingByPlate } from "@/lib/pricing/client";
import type { MolicarPayload } from "@/lib/pricing/types";
import { isValidPlaca, normalizePlaca } from "@/lib/placa/normalize";

export type PrecosLookupResult =
  | {
      ok: true;
      placa: string;
      payload: MolicarPayload;
      sourceId: string;
      upstreamLatencyMs: number | null;
      raw: unknown;
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

export async function lookupPlacaPrecos(rawPlaca: string): Promise<PrecosLookupResult> {
  const placa = normalizePlaca(rawPlaca);
  if (!isValidPlaca(placa)) {
    return { ok: false, error: ERROR_MESSAGES.invalid_plate };
  }

  const result = await fetchPricingByPlate(placa);

  if (!result.ok) {
    const friendly =
      ERROR_MESSAGES[result.error] ??
      (result.status ? `Erro do serviço de preços (HTTP ${result.status}).` : "Erro desconhecido.");
    return { ok: false, error: friendly };
  }

  return {
    ok: true,
    placa,
    payload: result.payload,
    sourceId: result.sourceId,
    upstreamLatencyMs: result.upstreamLatencyMs,
    raw: result.raw,
  };
}
