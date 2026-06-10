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
import * as subs from "@/lib/db/subscriptions";
import { requireScope } from "@/lib/auth/server";
import { extractRecall } from "@/lib/checktudo/recall";
import { computeRecallVerdict } from "@/lib/checktudo/recallVerdict";
import { extractParecerSignals, hasParecerSignals } from "@/lib/checktudo/parecer";
import { computeParecer } from "@/lib/checktudo/parecerVerdict";

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
      /** ISO timestamp this consult was made (cache date, or now for fresh). */
      consultedAt: string;
      /** Recall affected-chassi verdict (computed once, also persisted). */
      recallAfetado: string | null;
      recallMotivo: string | null;
      /** Parecer de Compra — buy/risk verdict (computed once, also persisted). */
      parecerVeredito: string | null;
      parecerMotivo: string | null;
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
  const { userId: ownerId, master } = await requireScope();

  // 1. Cache check — most recent saved row for placa+product (kept
  //    indefinitely; cleared only manually). A master reuses any owner's row.
  if (!opts.forceRefresh) {
    try {
      const hit = await ct.findFreshByPlaca(placa, productCode, master ? null : ownerId);
      if (hit) {
        // Count the cache hit (reporting only — never charged). Best-effort.
        try {
          await subs.recordUsage({
            api: "checktudo",
            userId: ownerId,
            productCode,
            consultaId: hit.row.id,
            placa,
            source: "cache",
          });
        } catch {
          // ignore metering failures
        }
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
          consultedAt: hit.row.consulted_at,
          recallAfetado: hit.row.recall_afetado,
          recallMotivo: hit.row.recall_motivo,
          parecerVeredito: hit.row.parecer_veredito,
          parecerMotivo: hit.row.parecer_motivo,
          consultaId: hit.row.id,
        };
      }
    } catch {
      // Cache failure must not block live consults — fall through.
    }
  }

  // 1b. Enforce the subscription's consumption plan — but only on the LIVE path
  //     (cache hits returned above are never enforced). Master bypasses; a
  //     subscription with no plan_type is unlimited. Reserve a credit/budget
  //     atomically BEFORE the vendor call; refund below if the call fails.
  let reservation:
    | { subscriptionId: string; planType: subs.PlanType | null; api: string; productCode: number; price: number | null }
    | null = null;
  if (!master) {
    const plan = await subs.getSubPlan(ownerId).catch(() => null);
    if (plan && plan.planType) {
      const price = await subs.getProductPrice("checktudo", productCode).catch(() => null);
      const res = await subs.reserveConsult({
        subscriptionId: plan.subscriptionId,
        planType: plan.planType,
        api: "checktudo",
        productCode,
        price,
      });
      if (!res.ok) return { ok: false, error: res.error };
      reservation = { subscriptionId: plan.subscriptionId, planType: plan.planType, api: "checktudo", productCode, price };
    }
  }

  // 2. Live call to the CheckTudo function.
  const result = await fetchChecktudoByPlate(placa, productCode);
  if (!result.ok) {
    if (reservation) await subs.refundConsult(reservation).catch(() => {});
    // Prefer a known friendly tag; otherwise surface the vendor's own message
    // (e.g. "limite de consultas atingido") instead of a bare HTTP code.
    const friendly =
      ERROR_MESSAGES[result.error] ??
      (result.message && result.message.trim() ? result.message.trim() : null) ??
      (result.status ? `Erro do serviço CheckTudo (HTTP ${result.status}).` : "Erro desconhecido.");
    return { ok: false, error: friendly };
  }

  // 2b. Recall affected-chassi verdict (computed once; persisted + returned).
  let recallAfetado: string | null = null;
  let recallMotivo: string | null = null;
  try {
    const { chassi, recallText } = extractRecall(result.data);
    if (chassi && recallText) {
      const v = await computeRecallVerdict(chassi, recallText);
      if (v.ok) {
        recallAfetado = v.afetado;
        recallMotivo = v.motivo ?? null;
      }
    }
  } catch {
    // best-effort; the consult still returns without a verdict.
  }

  // 2c. Parecer de Compra — synthesize a buy/risk verdict from compact signals
  //     (incl. the recall verdict). Computed once; persisted + returned.
  let parecerVeredito: string | null = null;
  let parecerMotivo: string | null = null;
  try {
    const signals = extractParecerSignals(result.data, { afetado: recallAfetado, motivo: recallMotivo });
    if (hasParecerSignals(signals)) {
      const v = await computeParecer(signals);
      if (v.ok) {
        parecerVeredito = v.veredito;
        parecerMotivo = v.motivo ?? null;
      }
    }
  } catch {
    // best-effort.
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
      ownerId,
      recallAfetado,
      recallMotivo,
      parecerVeredito,
      parecerMotivo,
    });
    consultaId = ins.id;
  } catch {
    // ignore — already have a result; history just misses this row.
  }

  // Meter this LIVE consult against the user's subscription (billable). Cache
  // hits return earlier and are never counted. Best-effort: metering must never
  // break a consult.
  try {
    await subs.recordUsage({
      api: "checktudo",
      userId: ownerId,
      productCode: result.product.code,
      consultaId,
      placa,
      source: "live",
    });
  } catch {
    // ignore metering failures
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
    consultedAt: new Date().toISOString(),
    recallAfetado,
    recallMotivo,
    parecerVeredito,
    parecerMotivo,
    consultaId,
  };
}
