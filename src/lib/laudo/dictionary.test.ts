import { test } from "node:test";
import assert from "node:assert/strict";
import { translateField, translateFlag, translateVistoriaEspecial, labelFor } from "./dictionary";

test("score_leilao maps 1..4 to severity/color", () => {
  assert.deepEqual(translateField("score_leilao", "1"), { label: "Aparentemente inteiro", severidade: "ok", cor: "verde" });
  assert.deepEqual(translateField("score_leilao", "4"), { label: "Grandes danos", severidade: "critico", cor: "vermelho" });
  assert.equal(translateField("score_leilao", 3).cor, "laranja");
});

test("unknown coded value falls back to desconhecido (never invented)", () => {
  const t = translateField("score_leilao", "9");
  assert.equal(t.severidade, "desconhecido");
  assert.equal(t.cor, "cinza");
  assert.equal(t.label, "9");
});

test("missing value renders 'não consta'", () => {
  assert.equal(translateField("score_leilao", null).label, "não consta");
  assert.equal(translateField("score_leilao", null).severidade, "desconhecido");
});

test("risco_comercial alto carries a warning desc", () => {
  const t = translateField("risco_comercial", "alto");
  assert.equal(t.cor, "vermelho");
  assert.ok(t.desc && /financiamento|seguro/i.test(t.desc));
});

test("radar_securitario_item recusavel is critical", () => {
  assert.equal(translateField("radar_securitario_item", "recusavel").severidade, "critico");
  assert.equal(translateField("radar_securitario_item", "aceitavel_sem_restricoes").cor, "verde");
});

test("csv_tipo SINISTRADO is critical with desc", () => {
  const t = translateField("csv_tipo", "SINISTRADO");
  assert.equal(t.severidade, "critico");
  assert.ok(t.desc);
});

test("vistoria_especial banding 33/66/100", () => {
  assert.equal(translateVistoriaEspecial(20).cor, "verde");
  assert.equal(translateVistoriaEspecial(50).cor, "amarelo");
  assert.equal(translateVistoriaEspecial(90).cor, "vermelho");
  assert.equal(translateVistoriaEspecial(null).severidade, "desconhecido");
});

test("translateFlag: SIM is the 'ruim' side; null = não consta", () => {
  assert.equal(translateFlag("gravame", true).severidade, "critico");
  assert.equal(translateFlag("gravame", false).severidade, "ok");
  assert.equal(translateFlag("csv", null).severidade, "desconhecido");
});

test("labelFor uses dictionary then humanizes", () => {
  assert.equal(labelFor("placa"), "Placa");
  assert.equal(labelFor("restricaoFinanceira"), "Restrição financeira");
  assert.equal(labelFor("algumCampoNovo"), "Algum Campo Novo");
});
