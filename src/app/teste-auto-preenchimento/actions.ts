"use server";

// actions for "Teste Auto Preenchimento": plate → FIPE auto-fill, and save/delete
// the registered vehicle. The auto-fill reuses the same metered FIPE consult the
// public API exposes (lib/api/fipeConsult) — server-side, so the API key never
// reaches the browser and the lookup is attributed to the logged-in user.

import { requireScope } from "@/lib/auth/server";
import { runFipeConsult, type FipeData } from "@/lib/api/fipeConsult";
import * as veh from "@/lib/db/testVehicles";

export type AutoFillResult =
  | { ok: true; placa: string; source: "live" | "cache"; fipe: FipeData; raw: unknown }
  | { ok: false; error: string };

export async function autoFillPlate(placa: string): Promise<AutoFillResult> {
  let userId: string;
  try { ({ userId } = await requireScope()); }
  catch { return { ok: false, error: "Sessão expirada. Faça login novamente." }; }

  const r = await runFipeConsult({ userId, placa });
  if (!r.ok) return { ok: false, error: r.error };
  return { ok: true, placa: r.placa, source: r.fromCache ? "cache" : "live", fipe: r.fipe, raw: r.raw };
}

export type SaveResult = { ok: true; id: string } | { ok: false; error: string };

export async function saveVehicle(input: veh.VehicleInput, id?: string | null): Promise<SaveResult> {
  let userId: string;
  try { ({ userId } = await requireScope()); }
  catch { return { ok: false, error: "Sessão expirada. Faça login novamente." }; }
  if (!input.placa && !input.chassi) return { ok: false, error: "Informe ao menos a placa ou o chassi." };
  try {
    if (id) { await veh.updateVehicle(id, userId, input); return { ok: true, id }; }
    const created = await veh.createVehicle(userId, input);
    return { ok: true, id: created.id };
  } catch {
    return { ok: false, error: "Não foi possível salvar o veículo. Tente novamente." };
  }
}

export async function removeVehicle(id: string): Promise<{ ok: boolean; error?: string }> {
  let userId: string;
  try { ({ userId } = await requireScope()); }
  catch { return { ok: false, error: "Sessão expirada." }; }
  try { await veh.deleteVehicle(id, userId); return { ok: true }; }
  catch { return { ok: false, error: "Não foi possível apagar." }; }
}
