// scripts/smoke.ts — end-to-end smoke test:
//   1. Call the Dadocar platform via the same adapter the UI uses.
//   2. Insert the returned payload into Azure SQL.
//   3. List it back.
//   4. Delete it.
// Exits non-zero on any failure. Safe to re-run.
import "./_serverOnlyShim"; // neutralize server-only when running standalone
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

import { fetchVehicleByPlate } from "../src/lib/platform/client";
import { insertFromPayload, getByPlaca, list, removeById } from "../src/lib/db/carros";

const PLATE = "QOV3D42";
// Tenant scope for the smoke test (a throwaway owner id).
const OWNER = "00000000-0000-0000-0000-0000000000aa";

async function main() {
  console.log(`> fetchVehicleByPlate("${PLATE}")`);
  const platform = await fetchVehicleByPlate(PLATE);
  if (!platform.ok) throw new Error(`platform: ${platform.error}`);
  console.log(`  ✓ cached=${platform.cached} modelo="${platform.payload.modelo}" valor="${platform.payload.valor}"`);

  // Clean up any leftover from prior smoke runs first.
  const existing = await getByPlaca(PLATE, OWNER);
  if (existing) {
    console.log(`> deleting leftover row ${existing.id}`);
    await removeById(existing.id, OWNER);
  }

  console.log(`> insertFromPayload(${PLATE}, ...)`);
  const inserted = await insertFromPayload(PLATE, platform.payload, OWNER);
  console.log(`  ✓ id=${inserted.id}`);

  console.log(`> list()`);
  const all = await list(OWNER);
  const found = all.find((r) => r.placa === PLATE);
  if (!found) throw new Error("inserted row not present in list");
  console.log(`  ✓ ${all.length} row(s); ours has valor_fipe=${found.valor_fipe}`);

  console.log(`> removeById(${inserted.id})`);
  await removeById(inserted.id, OWNER);
  const afterDelete = await getByPlaca(PLATE, OWNER);
  if (afterDelete) throw new Error("row still present after delete");
  console.log("  ✓ deleted");
  console.log("smoke: PASS");
}

main().catch((e) => {
  console.error("smoke: FAIL");
  console.error(e);
  process.exit(1);
});
