"use client";

// AddCarModal — the headline UX. Operator types a plate, presses Enter,
// every other field on the form autofills from the platform response.
//
// Spec essentials (see commit message for the full spec):
//   - Placa is the only required field to start. Plain text input —
//     no hyphen, no mask. Strip hyphens/whitespace on the fly.
//   - Helper line visible while empty/focused: "Digite a placa e pressione
//     Enter para preencher automaticamente."
//   - Enter is the only autofill trigger (NOT blur, NOT debounce).
//   - Enter on placa must NOT submit the form.
//   - Validate before calling — bad plate => inline error, no API call.
//   - In-flight: spinner inside the placa input, input disabled.
//   - Success: brief amber highlight on autofilled fields, focus moves to
//     chassi. Empty-string vendor values render as empty inputs, not "".
//   - Error: inline message under placa, other fields preserved, "Tentar
//     novamente" link, placa input re-enabled.
//   - Re-trigger guard: if user has edited other fields since the last
//     autofill snapshot and re-enters a (different) placa, ask first.
//   - Duplicate banner: non-blocking warning if placa is already in DB,
//     with link to the existing row.
//   - Submit inserts; on UNIQUE-constraint violation surface the error.

import { useCallback, useEffect, useId, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { isValidPlaca, normalizePlaca } from "@/lib/placa/normalize";
import { lookupPlaca, insertCarro } from "@/app/actions/carros";
import { parseValorFipe, type VehiclePayload } from "@/lib/platform/types";

type Field = {
  key: keyof FormState;
  label: string;
  section: "id" | "modelo" | "origem" | "tec" | "fipe";
  type?: "text" | "number";
  width?: "full" | "half" | "third";
};

type FormState = {
  chassi: string;
  modelo: string;
  anoFabricacao: string;
  anoModelo: string;
  cor: string;
  combustivel: string;
  uf: string;
  municipio: string;
  tipoVeiculo: string;
  motor: string;
  numeroCaixaCambio: string;
  numeroEixoTraseiroDiferencial: string;
  procedencia: string;
  situacaoChassi: string;
  capacidadeDeCarga: string;
  potencia: string;
  numeroCilindradas: string;
  capacidadeDePassageiros: string;
  tipoMontagem: string;
  quantidadeDeEixos: string;
  carroceria: string;
  codigoFipe: string;
  descricao: string;
  valor: string;
};

const FIELDS: Field[] = [
  { key: "chassi", label: "Chassi (VIN)", section: "id", width: "half" },
  { key: "modelo", label: "Modelo", section: "modelo", width: "full" },
  { key: "anoFabricacao", label: "Ano de fabricação", section: "modelo", type: "number", width: "third" },
  { key: "anoModelo", label: "Ano do modelo", section: "modelo", type: "number", width: "third" },
  { key: "cor", label: "Cor", section: "modelo", width: "third" },
  { key: "combustivel", label: "Combustível", section: "modelo", width: "half" },
  { key: "tipoVeiculo", label: "Tipo de veículo", section: "modelo", width: "half" },
  { key: "carroceria", label: "Carroceria", section: "modelo", width: "half" },
  { key: "municipio", label: "Município", section: "origem", width: "half" },
  { key: "uf", label: "UF", section: "origem", width: "third" },
  { key: "procedencia", label: "Procedência", section: "origem", width: "half" },
  { key: "situacaoChassi", label: "Situação do chassi", section: "origem", width: "half" },
  { key: "motor", label: "Motor", section: "tec", width: "half" },
  { key: "numeroCaixaCambio", label: "Caixa de câmbio", section: "tec", width: "half" },
  { key: "numeroEixoTraseiroDiferencial", label: "Eixo traseiro / diferencial", section: "tec", width: "full" },
  { key: "potencia", label: "Potência", section: "tec", width: "third" },
  { key: "numeroCilindradas", label: "Cilindradas", section: "tec", width: "third" },
  { key: "capacidadeDePassageiros", label: "Passageiros", section: "tec", width: "third" },
  { key: "capacidadeDeCarga", label: "Capacidade de carga", section: "tec", width: "third" },
  { key: "tipoMontagem", label: "Tipo de montagem", section: "tec", width: "third" },
  { key: "quantidadeDeEixos", label: "Quantidade de eixos", section: "tec", width: "third" },
  { key: "codigoFipe", label: "Código FIPE", section: "fipe", width: "third" },
  { key: "descricao", label: "Descrição FIPE", section: "fipe", width: "full" },
  { key: "valor", label: "Valor FIPE", section: "fipe", width: "third" },
];

const SECTIONS: Array<{ id: Field["section"]; title: string }> = [
  { id: "id", title: "Identificação" },
  { id: "modelo", title: "Modelo" },
  { id: "origem", title: "Origem" },
  { id: "tec", title: "Especificações técnicas" },
  { id: "fipe", title: "FIPE" },
];

const EMPTY_FORM: FormState = Object.fromEntries(FIELDS.map((f) => [f.key, ""])) as FormState;

function payloadToForm(p: VehiclePayload): FormState {
  return {
    chassi: p.chassi || "",
    modelo: p.modelo || "",
    anoFabricacao: p.anoFabricacao == null ? "" : String(p.anoFabricacao),
    anoModelo: p.anoModelo == null ? "" : String(p.anoModelo),
    cor: p.cor || "",
    combustivel: p.combustivel || "",
    uf: p.uf || "",
    municipio: p.municipio || "",
    tipoVeiculo: p.tipoVeiculo || "",
    motor: p.motor || "",
    numeroCaixaCambio: p.numeroCaixaCambio || "",
    numeroEixoTraseiroDiferencial: p.numeroEixoTraseiroDiferencial || "",
    procedencia: p.procedencia || "",
    situacaoChassi: p.situacaoChassi || "",
    capacidadeDeCarga: p.capacidadeDeCarga || "",
    potencia: p.potencia || "",
    numeroCilindradas: p.numeroCilindradas || "",
    capacidadeDePassageiros: p.capacidadeDePassageiros || "",
    tipoMontagem: p.tipoMontagem || "",
    quantidadeDeEixos: p.quantidadeDeEixos || "",
    carroceria: p.carroceria || "",
    codigoFipe: p.codigoFipe || "",
    descricao: p.descricao || "",
    valor: p.valor || "",
  };
}

function formToPayload(placa: string, f: FormState): Partial<VehiclePayload> {
  const num = (s: string) => (s.trim() === "" ? null : Number(s));
  return {
    placa,
    chassi: f.chassi,
    modelo: f.modelo,
    anoFabricacao: num(f.anoFabricacao),
    anoModelo: num(f.anoModelo),
    cor: f.cor,
    combustivel: f.combustivel,
    uf: f.uf,
    municipio: f.municipio,
    tipoVeiculo: f.tipoVeiculo,
    motor: f.motor,
    numeroCaixaCambio: f.numeroCaixaCambio,
    numeroEixoTraseiroDiferencial: f.numeroEixoTraseiroDiferencial,
    procedencia: f.procedencia,
    situacaoChassi: f.situacaoChassi,
    capacidadeDeCarga: f.capacidadeDeCarga,
    potencia: f.potencia,
    numeroCilindradas: f.numeroCilindradas,
    capacidadeDePassageiros: f.capacidadeDePassageiros,
    tipoMontagem: f.tipoMontagem,
    quantidadeDeEixos: f.quantidadeDeEixos,
    carroceria: f.carroceria,
    codigoFipe: f.codigoFipe,
    descricao: f.descricao,
    valor: f.valor,
  };
}

// Outer gate — only renders the inner modal when open. Unmounting on close
// makes the inner component's state-reset trivial (no setState-in-effect).
export function AddCarModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;
  return <ModalInner onClose={onClose} />;
}

