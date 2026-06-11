"use client";

// CheckTudoClient.tsx — plate input + product selector + tailored renderer.
//
// CheckTudo returns a product-specific `data` object whose shape varies per
// querycode. Rather than hard-code one product's layout, we render with a
// field dictionary: known leaf keys are grouped into labelled pt-BR sections
// (Identificação · Motor & Câmbio · Características · Procedência & Local ·
// FIPE / Preço · Restrições & Débitos), and anything unmapped is humanised
// into "Outros dados". This satisfies "selectable product + tailored layout"
// while tolerating whatever fields a given product returns.

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter, useSearchParams } from "next/navigation";
import { normalizePlaca, isValidPlaca } from "@/lib/placa/normalize";
import { lookupPlacaChecktudo, type ChecktudoLookupResult } from "@/app/actions/checktudo";
import { extractRecall } from "@/lib/checktudo/recall";
import {
  CHECKTUDO_PRODUCTS,
  CHECKTUDO_DEFAULT_PRODUCT,
  type ChecktudoData,
} from "@/lib/checktudo/types";
import { Plate } from "@/components/Plate";

export function CheckTudoClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialPlaca = searchParams.get("placa") ?? "";
  const initialProduct = Number(searchParams.get("product")) || CHECKTUDO_DEFAULT_PRODUCT;

  const [placa, setPlaca] = useState(initialPlaca);
  const [product, setProduct] = useState<number>(initialProduct);
  const [result, setResult] = useState<ChecktudoLookupResult | null>(null);
  const [pending, start] = useTransition();

  const placaNorm = normalizePlaca(placa);
  const placaOk = isValidPlaca(placaNorm);

  // Auto-run when arriving with ?placa=X (deep-link from the history list).
  useEffect(() => {
    const q = searchParams.get("placa");
    const prod = Number(searchParams.get("product")) || CHECKTUDO_DEFAULT_PRODUCT;
    if (q && isValidPlaca(normalizePlaca(q))) {
      const norm = normalizePlaca(q);
      start(async () => setResult(await lookupPlacaChecktudo(norm, prod)));
    }
  }, [searchParams]);

  function run(e: React.FormEvent) {
    e.preventDefault();
    if (!placaOk) return;
    start(async () => setResult(await lookupPlacaChecktudo(placaNorm, product)));
  }

  function forceRefresh() {
    if (!placaOk) return;
    start(async () => {
      const next = await lookupPlacaChecktudo(placaNorm, product, { forceRefresh: true });
      setResult(next);
      router.refresh(); // keep the inline history fresh after a new row lands
    });
  }

  return (
    <div className="space-y-6">
      <form onSubmit={run} className="surface flex flex-wrap gap-3 items-end p-4 rise rise-d3">
        <div className="flex-1 min-w-[14rem]">
          <label htmlFor="ct-placa" className="block text-[10px] uppercase tracking-[0.16em] text-[var(--fg-muted)] mb-1">
            Placa
          </label>
          <input
            id="ct-placa"
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
        <div className="min-w-[14rem]">
          <label htmlFor="ct-product" className="block text-[10px] uppercase tracking-[0.16em] text-[var(--fg-muted)] mb-1">
            Produto CheckTudo
          </label>
          <select
            id="ct-product"
            value={product}
            onChange={(e) => setProduct(Number(e.target.value))}
            className="input"
          >
            {CHECKTUDO_PRODUCTS.map((p) => (
              <option key={p.code} value={p.code}>
                {p.name} ({p.code})
              </option>
            ))}
          </select>
        </div>
        <button type="submit" disabled={pending || !placaOk} className="btn-primary text-sm">
          {pending ? "Consultando…" : "Consultar"}
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
        <ChecktudoReport r={result} pending={pending} onForceRefresh={forceRefresh} />
      )}
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// Report
// ───────────────────────────────────────────────────────────────────────────

