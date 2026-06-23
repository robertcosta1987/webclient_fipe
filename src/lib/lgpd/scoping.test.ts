// scoping.test.ts — DB-free regression guards for the data-subject rights layer.
// The end-to-end "user A cannot read/erase user B's data" property is proven at
// runtime by owner-scoped SQL; here we statically assert those guarantees hold
// in the source so a future edit can't silently widen scope or leak secrets.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const db = join(dirname(fileURLToPath(import.meta.url)), "..", "db");
const read = (f: string) => readFileSync(join(db, f), "utf8");

test("user export query never selects password or API-key secrets", () => {
  const src = read("users.ts");
  const m = src.match(/getExportById[\s\S]*?`([\s\S]*?)`/);
  assert.ok(m, "getExportById query not found");
  const q = m![1];
  for (const secret of ["password_hash", "password_salt", "api_key_hash"]) {
    assert.ok(!q.includes(secret), `export must not select ${secret}`);
  }
});

test("every erasure delete is owner-scoped (owner_id = @owner)", () => {
  for (const f of ["carros.ts", "testVehicles.ts", "checktudoConsultas.ts", "infocarConsultas.ts", "kbbConsultas.ts"]) {
    const src = read(f);
    // The function body up to its first closing brace at column 0 (quote style varies).
    const m = src.match(/export async function deleteAllByOwner[\s\S]*?\n}/);
    assert.ok(m, `deleteAllByOwner not found in ${f}`);
    assert.match(m![0], /DELETE FROM \w+ WHERE owner_id\s*=\s*@owner/, `${f} deleteAllByOwner must be owner-scoped`);
  }
});

test("account/log anonymizers are scoped by the subject id", () => {
  // Anchor on .query(`…`) so the assertion targets the SQL, not other template literals.
  const query = (src: string, fn: string) => src.match(new RegExp(`${fn}[\\s\\S]*?\\.query\\(\`([\\s\\S]*?)\``))![1];
  assert.match(query(read("users.ts"), "anonymizeUser"), /WHERE id = @id/);
  assert.match(query(read("customers.ts"), "anonymizeByUserId"), /WHERE user_id = @uid/);
  assert.match(query(read("apiRequestLogs.ts"), "anonymizeByUser"), /WHERE user_id = @uid/);
});
