"use client";

// InfocarClient.tsx — plate input + Infocar (FIPE) result renderer.
//
// Layout (top → bottom):
//   1. Plate input + Search button (server action: lookupPlacaInfocar).
//   2. Identity strip (plate badge / chassi / ano modelo / latency).
//   3. FIPE card(s) — código + descrição + valor (one per fipeOption).
//   4. Vehicle data — every non-empty field rendered as a definition grid.
//   5. Raw JSON expander for diagnostics.
// Mirrors PrecosClient so the three consult tabs feel identical.

import { useEffect, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { normalizePlaca, isValidPlaca } from "@/lib/placa/normalize";
import { lookupPlacaInfocar, type InfocarLookupResult } from "@/app/actions/infocar";
import { parseValorFipe, type VehiclePayload, type FipeOption } from "@/lib/platform/types";
import { Plate } from "@/components/Plate";

export function InfocarClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialPlaca = searchParams.get("placa") ?? "";
  const [placa, setPlaca] = useState(initialPlaca);
  const [result, setResult] = useState<InfocarLookupResult | null>(null);
  const [pending, start] = useTransition();

  const placaNorm = normalizePlaca(placa);
  const placaOk = isValidPlaca(placaNorm);

  // Auto-run when arriving with ?placa=X (deep-link from the history list).
  useEffect(() => {
    const q = searchParams.get("placa");
    if (q && isValidPlaca(normalizePlaca(q))) {
      const norm = normalizePlaca(q);
      start(async () => {
        const next = await lookupPlacaInfocar(norm);
        setResult(next);
      });
    }
  }, [searchParams]);

  function run(e: React.FormEvent) {
    e.preventDefault();
    if (!placaOk) return;
    start(async () => {
      const next = await lookupPlacaInfocar(placaNorm);
      setResult(next);
    });
  }

  function forceRefresh() {
    if (!placaOk) return;
    start(async () => {
      const next = await lookupPlacaInfocar(placaNorm, { forceRefresh: true });
      setResult(next);
      router.refresh(); // keep the inline history fresh after a new row lands
    });
  }

  return (
    <div className="space-y-6">
      <form onSubmit={run} className="surface flex flex-wrap gap-3 items-end p-4 rise rise-d3">
        <div className="flex-1 min-w-[16rem]">
          <label
            htmlFor="placa-input"
            className="block text-[10px] uppercase tracking-[0.16em] text-[var(--fg-muted)] mb-1"
          >
            Placa
          </label>
          <input
            id="placa-input"
            value={placa}
            onChange={(e) => setPlaca(e.target.value)}
            placeholder="ABC1D23 ou ABC1234"
            inputMode="text"
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            maxLength={8}
            className="input font-mono uppercase tracking-[0.18em]"
          />
        </div>
        <button type="submit" disabled={pending || !placaOk} className="btn-primary text-sm">
          {pending ? "Consultando…" : "Consultar Infocar"}
        </button>
        <button
          type="button"
          onClick={() => { setPlaca(""); setResult(null); }}
          className="btn-ghost text-sm"
          disabled={pending}
        >
          Limpar
        </button>
      </form>

      {result?.ok === false && (
        <div role="alert" className="surface border border-[var(--danger)]/60 p-4 text-sm text-[var(--fg)]">
          {result.error}
        </div>
      )}

      {result?.ok === true && (
        <InfocarReport r={result} pending={pending} onForceRefresh={forceRefresh} />
      )}
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// Rendering
// ───────────────────────────────────────────────────────────────────────────

function InfocarReport({
  r,
  pending,
  onForceRefresh,
}: {
  r: Extract<InfocarLookupResult, { ok: true }>;
  pending: boolean;
  onForceRefresh: () => void;
}) {
  const { payload, fipeOptions } = r;
  // The flattened payload already reflects the first FIPE option; show every
  // option Infocar returned so the operator can spot multiple trims/years.
  const options: FipeOption[] = fipeOptions.length
    ? fipeOptions
    : [{ codigoFipe: payload.codigoFipe ?? "", descricao: payload.descricao ?? "", valor: payload.valor ?? "" }];

  return (
    <div className="space-y-6">
      {r.fromCache && (
        <CacheBadge cachedAt={r.cachedAt} pending={pending} onForceRefresh={onForceRefresh} />
      )}

      <IdentityStrip placa={r.placa} payload={payload} upstreamLatencyMs={r.upstreamLatencyMs} />

      <section aria-labelledby="fipe-title" className="space-y-3">
        <h2 id="fipe-title" className="font-display uppercase tracking-[0.16em] text-sm text-[var(--accent)]">
          FIPE · {options.length > 1 ? `${options.length} correspondências` : "Valor de referência"}
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {options.map((o, i) => (
            <FipeCard key={`${o.codigoFipe}-${i}`} option={o} primary={i === 0} />
          ))}
        </div>
      </section>

      <VehicleDataPanel payload={payload} />

      <details className="surface p-4 group">
        <summary className="cursor-pointer text-xs uppercase tracking-[0.18em] text-[var(--fg-muted)] group-open:text-[var(--fg)]">
          Ler JSON bruto · diagnóstico
        </summary>
        <pre className="mt-3 max-h-96 overflow-auto text-[11px] leading-snug text-[var(--fg)] font-mono">
{JSON.stringify(r.raw, null, 2)}
        </pre>
      </details>
    </div>
  );
}

function CacheBadge({
  cachedAt,
  pending,
  onForceRefresh,
}: {
  cachedAt: string | null;
  pending: boolean;
  onForceRefresh: () => void;
}) {
  const when = cachedAt ? new Date(cachedAt) : null;
  const whenLabel = when
    ? when.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })
    : "data desconhecida";
  const dayDelta = when ? daysSince(when) : null;
  return (
    <div className="surface border border-[var(--accent)]/40 p-3 flex flex-wrap items-center justify-between gap-3 text-sm">
      <div className="flex items-baseline gap-2">
        <span className="text-[10px] uppercase tracking-[0.18em] text-[var(--accent)]">Em cache</span>
        <span className="text-[var(--fg-muted)]">
          Última consulta em <span className="text-[var(--fg-strong)]">{whenLabel}</span>
          {dayDelta !== null && (
            <span className="text-[var(--fg-muted)]"> · {dayDelta} {dayDelta === 1 ? "dia atrás" : "dias atrás"}</span>
          )}
        </span>
      </div>
      <button type="button" onClick={onForceRefresh} disabled={pending} className="btn-ghost text-xs">
        {pending ? "Consultando…" : "Forçar nova consulta"}
      </button>
    </div>
  );
}