export function ChecktudoReport({
  r,
  pending,
  onForceRefresh,
  embedded = false,
}: {
  r: Extract<ChecktudoLookupResult, { ok: true }>;
  pending: boolean;
  onForceRefresh: () => void;
  /** When rendered inside the history expander, the parecer + laudo link are
   *  shown by the history card itself — hide them here to avoid redundancy. */
  embedded?: boolean;
}) {
  const { scalars, priceBlocks, opcionais } = collect(r.data);
  const sections = bucket(scalars, opcionais);

  // Recall affected-chassi check (item 11): the verdict is computed + persisted
  // by the action; here we just show it under Risco in "Outros dados" when the
  // consult carried recall data.
  const hasRecall = extractRecall(r.data).recallText.length > 0;

  return (
    <div className="space-y-6">
      {r.fromCache && <CacheBadge cachedAt={r.cachedAt} pending={pending} onForceRefresh={onForceRefresh} />}

      {!embedded && r.parecerVeredito && (
        <ParecerBanner
          veredito={r.parecerVeredito}
          motivo={r.parecerMotivo}
          recallAfetado={r.recallAfetado}
          recallMotivo={r.recallMotivo}
        />
      )}


      <header className="surface flex flex-wrap items-center gap-x-8 gap-y-3 p-4">
        <Plate placa={r.placa} size="lg" />
        <Field label="Produto" value={`${r.product.name} (${r.product.code})`} />
        {r.upstreamLatencyMs !== null && <Field label="Latência upstream" value={`${r.upstreamLatencyMs} ms`} />}
        {r.queryId && <Field label="Query ID" value={r.queryId} mono />}
      </header>

      {SECTION_ORDER.map((sid) => {
        const rows = sections[sid];
        const extra = sid === "outros" && hasRecall
          ? <RecallAffectedField afetado={r.recallAfetado} motivo={r.recallMotivo} />
          : undefined;
        if ((!rows || rows.length === 0) && !extra) return null;
        return <DataSection key={sid} title={SECTION_LABELS[sid]} rows={rows ?? []} extra={extra} />;
      })}

      {priceBlocks.length > 0 && (
        <PriceSection blocks={priceBlocks} consultedAt={r.consultedAt} history={extractFipeHistory(r.data)} />
      )}

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
  cachedAt, pending, onForceRefresh,
}: { cachedAt: string | null; pending: boolean; onForceRefresh: () => void }) {
  const when = cachedAt ? new Date(cachedAt) : null;
  const whenLabel = when
    ? when.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })
    : "data desconhecida";
  return (
    <div className="surface border border-[var(--accent)]/40 p-3 flex flex-wrap items-center justify-between gap-3 text-sm">
      <div className="flex items-baseline gap-2">
        <span className="text-[10px] uppercase tracking-[0.18em] text-[var(--accent)]">Em cache</span>
        <span className="text-[var(--fg-muted)]">
          Última consulta em <span className="text-[var(--fg-strong)]">{whenLabel}</span>
        </span>
      </div>
      <button type="button" onClick={onForceRefresh} disabled={pending} className="btn-ghost text-xs">
        {pending ? "Consultando…" : "Forçar nova consulta"}
      </button>
    </div>
  );
}

function DataSection({ title, rows, extra }: { title: string; rows: LabeledScalar[]; extra?: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="font-display uppercase tracking-[0.16em] text-sm text-[var(--accent)]">{title}</h2>
      <dl className="surface grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-3 p-4">
        {rows.map((row) => (
          <div key={row.label + row.value}>
            <dt className="text-[10px] uppercase tracking-[0.16em] text-[var(--fg-muted)]">{row.label}</dt>
            <dd className="text-sm text-[var(--fg-strong)] mt-0.5 break-words">{row.value}</dd>
          </div>
        ))}
        {extra}
      </dl>
    </section>
  );
}

// ── Recall affected-chassi verdict (precomputed by the action) ──────────────
export function recallAfetadoLabel(afetado: string | null): { label: string; color: string } {
  if (afetado === "sim") return { label: "SIM", color: "var(--danger)" };
  if (afetado === "nao") return { label: "NÃO", color: "var(--success)" };
  if (afetado === "indeterminado") return { label: "Indeterminado", color: "var(--fg-muted)" };
  return { label: "—", color: "var(--fg-muted)" };
}

