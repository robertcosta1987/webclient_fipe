// laudo/dictionary.ts — Phase 1: domain translation layer.
//
// Turns raw coded values from the CheckTudo payload into user-friendly PT-BR
// labels + a severity/color, so the UI NEVER shows a raw code. Pure data + pure
// functions (no LLM, no IO). Mappings here are CONFIRMED by the product owner;
// anything not yet confirmed is a TODO that resolves to "desconhecido" — we
// never guess a meaning.

export type Severidade = "ok" | "atencao" | "alto" | "critico" | "desconhecido";
export type Cor = "verde" | "amarelo" | "laranja" | "vermelho" | "cinza";
export type Translation = { label: string; severidade: Severidade; cor: Cor; desc?: string };

const FALLBACK = (raw: unknown): Translation => ({
  label: raw === null || raw === undefined || raw === "" ? "não consta" : String(raw),
  severidade: "desconhecido",
  cor: "cinza",
});

// ── score_leilao (1–4, maior = pior) ────────────────────────────────────────
export const SCORE_LEILAO: Record<string, Translation> = {
  "1": { label: "Aparentemente inteiro", severidade: "ok", cor: "verde" },
  "2": { label: "Pequenos danos", severidade: "atencao", cor: "amarelo" },
  "3": { label: "Médios danos", severidade: "alto", cor: "laranja" },
  "4": { label: "Grandes danos", severidade: "critico", cor: "vermelho" },
};

// ── radar_securitario_item ──────────────────────────────────────────────────
export const RADAR_SECURITARIO: Record<string, Translation> = {
  aceitavel_sem_restricoes: { label: "Aceitável sem restrições", severidade: "ok", cor: "verde" },
  aceitavel_com_restricoes: { label: "Aceitável com restrições", severidade: "atencao", cor: "amarelo" },
  aceitavel_mediante_inspecao: { label: "Aceitável mediante inspeção", severidade: "alto", cor: "laranja" },
  recusavel: { label: "Recusável", severidade: "critico", cor: "vermelho" },
};

// ── risco_comercial (semáforo) ──────────────────────────────────────────────
export const RISCO_COMERCIAL: Record<string, Translation> = {
  baixo: { label: "Baixo", severidade: "ok", cor: "verde" },
  medio: { label: "Médio", severidade: "atencao", cor: "amarelo" },
  alto: {
    label: "Alto",
    severidade: "critico",
    cor: "vermelho",
    desc: "Pode gerar negativa de financiamento/seguro ou cobertura inferior a 100%.",
  },
};

// ── csv_tipo / csv_codigo (INMETRO CSV) ─────────────────────────────────────
// TODO: full INMETRO CSV code table — DO NOT invent other codes.
export const CSV_TIPO: Record<string, Translation> = {
  SINISTRADO: { label: "Sinistrado", severidade: "critico", cor: "vermelho", desc: "Veículo recuperado de sinistro." },
};
export const CSV_CODIGO: Record<string, string> = {
  "1073": "Recuperação de sinistro",
};

// ── quadro_avisos (13 boolean flags; SIM = ruim para todos) ─────────────────
export type QuadroFlag =
  | "restricoes_nacionais" | "chassi_remarcado" | "restricoes_estaduais" | "motor_alterado"
  | "csv" | "roubo_furto" | "registro_leilao" | "indicio_sinistro" | "risco_comercial"
  | "recall" | "renajud" | "multas_renainf" | "gravame";

export const QUADRO_FLAG_LABEL: Record<QuadroFlag, string> = {
  restricoes_nacionais: "Restrições (base nacional)",
  chassi_remarcado: "Chassi remarcado",
  restricoes_estaduais: "Restrições (base estadual)",
  motor_alterado: "Motor alterado",
  csv: "CSV (Certificado de Segurança Veicular)",
  roubo_furto: "Roubo/furto",
  registro_leilao: "Registro de leilão",
  indicio_sinistro: "Indício de sinistro",
  risco_comercial: "Risco comercial",
  recall: "Recall",
  renajud: "Renajud (bloqueio judicial)",
  multas_renainf: "Multas Renainf",
  gravame: "Gravame / restrição financeira",
};

export const QUADRO_FLAGS: QuadroFlag[] = Object.keys(QUADRO_FLAG_LABEL) as QuadroFlag[];