function daysSince(d: Date): number {
  const ms = Date.now() - d.getTime();
  return Math.max(0, Math.floor(ms / 86_400_000));
}

function IdentityStrip({
  placa,
  payload,
  upstreamLatencyMs,
}: {
  placa: string;
  payload: VehiclePayload;
  upstreamLatencyMs: number | null;
}) {
  const ano = [payload.anoFabricacao, payload.anoModelo].filter(Boolean).join("/") || undefined;
  return (
    <div className="surface flex flex-wrap items-center gap-x-8 gap-y-3 p-4">
      <Plate placa={payload.placa || placa} size="lg" />
      <Field label="Chassi (VIN)" value={payload.chassi} mono />
      <Field label="Ano fab./modelo" value={ano} />
      <Field label="Código FIPE" value={payload.codigoFipe} mono />
      {upstreamLatencyMs !== null && <Field label="Latência upstream" value={`${upstreamLatencyMs} ms`} />}
    </div>
  );
}

function FipeCard({ option, primary }: { option: FipeOption; primary: boolean }) {
  const valor = formatBRL(parseValorFipe(option.valor));
  return (
    <article className={`surface p-4 flex flex-col gap-3 min-h-[9rem] ${primary ? "border border-[var(--accent)]/40" : ""}`}>
      <header className="flex items-baseline justify-between gap-3">
        <h3 className="font-display uppercase tracking-[0.12em] text-sm text-[var(--accent)]">
          {primary ? "FIPE · principal" : "FIPE · alternativa"}
        </h3>
        <span className="text-[10px] uppercase tracking-[0.18em] text-[var(--fg-faint)] font-mono">
          {option.codigoFipe || "—"}
        </span>
      </header>
      <div className="font-mono text-2xl text-[var(--fg-strong)] leading-none">
        {valor ?? "—"}
        <span className="ml-2 text-[10px] uppercase tracking-[0.18em] text-[var(--fg-muted)] align-middle">
          valor FIPE
        </span>
      </div>
      <p className="mt-auto pt-2 text-[11px] leading-snug text-[var(--fg-muted)]">
        {option.descricao || "Sem descrição FIPE."}
      </p>
    </article>
  );
}