// ── Parecer de Compra — buy/risk verdict (precomputed by the action) ────────
export function parecerLabel(v: string | null): { label: string; color: string; bg: string } {
  if (v === "comprar") return { label: "COMPRAR", color: "#15803d", bg: "rgba(34,197,94,0.12)" };
  if (v === "evitar") return { label: "EVITAR", color: "#b91c1c", bg: "rgba(220,38,38,0.12)" };
  if (v === "atencao") return { label: "ATENÇÃO", color: "#b45309", bg: "rgba(245,158,11,0.14)" };
  return { label: "—", color: "var(--fg-muted)", bg: "transparent" };
}

// Shared chip styling so the RECALL and parecer labels are the same size.
const VERDICT_CHIP = "text-sm uppercase tracking-[0.1em] font-bold px-3 py-1.5 rounded leading-none whitespace-nowrap";

function ParecerBanner({
  veredito, motivo, recallAfetado, recallMotivo,
}: {
  veredito: string;
  motivo: string | null;
  recallAfetado: string | null;
  recallMotivo: string | null;
}) {
  const { label, color, bg } = parecerLabel(veredito);
  // Only vehicles whose chassi falls inside an affected recall range get the tag.
  const affected = recallAfetado === "sim";
  const recallTip = recallMotivo?.trim() || undefined;
  return (
    <div
      className="surface flex flex-wrap items-center gap-x-3 gap-y-2 p-4"
      style={{ background: bg, borderColor: color }}
    >
      <span className="text-[10px] uppercase tracking-[0.18em] text-[var(--fg-muted)] w-full sm:w-auto">Parecer de Compra</span>
      {affected && (
        recallTip ? (
          <HoverInfo content={recallTip}>
            <span className={`cursor-help inline-block ${VERDICT_CHIP}`} style={{ color: "#fff", background: "var(--danger)" }}>RECALL</span>
          </HoverInfo>
        ) : (
          <span className={`inline-block ${VERDICT_CHIP}`} style={{ color: "#fff", background: "var(--danger)" }}>RECALL</span>
        )
      )}
      {motivo?.trim() ? (
        <HoverInfo content={motivo}>
          <span className={`cursor-help inline-block ${VERDICT_CHIP}`} style={{ color: "#fff", background: color }}>{label}</span>
        </HoverInfo>
      ) : (
        <span className={VERDICT_CHIP} style={{ color: "#fff", background: color }}>{label}</span>
      )}
      <span className="text-[10px] text-[var(--fg-faint)] w-full">Passe o mouse sobre o parecer para ver o porquê · análise por IA a partir dos sinais da consulta — não substitui vistoria.</span>
    </div>
  );
}

function RecallAffectedField({ afetado, motivo }: { afetado: string | null; motivo: string | null }) {
  const { label, color } = recallAfetadoLabel(afetado);
  const tip = motivo?.trim() || undefined;
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-[0.16em] text-[var(--fg-muted)]">Chassi com Recall?</dt>
      <dd className="text-sm mt-0.5 font-semibold" style={{ color }}>
        {tip ? (
          <HoverInfo content={tip}>
            <span className="cursor-help underline decoration-dotted underline-offset-4">{label}</span>
          </HoverInfo>
        ) : (
          label
        )}
      </dd>
    </div>
  );
}

