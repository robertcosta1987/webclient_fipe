"use server";

// app/actions/checktudo.ts — Server Action for the /checktudo page.
//
// Wraps fetchChecktudoByPlate with input normalisation, a 90-day SQL cache
// (checktudo_consultas, keyed by placa + product_code), and a stable
// LookupResult envelope the client component can switch on. Mirrors
// app/actions/precos.ts.

import { fetchChecktudoByPlate } from "@/lib/checktudo/client";
import {
  CHECKTUDO_DEFAULT_PRODUCT,
  isValidProduct,
  productName,
  type ChecktudoData,
} from "@/lib/checktudo/types";
import { isValidPlaca, normalizePlaca } from "@/lib/placa/normalize";
import * as ct from "@/lib/db/checktudoConsultas";

export type ChecktudoLookupResult =
  | {
      ok: true;
      placa: string;
      product: { code: number; name: string };
      data: ChecktudoData;
      queryId: string | null;
      upstreamLatencyMs: number | null;
      raw: unknown;
      /** True when served from checktudo_consultas (cache hit). */
      fromCache: boolean;
      /** ISO timestamp the cached row was originally consulted at. */
      cachedAt: string | null;
      /** Row id when this lookup ended up persisted. */
      consultaId: string | null;
    }
  | { ok: false; error: string };

const ERROR_MESSAGES: Record<string, string> = {
  checktudo_timeout: "Tempo esgotado consultando o CheckTudo.",
  checktudo_unreachable: "Não foi possível conectar ao serviço CheckTudo.",
  checktudo_invalid_json: "Resposta inválida do serviço CheckTudo.",
  checktudo_schema_mismatch: "Formato da resposta mudou — contate o suporte.",
  checktudo_auth_invalid: "Credenciais do CheckTudo inválidas ou expiradas.",
  checktudo_forbidden: "Sem permissão no plano CheckTudo para este produto.",
  checktudo_rate_limited: "Limite de consultas excedido. Tente novamente em instantes.",
  poll_timeout: "O CheckTudo demorou demais para concluir a consulta. Tente novamente.",
  plate_not_found: "Placa não encontrada na base CheckTudo.",
  duplicate_no_result: "Consulta já executada recentemente, mas o resultado não pôde ser recuperado. Tente novamente em instantes.",
  invalid_request: "Requisição inválida (placa ou produto).",
  invalid_plate: "Placa inválida. Use 7 caracteres (ex.: ABC1D23 ou ABC1234).",
  invalid_product: "Produto CheckTudo inválido.",
  auth_failed: "Falha ao autenticar no CheckTudo. Verifique as credenciais no Key Vault.",
};

export type LookupOptions = {
  /** Bypass the 90-day cache and force a new CheckTudo call. */
  forceRefresh?: boolean;
};

export async function lookupPlacaChecktudo(
  rawPlaca: string,
  rawProduct: number = CHECKTUDO_DEFAULT_PRODUCT,
  opts: LookupOptions = {},
): Promise<ChecktudoLookupResult> {
  const placa = normalizePlaca(rawPlaca);
  if (!isValidPlaca(placa)) {
    return { ok: false, error: ERROR_MESSAGES.invalid_plate };
  }
  const productCode = Number(rawProduct);
  if (!isValidProduct(productCode)) {
    return { ok: false, error: ERROR_MESSAGES.invalid_product };
  }

  // 1. Cache check — most recent row for placa+product if <= 90 days old.
  if (!opts.forceRefresh) {
    try {
      const hit = await ct.findFreshByPlaca(placa, productCode);
      if (hit) {
        return {
          ok: true,
          placa,
          product: { code: productCode, name: hit.row.product_name ?? productName(productCode) },
          data: hit.data,
          queryId: hit.row.query_id,
          upstreamLatencyMs: hit.row.upstream_latency_ms,
          raw: { ok: true, product: { code: productCode, name: hit.row.product_name }, data: hit.data },
          fromCache: true,
          cachedAt: hit.row.consulted_at,
          consultaId: hit.row.id,
        };
      }
    } catch {
      // Cache failure must not block live consults — fall through.
    }
  }

  // 2. Live call to the CheckTudo function.
  const result = await fetchChecktudoByPlate(placa, productCode);
  if (!result.ok) {
    const friendly =
      ERROR_MESSAGES[result.error] ??
      (result.status ? `Erro do serviço CheckTudo (HTTP ${result.status}).` : "Erro desconhecido.");
    return { ok: false, error: friendly };
  }

  // 3. Persist (failure here does not fail the lookup).
  let consultaId: string | null = null;
  try {
    const ins = await ct.insert({
      placa,
      productCode: result.product.code,
      productName: result.product.name,
      data: result.data,
      queryId: result.queryId,
      upstreamLatencyMs: result.upstreamLatencyMs,
    });
    consultaId = ins.id;
  } catch {
    // ignore — already have a result; history just misses this row.
  }

  return {
    ok: true,
    placa,
    product: result.product,
    data: result.data,
    queryId: result.queryId,
    upstreamLatencyMs: result.upstreamLatencyMs,
    raw: result.raw,
    fromCache: false,
    cachedAt: null,
    consultaId,
  };
}