function ModalInner({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const helperId = useId();
  const placaRef = useRef<HTMLInputElement>(null);
  const chassiRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const [placa, setPlaca] = useState("");
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  /** Form snapshot of the LAST successful autofill — used to detect manual edits. */
  const [lastAutofill, setLastAutofill] = useState<FormState | null>(null);
  /** Fields that were just autofilled — drives the amber-flash class. */
  const [recentlyAutofilled, setRecentlyAutofilled] = useState<Set<keyof FormState>>(new Set());
  const [showOverwriteBanner, setShowOverwriteBanner] = useState(false);
  const [pendingNewPayload, setPendingNewPayload] = useState<VehiclePayload | null>(null);

  const [lookupStatus, setLookupStatus] = useState<"idle" | "loading" | "ok" | "err">("idle");
  const [lookupErr, setLookupErr] = useState<string | null>(null);
  const [duplicate, setDuplicate] = useState<{ id: string; placa: string; criado_em: string } | null>(null);
  const [submitting, startSubmit] = useTransition();
  const [submitErr, setSubmitErr] = useState<string | null>(null);

  const normalized = useMemo(() => normalizePlaca(placa), [placa]);
  const validFormat = useMemo(() => isValidPlaca(normalized), [normalized]);

  // Focus placa on mount; abort any pending lookup on unmount.
  useEffect(() => {
    placaRef.current?.focus();
    const ac = abortRef;
    return () => ac.current?.abort();
  }, []);

  // Briefly tag fields as "recently autofilled" so the amber flash kicks in.
  useEffect(() => {
    if (recentlyAutofilled.size === 0) return;
    const t = setTimeout(() => setRecentlyAutofilled(new Set()), 700);
    return () => clearTimeout(t);
  }, [recentlyAutofilled]);

  function applyPayload(p: VehiclePayload) {
    const next = payloadToForm(p);
    setForm(next);
    setLastAutofill(next);
    setRecentlyAutofilled(new Set(Object.keys(next) as Array<keyof FormState>));
    setTimeout(() => chassiRef.current?.focus(), 80);
  }

  function hasManualEdits(): boolean {
    if (!lastAutofill) return false;
    return (Object.keys(lastAutofill) as Array<keyof FormState>).some(
      (k) => (form[k] || "") !== (lastAutofill[k] || ""),
    );
  }

  const runLookup = useCallback(async () => {
    if (!validFormat) {
      setLookupStatus("err");
      setLookupErr("Placa inválida. Use 7 caracteres (ex.: ABC1D23 ou ABC1234).");
      return;
    }
    // Cancel any in-flight previous lookup so the latest plate wins.
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    setLookupStatus("loading");
    setLookupErr(null);
    setDuplicate(null);

    try {
      const res = await lookupPlaca(normalized);
      if (ac.signal.aborted) return;
      if (!res.ok) {
        setLookupStatus("err");
        setLookupErr(res.error);
        return;
      }
      setDuplicate(res.duplicate);
      setLookupStatus("ok");

      // Re-trigger guard: if other fields have been touched since the last
      // autofill, defer the apply until the operator confirms.
      if (lastAutofill && hasManualEdits()) {
        setPendingNewPayload(res.payload);
        setShowOverwriteBanner(true);
      } else {
        applyPayload(res.payload);
      }
    } catch (err) {
      if (ac.signal.aborted) return;
      setLookupStatus("err");
      setLookupErr((err as Error).message || "Falha inesperada.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [normalized, validFormat, lastAutofill, form]);

  function onPlacaKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Enter") return;
    e.preventDefault(); // never submit the form via Enter on placa
    runLookup();
  }

  function onPlacaChange(v: string) {
    // Strip hyphens / whitespace on the fly. Never render them back.
    const normalised = normalizePlaca(v).slice(0, 7);
    setPlaca(normalised);
    if (lookupStatus === "err") setLookupErr(null);
  }

  function setField<K extends keyof FormState>(k: K, v: FormState[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validFormat) {
      setSubmitErr("Informe uma placa válida antes de cadastrar.");
      return;
    }
    setSubmitErr(null);
    startSubmit(async () => {
      const res = await insertCarro(normalized, formToPayload(normalized, form));
      if (!res.ok) {
        setSubmitErr(res.error);
        return;
      }
      onClose();
      router.push(`/carros-ativos?novo=${encodeURIComponent(normalized)}`);
      router.refresh();
    });
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 bg-black/65 backdrop-blur-sm flex items-start justify-center overflow-y-auto py-8 px-4">
      <div className="surface modal-pop w-full max-w-4xl">
        <header className="flex items-center justify-between px-7 py-4 border-b border-[var(--border)]">
          <div className="flex items-center gap-3">
            <span className="block w-1 h-5 bg-[var(--accent)]" />
            <h2 className="font-display uppercase tracking-[0.16em] text-[var(--fg-strong)] text-base">
              Adicionar Veículo
            </h2>
          </div>
          <button onClick={onClose} className="btn-ghost text-xl leading-none px-2">×</button>
        </header>

        <form onSubmit={handleSubmit} className="px-7 py-6 space-y-7">
          {/* Hero block — the placa input is the headline element. Bigger,
              louder, monospace + plate-readout styling, with a hot orange
              focus ring. The helper line below describes the trigger. */}
          <section>
            <label className="block font-display uppercase tracking-[0.18em] text-xs text-[var(--accent)] mb-2">
              Placa <span className="text-[var(--accent-hot)]">●</span>
            </label>
            <div className="relative">
              <input
                ref={placaRef}
                value={placa}
                onChange={(e) => onPlacaChange(e.target.value)}
                onKeyDown={onPlacaKeyDown}
                aria-describedby={helperId}
                aria-invalid={lookupStatus === "err"}
                disabled={lookupStatus === "loading"}
                placeholder="ABC1D23"
                inputMode="text"
                autoComplete="off"
                maxLength={7}
                className={`input plate-readout text-3xl py-3 px-4 w-72 ${
                  lookupStatus === "err"
                    ? "border-[var(--danger)]"
                    : lookupStatus === "ok"
                    ? "border-[var(--success)]"
                    : ""
                }`}
                style={{ textTransform: "uppercase" }}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 inline-flex items-center">
                {lookupStatus === "loading" && <Spinner />}
                {lookupStatus === "ok" && <Check />}
              </span>
            </div>
            <p id={helperId} className="text-sm text-[var(--fg-muted)] mt-2">
              Digite a placa e pressione <kbd className="px-1.5 py-0.5 rounded border border-[var(--border)] bg-[var(--bg-elev-2)] font-mono text-xs text-[var(--fg)]">Enter</kbd> para preencher automaticamente.
            </p>
            {lookupErr && (
              <p className="text-sm mt-2 px-3 py-2 rounded border border-[var(--danger)]/50 bg-[var(--danger)]/10 text-[var(--danger)]">
                {lookupErr}{" "}
                <button type="button" onClick={runLookup} className="underline hover:text-[var(--fg)]">
                  Tentar novamente
                </button>
              </p>
            )}
            {duplicate && (
              <p className="text-sm mt-2 px-3 py-2 rounded border border-[var(--accent)]/40 bg-[var(--accent)]/8 text-[var(--fg)]">
                Veículo <span className="plate-tag mx-1">{duplicate.placa}</span> já cadastrado em {new Date(duplicate.criado_em).toLocaleString("pt-BR")}.{" "}
                <Link href={`/carros-ativos?placa=${encodeURIComponent(duplicate.placa)}`} className="underline text-[var(--accent)]">
                  Ver registro existente
                </Link>
              </p>
            )}
            {showOverwriteBanner && pendingNewPayload && (
              <div className="text-sm mt-2 px-3 py-2 rounded border border-[var(--accent)]/40 bg-[var(--accent)]/8 flex items-center justify-between gap-3">
                <span className="text-[var(--fg)]">Placa alterada. Substituir os outros campos com os novos dados?</span>
                <span className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      applyPayload(pendingNewPayload);
                      setPendingNewPayload(null);
                      setShowOverwriteBanner(false);
                    }}
                    className="btn-primary text-xs px-2 py-1"
                  >
                    Substituir
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPendingNewPayload(null);
                      setShowOverwriteBanner(false);
                    }}
                    className="btn-ghost text-xs"
                  >
                    Manter
                  </button>
                </span>
              </div>
            )}
          </section>

          {/* Field sections — display-font headings as section dividers */}
          {SECTIONS.filter((s) => s.id !== "id" || true).map((sec) => {
            const fields = FIELDS.filter((f) => f.section === sec.id);
            if (fields.length === 0) return null;
            return (
              <section key={sec.id}>
                <h3 className="font-display uppercase tracking-[0.18em] text-[10px] text-[var(--fg-muted)] mb-3 flex items-center gap-2">
                  <span className="block h-px bg-[var(--border)] flex-1 max-w-12" />
                  {sec.title}
                  <span className="block h-px bg-[var(--border)] flex-1" />
                </h3>
                <div className="grid grid-cols-6 gap-3">
                  {fields.map((f) => (
                    <FieldInput
                      key={f.key}
                      field={f}
                      value={form[f.key]}
                      onChange={(v) => setField(f.key, v)}
                      flash={recentlyAutofilled.has(f.key)}
                      inputRef={f.key === "chassi" ? chassiRef : undefined}
                    />
                  ))}
                </div>
              </section>
            );
          })}

          {/* Footer */}
          <footer className="flex items-center justify-between pt-5 border-t border-[var(--border)]">
            <p className="text-xs text-[var(--fg-muted)]">
              {lookupStatus === "ok" && parseValorFipe(form.valor) != null
                ? <>FIPE: <span className="font-mono text-[var(--fg)]">{new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(parseValorFipe(form.valor)!)}</span></>
                : "Todos os campos podem ser editados antes de salvar."}
            </p>
            <div className="flex items-center gap-2">
              {submitErr && <span className="text-xs text-[var(--danger)] mr-2">{submitErr}</span>}
              <button
                type="button"
                onClick={onClose}
                className="btn-ghost text-sm"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={submitting || !validFormat}
                className="btn-primary text-sm"
              >
                {submitting ? "Salvando…" : "Cadastrar veículo"}
              </button>
            </div>
          </footer>
        </form>
      </div>
    </div>
  );
}