// Styled hover popover, portal'd to <body> with fixed positioning so it is
// never clipped by an `overflow-hidden` ancestor (e.g. the history card).
export function HoverInfo({
  content, children, width = 320, focusable = true,
}: {
  content: React.ReactNode;
  children: React.ReactNode;
  width?: number;
  /** Set false when nested inside a <button> (a focusable span would be
   *  invalid interactive content); hover still works. */
  focusable?: boolean;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  const show = useCallback(() => {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    const left = Math.max(8, Math.min(r.left, window.innerWidth - width - 12));
    setPos({ top: r.bottom + 6, left });
  }, [width]);
  const hide = useCallback(() => setPos(null), []);

  const focusProps = focusable ? { tabIndex: 0, onFocus: show, onBlur: hide } : {};

  return (
    <span
      ref={ref}
      className="relative inline-block"
      onMouseEnter={show}
      onMouseLeave={hide}
      {...focusProps}
    >
      {children}
      {pos &&
        createPortal(
          <span
            role="tooltip"
            style={{ position: "fixed", top: pos.top, left: pos.left, zIndex: 9999, width }}
            className="block px-3 py-2 rounded-md text-[11.5px] font-normal normal-case leading-snug
                       bg-[var(--bg-elev-2)] text-[var(--fg)] border border-[var(--border)]
                       shadow-[0_8px_28px_-8px_rgba(0,0,0,0.45)]"
          >
            {content}
          </span>,
          document.body,
        )}
    </span>
  );
}

function PriceSection({ blocks, consultedAt, history }: { blocks: PriceBlock[]; consultedAt: string; history: PricePoint[] }) {
  return (
    <section className="space-y-3">
      <h2 className="font-display uppercase tracking-[0.16em] text-sm text-[var(--accent)]">
        {history.length >= 2 ? (
          <HoverInfo content={<PriceChart points={history} />} width={360}>
            <span className="cursor-help underline decoration-dotted underline-offset-4">FIPE / Preço</span>
            <span className="ml-1.5 text-[10px] align-middle text-[var(--fg-muted)]">📈 12 meses</span>
          </HoverInfo>
        ) : (
          "FIPE / Preço"
        )}
      </h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {blocks.flatMap((b, bi) =>
          b.items.map((it, i) => <PriceCard key={`${bi}-${i}`} item={it} consultedAt={consultedAt} />),
        )}
      </div>
    </section>
  );
}

type PricePoint = { mes: number; ano: number; valor: number };

/** Find the first `historicoPreco` array anywhere in the product data. */
function findHistorico(node: unknown): unknown[] | null {
  if (Array.isArray(node)) {
    for (const el of node) { const r = findHistorico(el); if (r) return r; }
    return null;
  }
  if (!node || typeof node !== "object") return null;
  const obj = node as Record<string, unknown>;
  const direct = obj["historicoPreco"] ?? obj["historicopreco"];
  if (Array.isArray(direct) && direct.length) return direct;
  for (const v of Object.values(obj)) { const r = findHistorico(v); if (r) return r; }
  return null;
}

/** Last 12 actual (non-prediction) monthly FIPE values, chronological. */
function extractFipeHistory(data: unknown): PricePoint[] {
  const arr = findHistorico(data);
  if (!arr) return [];
  const pts: PricePoint[] = [];
  for (const e of arr) {
    if (!e || typeof e !== "object") continue;
    const o = e as Record<string, unknown>;
    if (o.predicao === true) continue; // exclude future predictions
    const mes = Number(o.mes), ano = Number(o.ano), valor = Number(o.valor);
    if (!Number.isFinite(mes) || !Number.isFinite(ano) || !Number.isFinite(valor) || valor <= 0) continue;
    pts.push({ mes, ano, valor });
  }
  pts.sort((a, b) => a.ano * 12 + a.mes - (b.ano * 12 + b.mes));
  return pts.slice(-12);
}

const BRL0 = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const monthLabel = (p: PricePoint) => `${String(p.mes).padStart(2, "0")}/${String(p.ano).slice(2)}`;

/** Inline SVG line/area chart of the 12-month FIPE price variation. */
function PriceChart({ points }: { points: PricePoint[] }) {
  const W = 340, H = 132, PADL = 10, PADR = 10, PADT = 6, PADB = 18;
  const vals = points.map((p) => p.valor);
  const min = Math.min(...vals), max = Math.max(...vals), range = max - min || 1;
  const iw = W - PADL - PADR, ih = H - PADT - PADB;
  const X = (i: number) => PADL + (points.length <= 1 ? iw / 2 : (i / (points.length - 1)) * iw);
  const Y = (v: number) => PADT + ih - ((v - min) / range) * ih;
  const line = points.map((p, i) => `${X(i).toFixed(1)},${Y(p.valor).toFixed(1)}`).join(" ");
  const area = `${X(0).toFixed(1)},${(PADT + ih).toFixed(1)} ${line} ${X(points.length - 1).toFixed(1)},${(PADT + ih).toFixed(1)}`;
  const first = points[0], last = points[points.length - 1];
  const delta = last.valor - first.valor;
  const pct = first.valor ? (delta / first.valor) * 100 : 0;
  const up = delta >= 0;
  const accent = "var(--accent)";

  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="text-[10px] uppercase tracking-[0.14em] text-[var(--fg-muted)]">
          Variação FIPE · {points.length} {points.length === 1 ? "mês" : "meses"}
        </span>
        <span className="text-[11px] font-semibold" style={{ color: up ? "var(--success)" : "var(--danger)" }}>
          {up ? "▲" : "▼"} {Math.abs(pct).toFixed(1).replace(".", ",")}%
        </span>
      </div>
      <div className="text-[13px] font-semibold text-[var(--fg-strong)] mt-0.5">
        {BRL0.format(last.valor)}
        <span className="text-[10px] font-normal text-[var(--fg-muted)]"> · atual ({monthLabel(last)})</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full mt-1" preserveAspectRatio="none" style={{ height: 110 }}>
        <polygon points={area} fill={accent} opacity="0.12" />
        <polyline points={line} fill="none" stroke={accent} strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" />
        {points.map((p, i) => (
          <circle key={i} cx={X(i)} cy={Y(p.valor)} r={i === points.length - 1 ? 2.8 : 1.3} fill={accent} />
        ))}
        <text x={PADL} y={Y(max) - 2} fontSize="7" fill="var(--fg-muted)">{BRL0.format(max)}</text>
        <text x={PADL} y={Y(min) + 7} fontSize="7" fill="var(--fg-muted)">{BRL0.format(min)}</text>
        <text x={X(0)} y={H - 5} fontSize="7" fill="var(--fg-muted)" textAnchor="start">{monthLabel(first)}</text>
        <text x={X(points.length - 1)} y={H - 5} fontSize="7" fill="var(--fg-muted)" textAnchor="end">{monthLabel(last)}</text>
      </svg>
    </div>
  );
}

