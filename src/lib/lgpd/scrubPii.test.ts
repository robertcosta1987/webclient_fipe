import { test } from "node:test";
import assert from "node:assert/strict";
import { scrubOwnerPii, hasOwnerPii, scrubPayloadJson } from "./scrubPii";

// A representative product-66 payload (owner PII = historicoProprietarios).
const payload = {
  placa: "DAZ7597", chassi: "9BD158018Y4138950", marcaModelo: "FIAT/UNO MILLE EX",
  dadosBasicosDoVeiculo: { marca: "FIAT", descricao: "UNO MILLE EX", codigoFipe: "10189" },
  baseEstadual: { debitoIpva: "0,00", restricaoRouboFurto: "NADA CONSTA" },
  historicoProprietarios: [{ proprietario: "ALEXANDRE CRUZ DA SILVA", anoExercicio: "2026" }],
};

test("scrubOwnerPii drops owner keys, keeps vehicle data", () => {
  const out = scrubOwnerPii(payload) as Record<string, unknown>;
  assert.equal("historicoProprietarios" in out, false);
  assert.equal(out.placa, "DAZ7597");
  assert.equal(out.chassi, "9BD158018Y4138950");
  assert.deepEqual(out.dadosBasicosDoVeiculo, { marca: "FIAT", descricao: "UNO MILLE EX", codigoFipe: "10189" });
  assert.equal((out.baseEstadual as Record<string, unknown>).debitoIpva, "0,00");
});

test("scrubOwnerPii removes nested cadastral owner objects (code 71 shape)", () => {
  const cad = { placa: "ABC1234", proprietario: { nome: "FULANO", cpf: "12345678900" }, cpf: "12345678900", marca: "VW" };
  const out = scrubOwnerPii(cad) as Record<string, unknown>;
  assert.equal("proprietario" in out, false);
  assert.equal("cpf" in out, false);
  assert.equal(out.marca, "VW");
  assert.equal(out.placa, "ABC1234");
});

test("key matching ignores case / separators", () => {
  const out = scrubOwnerPii({ Proprietario_Atual: "X", NOME_MAE: "Y", brand: "FIAT" }) as Record<string, unknown>;
  assert.equal("Proprietario_Atual" in out, false);
  assert.equal("NOME_MAE" in out, false);
  assert.equal(out.brand, "FIAT");
});

test("hasOwnerPii detects / clears", () => {
  assert.equal(hasOwnerPii(payload), true);
  assert.equal(hasOwnerPii(scrubOwnerPii(payload)), false);
  assert.equal(hasOwnerPii({ marca: "FIAT", placa: "X" }), false);
});

test("scrubPayloadJson round-trips and is safe on bad json", () => {
  const scrubbed = JSON.parse(scrubPayloadJson(JSON.stringify(payload)));
  assert.equal("historicoProprietarios" in scrubbed, false);
  assert.equal(scrubbed.placa, "DAZ7597");
  assert.equal(scrubPayloadJson("not json"), "not json");
});
