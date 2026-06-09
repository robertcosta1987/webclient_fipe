"use server";

// app/actions/infocar.ts — Server Action for the /infocar page.
//
// Wraps fetchVehicleByPlate (the Infocar function via the Dadocar platform /
// APIM) with input normalisation, an indefinite SQL cache (infocar_consultas),
// and a stable `InfocarLookupResult` envelope the client switches on without
// awareness of platform internals. Mirrors actions/precos.ts.

import { fetchVehicleByPlate } from "@/lib/platform/client";
import type { VehiclePayload, FipeOption } from "@/lib/platform/types";
import { isValidPlaca, normalizePlaca } from "@/lib/placa/normalize";
import * as infocar from "@/lib/db/infocarConsultas";
import { requireScope } from "@/lib/auth/server";

export type InfocarLookupResult =
  | {
      ok: true;
      placa: string;
      payload: VehiclePayload;
      fipeOptions: FipeOption[];
      raw: unknown;
      sourceId: string;
      upstreamLatencyMs: number | null;
      /** True when served from infocar_consultas (cache hit). */
      fromCache: boolean;
      /** ISO timestamp the cached row was originally consulted at. */
      cachedAt: string | null;
      /** Row id when this lookup ended up persisted, for deep-linking. */
      consultaId: string | null;
    }
  | { ok: false; error: string };

// Friendly messages for every error tag platform/client.ts can emit.
const ERROR_MESSAGES: Record<string, string> = {
  platform_timeout: "Tempo esgotado consultando a placa na Infocar.",
  platform_unreachable: "Não foi possível conectar ao serviço Infocar.",
  platform_invalid_json: "Resposta inválida do serviço Infocar.",
  platform_schema_mismatch: "Formato da resposta mudou — contate o suporte.",
  no_data_for_plate: "Placa não encontrada na base Infocar.",
  platform_404: "Placa não encontrada na base Infocar.",
  invalid_plate: "Placa inválida. Use 7 caracteres (ex.: ABC1D23 ou ABC1234).",
};

export type LookupOptions = {
  /** Bypass the cache and force a new Infocar call. */
  forceRefresh?: boolean;
};

export async function lookupPlacaInfocar(
  rawPlaca: string,
  opts: LookupOptions = {},
): Promise<InfocarLookupResult> {
  const placa = normalizePlaca(rawPlaca);
  if (!isValidPlaca(placa)) {
    return { ok: false, error: ERROR_MESSAGES.invalid_plate };
  }
  const { userId: ownerId, master } = await requireScope();

  // 1. Cache check — most recent saved row for this placa (kept indefinitely;
  //    cleared only manually). A master reuses any owner's row.
  if (!opts.forceRefresh) {
    try {
      const hit = await infocar.findFreshByPlaca(placa, master ? null : ownerId);
      if (hit) {
        return {
          ok: true,
          placa,
          payload: hit.stored.payload,
          fipeOptions: hit.stored.fipeOptions,
          raw: hit.stored.raw,
          sourceId: hit.row.source_id,
          upstreamLatencyMs: hit.row.upstream_latency_ms,
          fromCache: true,
          cachedAt: hit.row.consulted_at,
          consultaId: hit.row.id,
        };
      }
    } catch {
      // Cache failure must not block live consults — fall through.
    }
  }

  // 2. Live call to the Infocar function (timed for the latency field).
  const startedAt = Date.now();
  const result = await fetchVehicleByPlate(placa);
  const upstreamLatencyMs = Date.now() - startedAt;
  if (!result.ok) {
    const friendly =
      ERROR_MESSAGES[result.error] ??
      (result.status ? `Erro do serviço Infocar (HTTP ${result.status}).` : "Erro desconhecido.");
    return { ok: false, error: friendly };
  }

  // 3. Persist (failure here does not fail the lookup).
  let consultaId: string | null = null;
  try {
    const ins = await infocar.insert({
      placa,
      payload: result.payload,
      fipeOptions: result.fipeOptions,
      raw: result.raw,
      sourceId: "infocar",
      upstreamLatencyMs,
      ownerId,
    });
    consultaId = ins.id;
  } catch {
    // ignore — already have a result, history will just miss this row
  }

  return {
    ok: true,
    placa,
    payload: result.payload,
    fipeOptions: result.fipeOptions,
    raw: result.raw,
    sourceId: "infocar",
    upstreamLatencyMs,
    fromCache: false,
    cachedAt: null,
    consultaId,
  };
}