function PriceCard({ item, consultedAt }: { item: Record<string, unknown>; consultedAt: string }) {
  const raw = (...keys: string[]): unknown => {
    for (const k of keys) {
      const found = Object.entries(item).find(([ik]) => ik.toLowerCase() === k.toLowerCase());
      if (found && isNonEmpty(found[1])) return found[1];
    }
    return null;
  };
  const str = (...keys: string[]): string | null => {
    const v = raw(...keys);
    return v === null ? null : String(v);
  };

  const modelo = str("modelo", "versao");
  const marca = str("marca");
  // The headline value is the current FIPE: valorAtual when present, otherwise
  // the value the vendor returned under valor / valorZeroKM.
  const fipeAtual = numberOrNull(raw("valorAtual") ?? raw("valor") ?? raw("valorZeroKM"));
  const zeroKm = numberOrNull(raw("valorZeroKM"));
  const codigo = str("codigo", "codigoFipe", "fipeId");
  const comb = str("combustivel");
  const dataRef = str("dataRefFipe");

  return (
    <article className="surface p-4 flex flex-col gap-2 min-h-[8rem]">
      <div className="font-mono text-2xl text-[var(--fg-strong)] leading-none">
        {formatBRL(fipeAtual) ?? "—"}
        <span className="ml-2 text-[10px] uppercase tracking-[0.18em] text-[var(--fg-muted)] align-middle">FIPE Atual</span>
      </div>
      <p className="text-[10px] text-[var(--fg-muted)]">Consulta: {fmtConsultDate(consultedAt)}</p>
      {modelo && <p className="text-sm text-[var(--fg-strong)]">{marca ? `${marca} ` : ""}{modelo}</p>}
      <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs mt-auto">
        {codigo && <Mini label="Código FIPE" value={codigo} />}
        {comb && <Mini label="Combustível" value={comb} />}
        {zeroKm !== null && zeroKm !== fipeAtual && <Mini label="Zero-km" value={formatBRL(zeroKm) ?? "—"} />}
        {dataRef && <Mini label="Ref. FIPE" value={dataRef} />}
      </dl>
    </article>
  );
}

function fmtConsultDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
  } catch {
    return iso;
  }
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-[0.16em] text-[var(--fg-muted)]">{label}</p>
      <p className="font-mono text-[var(--fg)]">{value}</p>
    </div>
  );
}

function Field({ label, value, mono }: { label: string; value: string | null; mono?: boolean }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-[0.16em] text-[var(--fg-muted)]">{label}</p>
      <p className={`text-sm text-[var(--fg-strong)] ${mono ? "font-mono tracking-wide break-all" : ""}`}>
        {value === null || value === "" ? "—" : value}
      </p>
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// Data flattening + field dictionary
// ───────────────────────────────────────────────────────────────────────────

type SectionId = "ident" | "motor" | "caract" | "proc" | "restr" | "outros";
const SECTION_ORDER: SectionId[] = ["ident", "motor", "caract", "proc", "restr", "outros"];
const SECTION_LABELS: Record<SectionId, string> = {
  ident: "Identificação",
  motor: "Motor & Câmbio",
  caract: "Características",
  proc: "Procedência & Local",
  restr: "Restrições & Débitos",
  outros: "Outros dados",
};

type LabeledScalar = { label: string; value: string };
type PriceBlock = { key: string; items: Record<string, unknown>[] };

const KNOWN_PRICE_ARRAYS = new Set([
  "codigofipe", "precificadori", "precificadorii", "informacoesfipe", "historicopreco",
]);

// Leaf key (lowercased) → pt-BR label.
const FIELD_LABELS: Record<string, string> = {
  placa: "Placa", chassi: "Chassi", renavam: "Renavam", motor: "Motor", nummotor: "Nº do motor",
  marca: "Marca", modelo: "Modelo", marcamodelo: "Marca/Modelo", codigomarcamodelo: "Cód. marca/modelo",
  versao: "Versão", categoria: "Categoria", anofabricacao: "Ano de fabricação", anomodelo: "Ano do modelo",
  especie: "Espécie", especieveiculo: "Espécie", tipoveiculo: "Tipo de veículo",
  tipocarroceria: "Tipo de carroceria", carroceria: "Carroceria", numcarroceria: "Nº carroceria",
  di: "DI", segmento: "Segmento",
  combustivel: "Combustível", codigocombustivel: "Cód. combustível", cilindradas: "Cilindradas (cc)",
  potencia: "Potência (cv)", potenciamotor: "Potência do motor", caixacambio: "Caixa de câmbio",
  numterceiroeixo: "Nº 3º eixo",
  corveiculo: "Cor", cor: "Cor", capacidadecarga: "Capacidade de carga", capacidadepassageiro: "Passageiros",
  quantidadepassageiro: "Passageiros", capmaxtracao: "Cap. máx. tração", eixos: "Eixos",
  pbt: "PBT (t)", cmt: "CMT (t)", opcionais: "Opcionais",
  nacionalidade: "Nacionalidade", procedencia: "Procedência", localfabricacao: "Local de fabricação",
  pais: "País", origem: "Origem", regiao: "Região", municipio: "Município", uf: "UF", estado: "Estado",
  situacaoveiculo: "Situação", exerciciolicenciamento: "Exercício licenciamento",
  licdata: "Licenciamento (data)", dataemissaocrv: "Emissão CRV",
  comunicacaovenda: "Comunicação de venda", comunicacaoinclusao: "Comunicação de inclusão",
};

function sectionFor(keyLower: string): SectionId {
  const IDENT = new Set(["placa", "chassi", "renavam", "marca", "modelo", "marcamodelo", "codigomarcamodelo", "versao", "categoria", "anofabricacao", "anomodelo", "especie", "especieveiculo", "tipoveiculo", "tipocarroceria", "carroceria", "di", "segmento"]);
  const MOTOR = new Set(["combustivel", "codigocombustivel", "cilindradas", "potencia", "potenciamotor", "caixacambio", "nummotor", "motor", "numcarroceria", "numterceiroeixo"]);
  const CARACT = new Set(["corveiculo", "cor", "capacidadecarga", "capacidadepassageiro", "quantidadepassageiro", "capmaxtracao", "eixos", "pbt", "cmt", "opcionais"]);
  const PROC = new Set(["nacionalidade", "procedencia", "localfabricacao", "pais", "origem", "regiao", "municipio", "uf", "estado"]);
  if (IDENT.has(keyLower)) return "ident";
  if (MOTOR.has(keyLower)) return "motor";
  if (CARACT.has(keyLower)) return "caract";
  if (PROC.has(keyLower)) return "proc";
  if (/^(restricao|debito|existedebito|comunicacao|situacao|gravame|multa|intencao|outrasrestricoes)/.test(keyLower) ||
      keyLower === "licdata" || keyLower === "exerciciolicenciamento" || keyLower === "dataemissaocrv") {
    return "restr";
  }
  return "outros";
}

function labelFor(key: string): string {
  return FIELD_LABELS[key.toLowerCase()] ?? humanize(key);
}

function humanize(key: string): string {
  const spaced = key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function collect(data: ChecktudoData): {
  scalars: { key: string; value: string }[];
  priceBlocks: PriceBlock[];
  opcionais: string[];
} {
  const scalars: { key: string; value: string }[] = [];
  const priceBlocks: PriceBlock[] = [];
  const opcionais: string[] = [];
  const seen = new Set<string>(); // dedupe scalars by leaf key

  function walk(node: unknown, depth: number) {
    if (!node || typeof node !== "object" || depth > 6) return;
    for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
      const kl = k.toLowerCase();
      if (v === null || v === undefined || v === "") continue;
      if (Array.isArray(v)) {
        if (kl === "opcionais") {
          for (const it of v) {
            if (it && typeof it === "object" && "descricao" in (it as Record<string, unknown>)) {
              opcionais.push(String((it as Record<string, unknown>).descricao));
            } else if (isNonEmpty(it)) opcionais.push(String(it));
          }
          continue;
        }
        if (KNOWN_PRICE_ARRAYS.has(kl)) {
          const items = v.filter((x) => x && typeof x === "object") as Record<string, unknown>[];
          if (items.length) priceBlocks.push({ key: k, items });
          continue;
        }
        if (v.every(isNonEmpty)) {
          if (!seen.has(kl)) { seen.add(kl); scalars.push({ key: k, value: v.map(String).join(", ") }); }
          continue;
        }
        for (const it of v) walk(it, depth + 1);
        continue;
      }
      if (typeof v === "object") { walk(v, depth + 1); continue; }
      // primitive
      if (!seen.has(kl)) { seen.add(kl); scalars.push({ key: k, value: formatScalar(kl, v) }); }
    }
  }
  walk(data, 0);
  return { scalars, priceBlocks, opcionais };
}

function bucket(
  scalars: { key: string; value: string }[],
  opcionais: string[],
): Record<SectionId, LabeledScalar[]> {
  const out: Record<SectionId, LabeledScalar[]> = {
    ident: [], motor: [], caract: [], proc: [], restr: [], outros: [],
  };
  for (const s of scalars) {
    const sid = sectionFor(s.key.toLowerCase());
    out[sid].push({ label: labelFor(s.key), value: s.value });
  }
  if (opcionais.length) {
    out.caract.push({ label: "Opcionais", value: opcionais.join(" · ") });
  }
  return out;
}

// ── value formatting ────────────────────────────────────────────────────────
const CURRENCY_KEYS = /^(valor|debito|valorzerokm|valorfipe|valoratual)/;

function formatScalar(keyLower: string, v: unknown): string {
  if (typeof v === "boolean") return v ? "Sim" : "Não";
  if (CURRENCY_KEYS.test(keyLower)) {
    const n = numberOrNull(v);
    if (n !== null) return formatBRL(n) ?? String(v);
  }
  return String(v);
}

function isNonEmpty(v: unknown): boolean {
  return (typeof v === "string" && v.trim() !== "") || typeof v === "number" || typeof v === "boolean";
}

function numberOrNull(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  // CheckTudo sends prices as strings sometimes with thousands separators.
  const n = typeof v === "number" ? v : Number(String(v).replace(/\.(?=\d{3}\b)/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
function formatBRL(v: number | null): string | null {
  if (v === null) return null;
  return BRL.format(v);
}
