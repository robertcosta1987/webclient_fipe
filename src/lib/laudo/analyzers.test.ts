import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeReport, parseBrl } from "./normalize";
import {
  riscoScore, resumoFinanceiro, deteccaoContradicoes, faixaNegociacao,
  resumoSegurabilidade, recallsPendentes, quadroAvisos,
} from "./analyzers";
import { raw66 } from "./__fixtures__/raw66";

const r = normalizeReport(raw66);

test("parseBrl handles BR formatting", () => {
  assert.equal(parseBrl("174,08"), 174.08);
  assert.equal(parseBrl("1.234,56"), 1234.56);
  assert.equal(parseBrl(""), 0);
});

test("normalize maps real paths", () => {
  assert.equal(r.veiculo.placa, "DAZ7597");
  assert.equal(r.fipe.valorAtual, 10966);
  assert.equal(r.fipe.historicoPreco.length, 2); // predicao=true dropped
  assert.equal(r.rouboFurto.constaOcorrencia, true);
  assert.equal(r.baseNacional.chassiRemarcado, true);
  assert.equal(r.gravame.ativo, true);
  assert.equal(r.riscoComercial.nivel, "baixo");
});

test("riscoScore is deterministic and source-tagged", () => {
  const s = riscoScore(r);
  // roubo/furto 10 + chassi remarcado 20 + débitos(174.08→1) = 31 → médio
  assert.equal(s.score, 31);
  assert.equal(s.banda, "medio");
  for (const b of s.breakdown) assert.ok(b.campo_origem && b.campo_origem.length > 0);
  assert.ok(s.breakdown.some((b) => b.fator === "Chassi remarcado" && b.contribuicao === 20));
});

test("resumoFinanceiro totals + transfer blockers", () => {
  const f = resumoFinanceiro(r);
  assert.equal(f.totalDebitos, 174.08);
  assert.equal(f.porOrgao[0].orgao, "Licenciamento");
  assert.ok(f.bloqueiosTransferencia.some((b) => /gravame/i.test(b.tipo))); // reserva de domínio
});

test("deteccaoContradicoes fires the three seeded rules", () => {
  const c = deteccaoContradicoes(r);
  const ids = c.map((x) => x.id).sort();
  assert.deepEqual(ids, [
    "chassi_remarcado_estadual_vs_nacional",
    "gravame_vs_restricao_financeira",
    "roubo_furto_base_vs_historico",
  ]);
  for (const x of c) assert.equal(x.campos.length, 2);
});

test("faixaNegociacao derives from FIPE and risk band", () => {
  const fx = faixaNegociacao(r);
  assert.ok(!("indisponivel" in fx));
  if (!("indisponivel" in fx)) {
    assert.equal(fx.referenciaFipe, 10966);
    assert.ok(fx.min < fx.max && fx.max <= 10966);
    assert.ok(fx.alavancas.some((a) => /roubo\/furto/i.test(a.motivo)));
  }
});

test("resumoSegurabilidade: radar não consta no produto 66", () => {
  const s = resumoSegurabilidade(r);
  assert.equal(s.disponivel, false);
  assert.ok(/Radar/i.test(s.observacao));
});

test("recallsPendentes empty when none", () => {
  assert.deepEqual(recallsPendentes(r), []);
});

test("quadroAvisos: key flags reflect the data", () => {
  const q = Object.fromEntries(quadroAvisos(r).map((x) => [x.flag, x.sim]));
  assert.equal(q.roubo_furto, true);
  assert.equal(q.chassi_remarcado, true);
  assert.equal(q.gravame, true);
  assert.equal(q.multas_renainf, true);
  assert.equal(q.restricoes_estaduais, true);
  assert.equal(q.motor_alterado, false);
  assert.equal(q.indicio_sinistro, false);
  assert.equal(q.csv, null); // não consta no produto 66
});
