import { test } from "node:test";
import assert from "node:assert/strict";
import { assertIdent, safeColumns } from "./identifiers";

test("assertIdent accepts bare SQL identifiers", () => {
  for (const ok of ["id", "owner_id", "ano_modelo", "photo_count", "_x", "A1"]) {
    assert.equal(assertIdent(ok), ok);
  }
});

test("assertIdent rejects anything that could break out of an identifier", () => {
  for (const bad of [
    "1col", "col name", "col-name", "col;DROP", "col--", "a,b", "*", "owner_id) OR (1=1",
    "col/*", "", "'x'", "col.name",
  ]) {
    assert.throws(() => assertIdent(bad), /identificador SQL inválido/, `should reject: ${bad}`);
  }
});

test("safeColumns joins valid columns and enforces an allow-list", () => {
  assert.equal(safeColumns(["id", "placa"]), "id, placa");
  // member of allow-list → ok
  assert.equal(safeColumns(["placa"], ["id", "placa"]), "placa");
  // not in allow-list → throws
  assert.throws(() => safeColumns(["senha"], ["id", "placa"]), /fora da allow-list/);
  // bad identifier → throws even without allow-list
  assert.throws(() => safeColumns(["a; DELETE FROM users"]), /identificador SQL inválido/);
});