/** Translate one quadro-de-avisos flag. SIM (true) is always the "ruim" side. */
export function translateFlag(flag: QuadroFlag, sim: boolean | null): Translation {
  const label = QUADRO_FLAG_LABEL[flag] ?? flag;
  if (sim === null) return { label, severidade: "desconhecido", cor: "cinza", desc: "não consta" };
  return sim
    ? { label, severidade: "critico", cor: "vermelho", desc: "SIM" }
    : { label, severidade: "ok", cor: "verde", desc: "NÃO" };
}

// ── vistoria_especial (escala 0–100; faixas) ────────────────────────────────
// TODO: confirm the real max with CheckTudo (assuming 100 until then).
export function translateVistoriaEspecial(value: number | null): Translation {
  if (value === null || !Number.isFinite(value)) return { label: "não consta", severidade: "desconhecido", cor: "cinza" };
  const v = Math.max(0, Math.min(100, value));
  if (v <= 33) return { label: `Baixa (${v})`, severidade: "ok", cor: "verde" };
  if (v <= 66) return { label: `Média (${v})`, severidade: "atencao", cor: "amarelo" };
  return { label: `Alta (${v})`, severidade: "critico", cor: "vermelho" };
}

// ── Field-name labels (single source of truth; extends the set previously
//    embedded in CheckTudoClient). Leaf key (lowercased) → pt-BR label. ───────
export const FIELD_LABELS: Record<string, string> = {
  placa: "Placa", chassi: "Chassi", renavam: "Renavam", motor: "Motor", nummotor: "Nº do motor",
  marca: "Marca", modelo: "Modelo", marcamodelo: "Marca/Modelo", versao: "Versão",
  anofabricacao: "Ano de fabricação", anomodelo: "Ano do modelo", combustivel: "Combustível",
  potencia: "Potência (cv)", cor: "Cor", corveiculo: "Cor", municipio: "Município", uf: "UF",
  codigofipe: "Código FIPE", valoratual: "Valor FIPE atual", situacaochassi: "Situação do chassi",
  // laudo-specific
  indicerisco: "Índice de risco", parecer: "Parecer", scoreleilao: "Score de leilão",
  vistoriaespecial: "Vistoria especial", aceitacao: "Aceitação de mercado",
  percentualsobreref: "Percentual sobre referência", restricaofinanceira: "Restrição financeira",
  restricaorenajud: "Renajud", debitoipva: "Débito IPVA", debitolicenciamento: "Débito licenciamento",
  debitomultas: "Débito multas", debitorenainf: "Débito Renainf", debitodpvat: "Débito DPVAT",
};

const unknownLog = new Set<string>();
function logUnknown(field: string, raw: unknown): void {
  const k = `${field}:${String(raw)}`;
  if (unknownLog.has(k)) return;
  unknownLog.add(k);
  console.warn(`[laudo/dictionary] valor não mapeado para "${field}": ${JSON.stringify(raw)} → "desconhecido"`);
}

/** Translate a coded field value to {label, severidade, cor, desc?}.
 *  Unknown values fall back to {label: raw, severidade:"desconhecido", cor:"cinza"}
 *  and are logged. TODO categories (radar/csv) resolve to "desconhecido" until a
 *  full mapping is supplied — never guessed. */
export function translateField(field: string, rawValue: unknown): Translation {
  const key = (rawValue ?? "").toString().trim();
  switch (field) {
    case "score_leilao": return SCORE_LEILAO[key] ?? (key ? (logUnknown(field, rawValue), FALLBACK(rawValue)) : FALLBACK(null));
    case "radar_securitario_item": {
      const norm = key.toLowerCase().replace(/\s+/g, "_");
      return RADAR_SECURITARIO[norm] ?? (key ? (logUnknown(field, rawValue), FALLBACK(rawValue)) : FALLBACK(null));
    }
    case "risco_comercial": return RISCO_COMERCIAL[key.toLowerCase()] ?? (key ? (logUnknown(field, rawValue), FALLBACK(rawValue)) : FALLBACK(null));
    case "csv_tipo": return CSV_TIPO[key.toUpperCase()] ?? (key ? (logUnknown(field, rawValue), FALLBACK(rawValue)) : FALLBACK(null));
    case "vistoria_especial": return translateVistoriaEspecial(key === "" ? null : Number(key));
    default:
      logUnknown(field, rawValue);
      return FALLBACK(rawValue);
  }
}

/** Field-name → PT-BR label (single source of truth). */
export function labelFor(key: string): string {
  const k = key.toLowerCase();
  if (FIELD_LABELS[k]) return FIELD_LABELS[k];
  const spaced = key.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/[_-]+/g, " ").trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}