function VehicleDataPanel({ payload }: { payload: VehiclePayload }) {
  const rows: Array<[string, unknown]> = [
    ["Modelo",                payload.modelo],
    ["Descrição FIPE",        payload.descricao],
    ["Ano de fabricação",     payload.anoFabricacao],
    ["Ano do modelo",         payload.anoModelo],
    ["Cor",                   payload.cor],
    ["Combustível",           payload.combustivel],
    ["Tipo de veículo",       payload.tipoVeiculo],
    ["Carroceria",            payload.carroceria],
    ["Procedência",           payload.procedencia],
    ["Situação do chassi",    payload.situacaoChassi],
    ["Motor",                 payload.motor],
    ["Potência (cv)",         payload.potencia],
    ["Cilindradas",           payload.numeroCilindradas],
    ["Caixa de câmbio",       payload.numeroCaixaCambio],
    ["Eixo tras./diferencial", payload.numeroEixoTraseiroDiferencial],
    ["Capacidade de carga",   payload.capacidadeDeCarga],
    ["Passageiros",           payload.capacidadeDePassageiros],
    ["Qtd. de eixos",         payload.quantidadeDeEixos],
    ["Tipo de montagem",      payload.tipoMontagem],
    ["UF",                    payload.uf],
    ["Município",             payload.municipio],
  ];
  const visible = rows.filter(([, v]) => v !== undefined && v !== null && v !== "");

  if (!visible.length) {
    return (
      <section aria-labelledby="vd-title" className="surface p-4">
        <h2 id="vd-title" className="font-display uppercase tracking-[0.16em] text-sm text-[var(--accent)] mb-2">
          Dados do veículo
        </h2>
        <p className="text-xs text-[var(--fg-muted)] italic">Sem dados retornados pela Infocar.</p>
      </section>
    );
  }

  return (
    <section aria-labelledby="vd-title" className="space-y-3">
      <h2 id="vd-title" className="font-display uppercase tracking-[0.16em] text-sm text-[var(--accent)]">
        Dados do veículo
      </h2>
      <dl className="surface grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-3 p-4">
        {visible.map(([label, val]) => (
          <div key={label}>
            <dt className="text-[10px] uppercase tracking-[0.16em] text-[var(--fg-muted)]">{label}</dt>
            <dd className="text-sm text-[var(--fg-strong)] mt-0.5 break-words">{String(val)}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function Field({
  label,
  value,
  mono,
}: {
  label: string;
  value: string | number | undefined | null;
  mono?: boolean;
}) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-[0.16em] text-[var(--fg-muted)]">{label}</p>
      <p className={`text-sm text-[var(--fg-strong)] ${mono ? "font-mono tracking-wide" : ""}`}>
        {value === undefined || value === null || value === "" ? "—" : String(value)}
      </p>
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// Helpers
// ───────────────────────────────────────────────────────────────────────────

const BRL = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 0,
});

function formatBRL(v: number | null): string | null {
  if (v === null) return null;
  return BRL.format(v);
}
