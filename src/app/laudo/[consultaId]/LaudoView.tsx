"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { perguntarLaudo } from "@/app/actions/laudo";
import type { FactsBundle } from "@/lib/laudo/factsBundle";
import type { LaudoIA } from "@/lib/laudo/ia";

const COR: Record<string, string> = { verde: "var(--success)", amarelo: "#f59e0b", laranja: "#ea580c", vermelho: "var(--danger)", cinza: "var(--fg-muted)" };
const VERDICT: Record<string, { label: string; cor: string }> = {
  comprar: { label: "COMPRAR", cor: "var(--success)" },
  atencao: { label: "ATENÇÃO", cor: "#f59e0b" },
  evitar: { label: "EVITAR", cor: "var(--danger)" },
};
const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

export function LaudoView({ consultaId, facts, laudo, fonte }: { consultaId: string; facts: FactsBundle; laudo: LaudoIA; fonte: string }) {
  const v = VERDICT[laudo.veredicto.classificacao] ?? VERDICT.atencao;
  const neg = facts.negociacao;

  return (
    <section className="space-y-6 max-w-3xl">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <span className="font-display uppercase tracking-[0.22em] text-xs text-[var(--accent)]">Laudo inteligente</span>
          <h1 className="font-display uppercase tracking-[0.04em] text-[var(--fg-strong)] text-3xl leading-none mt-1">
            {facts.veiculo.marcaModelo ?? "Veículo"} {facts.veiculo.anoModelo ? `· ${facts.veiculo.anoModelo}` : ""}
          </h1>
          <p className="text-xs text-[var(--fg-muted)] mt-1 font-mono">{facts.veiculo.placa ?? "—"} · {facts.veiculo.chassi ?? "—"}</p>
        </div>
        <Link href="/checktudo" className="btn-ghost text-xs">← CheckTudo</Link>
      </header>

      {/* Veredicto */}
      <div className="surface p-5" style={{ borderColor: v.cor }}>
        <div className="flex flex-wrap items-center gap-3">
          <span className="font-display text-2xl px-3 py-1 rounded" style={{ color: "#fff", background: v.cor }}>{v.label}</span>
          <p className="text-sm text-[var(--fg)] flex-1 min-w-[14rem]">{laudo.veredicto.resumo}</p>
        </div>
        {laudo.veredicto.justificativa.length > 0 && (
          <ul className="mt-3 space-y-1 text-sm text-[var(--fg-muted)] list-disc pl-5">
            {laudo.veredicto.justificativa.map((j, i) => <li key={i}>{j}</li>)}
          </ul>
        )}
      </div>

      {/* Risco consolidado */}
      <Card title={`Risco consolidado — ${facts.risco.score}/100 (${facts.risco.banda})`}>
        <div className="h-2 rounded bg-[var(--bg-elev)] overflow-hidden mb-3">
          <div className="h-full" style={{ width: `${facts.risco.score}%`, background: facts.risco.banda === "alto" ? "var(--danger)" : facts.risco.banda === "medio" ? "#f59e0b" : "var(--success)" }} />
        </div>
        <p className="text-sm text-[var(--fg-muted)] mb-3">{laudo.explicacaoRisco}</p>
        {facts.risco.breakdown.length > 0 && (
          <ul className="space-y-1 text-[13px]">
            {facts.risco.breakdown.map((b, i) => (
              <li key={i} className="flex justify-between gap-3">
                <span className="text-[var(--fg)]">{b.fator} <span className="text-[var(--fg-faint)] font-mono text-[10px]">[{b.campo_origem}]</span></span>
                <span className="font-mono text-[var(--danger)]">+{b.contribuicao}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Resumo financeiro */}
      <Card title="Resumo financeiro">
        {facts.financeiro.porOrgao.length === 0 ? (
          <p className="text-sm text-[var(--fg-muted)]">Sem débitos nas bases consultadas.</p>
        ) : (
          <table className="w-full text-sm">
            <tbody>
              {facts.financeiro.porOrgao.map((d) => (
                <tr key={d.orgao} className="border-b border-[var(--hairline)]">
                  <td className="py-1.5 text-[var(--fg)]">{d.orgao} <span className="text-[var(--fg-faint)] font-mono text-[10px]">[{d.campo_origem}]</span></td>
                  <td className="py-1.5 text-right font-mono text-[var(--fg-strong)]">{BRL.format(d.valor)}</td>
                </tr>
              ))}
              <tr><td className="py-1.5 font-medium">Total</td><td className="py-1.5 text-right font-mono font-bold">{BRL.format(facts.financeiro.totalDebitos)}</td></tr>
            </tbody>
          </table>
        )}
        {facts.financeiro.bloqueiosTransferencia.map((b, i) => (
          <p key={i} className="mt-2 text-[13px] px-3 py-2 rounded" style={{ background: "color-mix(in srgb, var(--danger) 12%, transparent)", color: "var(--danger)" }}>
            🔒 Bloqueio de transferência — <strong>{b.tipo}</strong>: {b.descricao} <span className="font-mono text-[10px] opacity-70">[{b.campo_origem}]</span>
          </p>
        ))}
      </Card>

      {/* Contradições */}
      {facts.contradicoes.length > 0 && (
        <Card title="Contradições entre bases">
          <ul className="space-y-2">
            {facts.contradicoes.map((c) => (
              <li key={c.id} className="text-[13px] px-3 py-2 rounded" style={{ background: "color-mix(in srgb, #f59e0b 14%, transparent)" }}>
                ⚠ {c.descricao} <span className="font-mono text-[10px] text-[var(--fg-faint)]">[{c.campos.join(" × ")}]</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* Faixa de negociação */}
      <Card title="Faixa de negociação">
        {"indisponivel" in neg ? (
          <p className="text-sm text-[var(--fg-muted)]">{neg.motivo}</p>
        ) : (
          <>
            <p className="font-display text-xl text-[var(--fg-strong)]">{BRL.format(neg.min)} <span className="text-[var(--fg-muted)] text-sm">a</span> {BRL.format(neg.max)}</p>
            <p className="text-xs text-[var(--fg-muted)] mt-1">{laudo.faixaNegociacaoTexto}</p>
            {neg.alavancas.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {neg.alavancas.map((a, i) => <span key={i} className="text-[11px] px-2 py-1 rounded bg-[var(--bg-elev)] text-[var(--fg-muted)]">{a.motivo}</span>)}
              </div>
            )}
          </>
        )}
      </Card>

      {/* Segurabilidade */}
      <Card title="Segurabilidade">
        <p className="text-sm text-[var(--fg-muted)]">{laudo.segurabilidadeTexto}</p>
        <p className="text-[13px] mt-1">Vistoria especial: <span style={{ color: COR[facts.segurabilidade.vistoriaEspecial.cor] }}>{facts.segurabilidade.vistoriaEspecial.label}</span></p>
      </Card>

      {/* Recalls */}
      {facts.recalls.length > 0 && (
        <Card title="Recalls pendentes">
          <ul className="space-y-1 text-sm list-disc pl-5">{facts.recalls.map((r, i) => <li key={i}>{r.descricao}</li>)}</ul>
        </Card>
      )}

      {/* Destaques / alertas da IA */}
      {(laudo.destaques.length > 0 || laudo.alertas.length > 0) && (
        <Card title="Destaques e alertas">
          {laudo.destaques.map((d, i) => <p key={`d${i}`} className="text-[13px] text-[var(--fg)]">• {d}</p>)}
          {laudo.alertas.map((a, i) => <p key={`a${i}`} className="text-[13px]" style={{ color: "var(--danger)" }}>! {a}</p>)}
        </Card>
      )}

      {/* Detalhes técnicos (quadro de avisos traduzido) */}
      <details className="surface p-4 group">
        <summary className="cursor-pointer text-sm font-display uppercase tracking-[0.12em] text-[var(--accent)]">Detalhes técnicos</summary>
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
          {facts.quadroAvisos.map((q) => (
            <div key={q.flag} className="flex items-center justify-between gap-2 text-[13px] border-b border-[var(--hairline)] py-1">
              <span className="text-[var(--fg)]">{q.label}</span>
              <span style={{ color: COR[q.cor] }} className="font-medium">{q.sim === null ? "não consta" : q.sim ? "SIM" : "NÃO"}</span>
            </div>
          ))}
        </div>
      </details>

      <ChatBox consultaId={consultaId} />

      <footer className="text-[11px] text-[var(--fg-faint)] pt-2 border-t border-[var(--border)]">
        {laudo.disclaimer} {fonte === "fallback" && "(Narrativa gerada sem IA — chave indisponível.)"}
      </footer>
    </section>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="surface p-4">
      <h2 className="font-display uppercase tracking-[0.12em] text-sm text-[var(--accent)] mb-2">{title}</h2>
      {children}
    </section>
  );
}

function ChatBox({ consultaId }: { consultaId: string }) {
  const [msgs, setMsgs] = useState<{ q: string; a: string }[]>([]);
  const [q, setQ] = useState("");
  const [pending, start] = useTransition();

  function ask(e: React.FormEvent) {
    e.preventDefault();
    const pergunta = q.trim();
    if (!pergunta) return;
    setQ("");
    setMsgs((m) => [...m, { q: pergunta, a: "…" }]);
    start(async () => {
      const { resposta } = await perguntarLaudo(consultaId, pergunta);
      setMsgs((m) => m.map((x, i) => (i === m.length - 1 ? { ...x, a: resposta } : x)));
    });
  }

  return (
    <Card title="Perguntar sobre o laudo">
      <div className="space-y-2 mb-3">
        {msgs.map((m, i) => (
          <div key={i} className="text-sm">
            <p className="text-[var(--fg-muted)]"><span className="text-[var(--accent)]">›</span> {m.q}</p>
            <p className="text-[var(--fg-strong)] mt-0.5 whitespace-pre-wrap">{m.a}</p>
          </div>
        ))}
      </div>
      <form onSubmit={ask} className="flex gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ex.: o veículo tem bloqueio de transferência?" className="input flex-1 text-sm" />
        <button type="submit" disabled={pending} className="btn-primary text-sm">{pending ? "…" : "Perguntar"}</button>
      </form>
      <p className="text-[10px] text-[var(--fg-faint)] mt-1">Respostas baseadas somente neste laudo.</p>
    </Card>
  );
}