function FieldInput({
  field,
  value,
  onChange,
  flash,
  inputRef,
}: {
  field: Field;
  value: string;
  onChange: (v: string) => void;
  flash: boolean;
  inputRef?: React.RefObject<HTMLInputElement | null>;
}) {
  const colSpan = field.width === "full" ? "col-span-6" : field.width === "half" ? "col-span-3" : "col-span-2";
  return (
    <div className={colSpan}>
      <label className="block text-[10px] uppercase tracking-[0.14em] text-[var(--fg-muted)] mb-1">{field.label}</label>
      <input
        ref={inputRef}
        type={field.type === "number" ? "number" : "text"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`input ${flash ? "flash-once" : ""}`}
      />
    </div>
  );
}

function Spinner() {
  return (
    <svg className="spin h-5 w-5 text-[var(--accent)]" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.2" strokeWidth="3" />
      <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
function Check() {
  return (
    <svg className="h-5 w-5 text-[var(--success)]" viewBox="0 0 20 20" fill="currentColor">
      <path
        fillRule="evenodd"
        d="M16.704 5.29a1 1 0 010 1.42l-7.5 7.5a1 1 0 01-1.42 0l-3.5-3.5a1 1 0 011.42-1.42L8.5 12.08l6.79-6.79a1 1 0 011.414 0z"
        clipRule="evenodd"
      />
    </svg>
  );
}
