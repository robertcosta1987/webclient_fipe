"use server";

// actions for "Teste Auto Preenchimento": plate → FIPE auto-fill, and save/delete
// the registered vehicle. The auto-fill reuses the same metered FIPE consult the
// public API exposes (lib/api/fipeConsult) — server-side, so the API key never
// reaches the browser and the lookup is attributed to the logged-in user.

import { requireScope } from "@/lib/auth/server";
import { runFipeConsult, type FipeData } from "@/lib/api/fipeConsult";
import { uploadImageDataUrls } from "@/lib/storage/blob";
import * as veh from "@/lib/db/testVehicles";
import { isValidVehicleWrite } from "@/lib/validation/schemas";

export type AutoFillResult =
  | { ok: true; placa: string; source: "live" | "cache"; fipe: FipeData; raw: unknown; saved: { id: string; photos: string[]; opcionais: string | null } | null }
  | { ok: false; error: string };

export async function autoFillPlate(placa: string): Promise<AutoFillResult> {
  let userId: string;
  try { ({ userId } = await requireScope()); }
  catch { return { ok: false, error: "Sessão expirada. Faça login novamente." }; }

  const r = await runFipeConsult({ userId, placa });
  if (!r.ok) return { ok: false, error: r.error };
  // Restore a previously saved vehicle (with its photos) for this plate, if any.
  const saved = await veh.getByPlaca(userId, r.placa).catch(() => null);
  return { ok: true, placa: r.placa, source: r.fromCache ? "cache" : "live", fipe: r.fipe, raw: r.raw, saved };
}

export type SaveResult = { ok: true; id: string; photoCount: number } | { ok: false; error: string };

export async function saveVehicle(input: veh.VehicleInput, photoDataUrls: string[], id?: string | null): Promise<SaveResult> {
  let userId: string;
  try { ({ userId } = await requireScope()); }
  catch { return { ok: false, error: "Sessão expirada. Faça login novamente." }; }
  if (!input.placa && !input.chassi) return { ok: false, error: "Informe ao menos a placa ou o chassi." };
  if (!isValidVehicleWrite(input)) return { ok: false, error: "Dados do veículo inválidos." };

  // Upload the photos to blob and store their public URLs with the vehicle.
  const urls = await uploadImageDataUrls(photoDataUrls ?? []).catch(() => [] as string[]);
  const toStore: veh.VehicleInput = { ...input, photoCount: urls.length, photos: urls.length ? JSON.stringify(urls) : null };

  try {
    if (id) { await veh.updateVehicle(id, userId, toStore); return { ok: true, id, photoCount: urls.length }; }
    const created = await veh.createVehicle(userId, toStore);
    return { ok: true, id: created.id, photoCount: urls.length };
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
