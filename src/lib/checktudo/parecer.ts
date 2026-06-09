// checktudo/parecer.ts — distill a CheckTudo payload into a compact "signals"
// object for the buy/risk verdict (Parecer de Compra). Keeping the input small
// is the whole point: we send ~a dozen decision fields to a cheap model, not
// the full payload. Pure (no server/node deps) — shared by the action and the
// backfill script.

export type ParecerSignals = Record<string, unknown>;
export type RecallRef = { afetado: string | null; motivo: string | null } | null;

function isEmpty(v: unknown): boolean {
  if (v == null) return true;
  if (typeof v === "string") return v.trim() === "";
  if (Array.isArray(v)) return v.length === 0;
  if (typeof v === "object") return Object.keys(v as object).length === 0;
  return false;
}

/** Breadth-first: first non-empty value whose key matches (case-insensitive).
 *  BFS prefers shallow matches (top-level chassi over a nested one). */
function findKey(root: unknown, key: string): unknown {
  const target = key.toLowerCase();
  const queue: unknown[] = [root];
  while (queue.length) {
    const cur = queue.shift();
    if (!cur || typeof cur !== "object") continue;
    if (Array.isArray(cur)) { queue.push(...cur); continue; }
    const obj = cur as Record<string, unknown>;
    for (const [k, v] of Object.entries(obj)) {
      if (k.toLowerCase() === target && !isEmpty(v)) return v;
    }
    queue.push(...Object.values(obj));
  }
  return undefined;
}

/** Truncated JSON so a nested object/array gives the model context cheaply. */
function compact(v: unknown, max = 280): unknown {
  if (v == null) return undefined;
  if (typeof v === "string") return v.slice(0, max);
  if (typeof v === "number" || typeof v === "boolean") return v;
  try {
    const s = JSON.stringify(v);
    return s.length > max ? s.slice(0, max) + "…" : JSON.parse(s);
  } catch {
    return String(v).slice(0, max);
  }
}

function toNum(v: unknown): number | null {
  const n = Number(String(v ?? "").replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n : null;
}

/** Odometer summary + a cheap rollback heuristic. */
function kmSummary(hist: unknown[]): Record<string, unknown> | undefined {
  const kms = hist.map((e) => (e && typeof e === "object" ? toNum((e as Record<string, unknown>).km) : null))
    .filter((n): n is number => n != null);
  if (!kms.length) return undefined;
  // Records are roughly chronological; flag any reading lower than a prior one.
  let rollback = false;
  for (let i = 1; i < kms.length; i++) if (kms[i] < kms[i - 1]) rollback = true;
  return { ultimoKm: kms[kms.length - 1], registros: kms.length, possivelAdulteracao: rollback };
}

/** FIPE current value + 12-month trend (from informacoesFipe.historicoPreco). */
function fipeSummary(data: unknown): Record<string, unknown> | undefined {
  const hist = findKey(data, "historicoPreco");
  if (!Array.isArray(hist) || hist.length === 0) return undefined;
  const pts = hist
    .map((e) => (e && typeof e === "object" ? e as Record<string, unknown> : null))
    .filter((e): e is Record<string, unknown> => !!e && e.predicao !== true)
    .map((e) => ({ ord: (toNum(e.ano) ?? 0) * 12 + (toNum(e.mes) ?? 0), valor: toNum(e.valor) }))
    .filter((p) => p.valor != null)
    .sort((a, b) => a.ord - b.ord)
    .slice(-12);
  if (pts.length < 2) return pts.length ? { valorAtual: pts[0].valor } : undefined;
  const first = pts[0].valor!, last = pts[pts.length - 1].valor!;
  const pct = first ? ((last - first) / first) * 100 : 0;
  return {
    valorAtual: last,
    variacao12mPct: Math.round(pct * 10) / 10,
    tendencia: pct > 0.5 ? "alta" : pct < -0.5 ? "queda" : "estável",
  };
}

export function extractParecerSignals(data: unknown, recall?: RecallRef): ParecerSignals {
  const s: ParecerSignals = {};
  const mm = findKey(data, "marcaModelo");
  const marca = findKey(data, "marca");
  const modelo = findKey(data, "modelo");
  s.veiculo = (mm as string) || [marca, modelo].filter(Boolean).join(" ") || undefined;
  const ano = findKey(data, "anoModelo"); if (ano != null) s.ano = ano;

  const indiceRisco = findKey(data, "indiceRisco"); if (indiceRisco != null) s.indiceRisco = indiceRisco;
  const parecerVendor = findKey(data, "parecer"); if (parecerVendor) s.parecerVendor = String(parecerVendor).slice(0, 160);

  if (recall && recall.afetado) s.recall = { afetado: recall.afetado, motivo: (recall.motivo || "").slice(0, 160) };

  const flags: Array<[string, string]> = [
    ["indicioSinistro", "indicioSinistro"],
    ["rouboFurto", "rouboFurto"],
    ["leilao", "leilao"],
    ["gravame", "gravame"],
    ["restricoes", "restricoes"],
    ["debitos", "debitos"],
    ["multas", "multas"],
  ];
  for (const [key, label] of flags) {
    const v = findKey(data, key);
    if (v != null && !isEmpty(v)) s[label] = compact(v);
  }

  const donos = findKey(data, "historicoProprietarios");
  if (Array.isArray(donos)) s.donos = donos.length;
  const kmHist = findKey(data, "historicoKm");
  if (Array.isArray(kmHist) && kmHist.length) { const k = kmSummary(kmHist); if (k) s.km = k; }

  const situacao = findKey(data, "situacaoChassi") ?? findKey(data, "situacaoVeiculo");
  if (situacao) s.situacao = String(situacao).slice(0, 80);
  const comunicacaoVenda = findKey(data, "comunicacaoVenda");
  if (comunicacaoVenda) s.comunicacaoVenda = String(comunicacaoVenda).slice(0, 80);

  const fipe = fipeSummary(data);
  if (fipe) s.fipe = fipe;

  return s;
}

/** Are there enough signals to bother asking the model? */
export function hasParecerSignals(s: ParecerSignals): boolean {
  // veiculo/ano alone aren't enough; require at least one risk/price signal.
  return Object.keys(s).some((k) => !["veiculo", "ano"].includes(k));
}
