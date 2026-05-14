// scripts/smoke-fipe.ts — verifies the platform adapter returns the FULL
// fipeOptions array (not just fipes[0]) so the modal's picker has data to
// render. Use:  pnpm exec tsx scripts/smoke-fipe.ts
import "./_serverOnlyShim";
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
import { fetchVehicleByPlate } from "../src/lib/platform/client";

const PLATES = ["EFS8F45", "QOV3D42"];

async function main() {
  for (const p of PLATES) {
    const res = await fetchVehicleByPlate(p);
    if (!res.ok) { console.log(`  ✖ ${p}: ${res.error}`); continue; }
    console.log(`> ${p}`);
    console.log(`  cached:      ${res.cached}`);
    console.log(`  payload.modelo:    ${res.payload.modelo}`);
    console.log(`  payload.codigoFipe (default fipes[0]): ${res.payload.codigoFipe}`);
    console.log(`  fipeOptions.length: ${res.fipeOptions.length}`);
    res.fipeOptions.forEach((opt, i) => {
      console.log(`    [${i}] ${opt.codigoFipe} · ${opt.descricao} · ${opt.valor}`);
    });
    console.log(`  raw keys: ${Object.keys(res.raw as object).join(", ")}`);
    console.log();
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
