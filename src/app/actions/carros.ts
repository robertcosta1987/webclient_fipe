"use server";

// app/actions/carros.ts — Server Actions for the CRM demo.
//
// Two paths in here:
//   1. lookupPlaca — placa autofill: call the Dadocar platform, check the
//      local DB for an existing row, return both. UI uses it to populate
//      the form AND show a duplicate banner.
//   2. CRUD on carros_ativos — insertCarro, updateCarro, deleteCarro,
//      listCarros, searchCarros. Direct DB only; no platform involvement.
//
// All inputs validated; nothing trusts the browser. revalidatePath after
// mutations so the Carros Ativos table updates without a manual refresh.

import { revalidatePath } from "next/cache";
import * as carros from "@/lib/db/carros";
import type { EditableCol } from "@/lib/db/carros";
import { fetchVehicleByPlate } from "@/lib/platform/client";
import { type VehiclePayload, type FipeOption } from "@/lib/platform/types";
import { isValidPlaca, normalizePlaca } from "@/lib/placa/normalize";
import { requireUserId } from "@/lib/auth/server";

export type LookupResult =
  | {
      ok: true;
      payload: VehiclePayload;
      /** Full list of FIPE matches Infocar returned. UI uses this for the
       *  picker when length > 1; payload already reflects the first one. */
      fipeOptions: FipeOption[];
      /** The unflattened aggregator response, for the "Ler JSON" modal. */
      raw: unknown;
      cached: boolean;
      duplicate: { id: string; placa: string; criado_em: string } | null;
    }
  | { ok: false; error: string };

/** Called by the Add modal when the operator presses Enter in the placa
 *  field. Returns the canonical payload plus a duplicate marker so the UI
 *  can show the "Veículo já cadastrado" banner. */
export async function lookupPlaca(rawPlaca: string): Promise<LookupResult> {
  const placa = normalizePlaca(rawPlaca);
  if (!isValidPlaca(placa)) {
    return { ok: false, error: "Placa inválida. Use 7 caracteres (ex.: ABC1D23 ou ABC1234)." };
  }

  const ownerId = await requireUserId();
  // Fire both calls concurrently — the duplicate check is independent of
  // the platform response.
  const [platform, existing] = await Promise.all([
    fetchVehicleByPlate(placa),
    carros.getByPlaca(placa, ownerId).catch(() => null),
  ]);

  if (!platform.ok) {
    // Surface a friendly error per failure mode.
    const map: Record<string, string> = {
      platform_timeout: "Tempo esgotado consultando a placa. Tente novamente.",
      platform_unreachable: "Não foi possível conectar ao serviço de placas.",
      platform_invalid_json: "Resposta inválida do serviço de placas.",
      platform_schema_mismatch: "Formato da resposta mudou — contate o suporte.",
      no_data_for_plate: "Placa não encontrada.",
      platform_404: "Placa não encontrada.",
    };
    const friendly = map[platform.error] ?? `Falha na consulta (${platform.error}).`;
    return { ok: false, error: friendly };
  }

  return {
    ok: true,
    payload: platform.payload,
    fipeOptions: platform.fipeOptions,
    raw: platform.raw,
    cached: platform.cached,
    duplicate: existing
      ? { id: existing.id, placa: existing.placa, criado_em: existing.criado_em }
      : null,
  };
}

/** Insert. `payload` may be the canonical platform shape or a manually-
 *  filled subset of the same fields. */
export type InsertResult =
  | { ok: true; id: string }
  | { ok: false; error: string; duplicate?: boolean };

export async function insertCarro(rawPlaca: string, payload: Partial<VehiclePayload>): Promise<InsertResult> {
  const placa = normalizePlaca(rawPlaca);
  if (!isValidPlaca(placa)) return { ok: false, error: "Placa inválida." };

  try {
    const ownerId = await requireUserId();
    const { id } = await carros.insertFromPayload(placa, payload, ownerId);
    revalidatePath("/carros-ativos");
    return { ok: true, id };
  } catch (e) {
    const msg = (e as Error).message;
    if (/UNIQUE|duplicate/i.test(msg)) {
      return { ok: false, error: "Veículo já cadastrado.", duplicate: true };
    }
    return { ok: false, error: `Falha ao salvar: ${msg}` };
  }
}

export type UpdateResult = { ok: true } | { ok: false; error: string };

export async function updateCarro(id: string, patch: Partial<Record<EditableCol, string | number | null>>): Promise<UpdateResult> {
  if (!id) return { ok: false, error: "ID ausente." };
  try {
    const ownerId = await requireUserId();
    await carros.updateById(id, patch, ownerId);
    revalidatePath("/carros-ativos");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function deleteCarro(id: string): Promise<UpdateResult> {
  if (!id) return { ok: false, error: "ID ausente." };
  try {
    const ownerId = await requireUserId();
    await carros.removeById(id, ownerId);
    revalidatePath("/carros-ativos");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function searchCarros(q: string, scope: carros.SearchScope): Promise<carros.Carro[]> {
  const ownerId = await requireUserId();
  return carros.search(q, scope, ownerId);
}
