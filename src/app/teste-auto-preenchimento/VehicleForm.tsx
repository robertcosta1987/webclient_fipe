"use client";

import { useRef, useState, useTransition } from "react";
import { normalizePlaca, isValidPlaca } from "@/lib/placa/normalize";
import { Plate } from "@/components/Plate";
import { autoFillPlate, saveVehicle, removeVehicle } from "./actions";
import type { VehicleInput } from "@/lib/db/testVehicles";

type Pt = { mes: number; ano: number; valor: number };

type Field = keyof FormState;
type FormState = {
  marca: string; modelo: string; versao: string; anoFabModelo: string;
  chassi: string; numMotor: string; combustivel: string; corVeiculo: string; tipoVeiculo: string;
  especieVeiculo: string; nacional: string; potencia: string; cilindradas: string; eixos: string;
  capMaxTracao: string; capacidadePassageiro: string; caixaCambio: string; numCarroceria: string;
  codigoFipe: string; fipeId: string; valorAtual: string;
};

const EMPTY: FormState = {
  marca: "", modelo: "", versao: "", anoFabModelo: "", chassi: "", numMotor: "",
  combustivel: "", corVeiculo: "", tipoVeiculo: "", especieVeiculo: "", nacional: "", potencia: "",
  cilindradas: "", eixos: "", capMaxTracao: "", capacidadePassageiro: "", caixaCambio: "",
  numCarroceria: "", codigoFipe: "", fipeId: "", valorAtual: "",
};

const SECTIONS: { title: string; fields: { key: Field; label: string; wide?: boolean }[] }[] = [
  { title: "Identificação", fields: [
    { key: "marca", label: "Marca" },
    { key: "modelo", label: "Modelo (Marca + Versão)", wide: true },
    { key: "versao", label: "Versão", wide: true },
    { key: "anoFabModelo", label: "Ano Fab/Modelo" },
    { key: "chassi", label: "Chassi" }, { key: "numMotor", label: "Nº do motor" },
    { key: "combustivel", label: "Combustível" }, { key: "corVeiculo", label: "Cor" },
    { key: "tipoVeiculo", label: "Tipo" }, { key: "especieVeiculo", label: "Espécie" },
    { key: "nacional", label: "Origem" },
  ] },
  { title: "Ficha técnica", fields: [
    { key: "potencia", label: "Potência (cv)" }, { key: "cilindradas", label: "Cilindradas (cc)" },
    { key: "eixos", label: "Eixos" }, { key: "capMaxTracao", label: "Cap. máx. tração" },
    { key: "capacidadePassageiro", label: "Passageiros" }, { key: "caixaCambio", label: "Caixa de câmbio" },
    { key: "numCarroceria", label: "Nº carroceria" },
  ] },
  { title: "FIPE", fields: [
    { key: "codigoFipe", label: "Código FIPE" }, { key: "fipeId", label: "FIPE ID" },
    { key: "valorAtual", label: "Valor FIPE (R$)" },
  ] },
];

const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

export function VehicleForm() {
  const [placa, setPlaca] = useState("");
  const [form, setForm] = useState<FormState>(EMPTY);
  const [historico, setHistorico] = useState<Pt[]>([]);
  const [photos, setPhotos] = useState<{ url: string; name: string }[]>([]);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [filling, startFill] = useTransition();
  const [saving, startSave] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);
  const lastFetched = useRef<string>("");

  const placaNorm = normalizePlaca(placa);
  const placaOk = isValidPlaca(placaNorm);
  const set = (k: Field, v: string) => setForm((f) => ({ ...f, [k]: v }));

  function triggerAutofill() {
    if (!placaOk || filling || locked) return;
    if (placaNorm === lastFetched.current) return; // avoid duplicate Tab+Enter calls
    lastFetched.current = placaNorm;
    setMsg(null);
    startFill(async () => {
      const r = await autoFillPlate(placaNorm);
      if (!r.ok) { setMsg({ ok: false, text: r.error }); return; }
      const d = r.fipe;
      const U = (v: string | null | undefined) => (v ?? "").toUpperCase(); // ALL fields in CAPITAL
      const anos = [d.anoFabricacao, d.anoModelo].filter(Boolean).join("/"); // "2023/2024"
      setForm({
        marca: U(d.marca),
        modelo: U([d.marca, d.versao].filter(Boolean).join(" ")), // Modelo = Marca + Versão
        versao: U(d.versao),
        anoFabModelo: anos,
        chassi: U(d.chassi),
        numMotor: U(d.numMotor), combustivel: U(d.combustivel), corVeiculo: U(d.corVeiculo),
        tipoVeiculo: U(d.tipoVeiculo), especieVeiculo: U(d.especieVeiculo), nacional: U(d.nacional),
        potencia: U(d.potencia), cilindradas: U(d.cilindradas), eixos: U(d.eixos),
        capMaxTracao: U(d.capMaxTracao), capacidadePassageiro: U(d.capacidadePassageiro),
        caixaCambio: U(d.caixaCambio), numCarroceria: U(d.numCarroceria),
        codigoFipe: U(d.codigoFipe), fipeId: U(d.fipeId),
        valorAtual: d.valorAtual != null ? String(d.valorAtual) : "",
      });
      setHistorico(Array.isArray(d.historico) ? d.historico : []);
      setMsg({ ok: true, text: `Preenchido pela placa ${r.placa} (${r.source === "cache" ? "cache" : "consulta nova"}).` });
    });
  }

  function toInput(): VehicleInput {
    const s = (v: string) => { const t = v.trim(); return t === "" ? null : t; };
    const valor = form.valorAtual.replace(/[^\d,.-]/g, "").replace(/\.(?=\d{3}\b)/g, "").replace(",", ".");
    const [anoFab, anoMod] = form.anoFabModelo.split("/").map((x) => x.trim());
    return {
      placa: placaNorm || null, marca: s(form.marca), modelo: s(form.modelo), versao: s(form.versao),
      anoFabricacao: s(anoFab ?? ""), anoModelo: s(anoMod ?? anoFab ?? ""), chassi: s(form.chassi),
      numMotor: s(form.numMotor), combustivel: s(form.combustivel), corVeiculo: s(form.corVeiculo),
      tipoVeiculo: s(form.tipoVeiculo), especieVeiculo: s(form.especieVeiculo), nacional: s(form.nacional),
      potencia: s(form.potencia), cilindradas: s(form.cilindradas), eixos: s(form.eixos),
      capMaxTracao: s(form.capMaxTracao), capacidadePassageiro: s(form.capacidadePassageiro),
      caixaCambio: s(form.caixaCambio), numCarroceria: s(form.numCarroceria), codigoFipe: s(form.codigoFipe),
      fipeId: s(form.fipeId), versaoFipe: null,
      valorAtual: valor && Number.isFinite(Number(valor)) ? Number(valor) : null,
      photoCount: photos.length,
    };
  }

  function onSave() {
    setMsg(null);
    startSave(async () => {
      const r = await saveVehicle(toInput(), savedId);
      if (!r.ok) { setMsg({ ok: false, text: r.error }); return; }
      setSavedId(r.id); setLocked(true);
      setMsg({ ok: true, text: "Veículo salvo." });
    });
  }

  function onDelete() {
    if (!savedId) { resetAll(); return; }
    if (!window.confirm("Apagar este veículo?")) return;
    setMsg(null);
    startSave(async () => {
      const r = await removeVehicle(savedId);
      if (!r.ok) { setMsg({ ok: false, text: r.error ?? "Erro ao apagar." }); return; }
      resetAll();
      setMsg({ ok: true, text: "Veículo apagado." });
    });
  }

  function resetAll() {
    setPlaca(""); setForm(EMPTY); setHistorico([]); setPhotos([]); setSavedId(null); setLocked(false);
    lastFetched.current = "";
  }

  function addPhotos(files: FileList | null) {
    if (!files) return;
    const next = Array.from(files).filter((f) => f.type.startsWith("image/")).map((f) => ({ url: URL.createObjectURL(f), name: f.name }));
    setPhotos((p) => [...p, ...next]);
  }

  const disabled = locked || saving;

  return (
    <div className="space-y-6">
      {/* Placa + autofill */}
      <div className="surface p-4 flex flex-wrap items-end gap-4 rise rise-d3">
        <div className="flex-1 min-w-[14rem]">
          <label htmlFor="tap-placa" className="block text-[10px] uppercase tracking-[0.16em] text-[var(--fg-muted)] mb-1">Placa</label>
          <input
            id="tap-placa" value={placa} disabled={locked}
            onChange={(e) => setPlaca(e.target.value.toUpperCase())}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); triggerAutofill(); } }}
            onBlur={triggerAutofill}
            placeholder="ABC1D23" autoComplete="off" maxLength={8}
            className="input font-mono tracking-[0.18em] uppercase"
          />
        </div>
        {placaOk && <Plate placa={placaNorm} size="lg" />}
        <div className="text-[12px] text-[var(--fg-muted)] min-w-[12rem]">
          {filling ? "Buscando dados pela placa…" : "Digite a placa e pressione Tab ou Enter."}
        </div>
      </div>

      {msg && (
        <p className="text-[13px]" style={{ color: msg.ok ? "var(--success)" : "var(--danger)" }}>{msg.text}</p>
      )}

      {/* Field sections */}
      {SECTIONS.map((sec) => (
        <section key={sec.title} className="surface p-5">
          <h2 className="font-display uppercase tracking-[0.16em] text-sm text-[var(--accent)] mb-4">{sec.title}</h2>
          <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
            {sec.fields.map((f) => (
              <div key={f.key} className={f.wide ? "sm:col-span-2 lg:col-span-3" : ""}>
                <label htmlFor={`tap-${f.key}`} className="block text-[10px] uppercase tracking-[0.16em] text-[var(--fg-muted)] mb-1">{f.label}</label>
                <input
                  id={`tap-${f.key}`} value={form[f.key]} disabled={disabled}
                  onChange={(e) => set(f.key, f.key === "valorAtual" ? e.target.value : e.target.value.toUpperCase())}
                  className="input" style={{ textTransform: "uppercase" }}
                />
                {f.key === "valorAtual" && form.valorAtual && Number.isFinite(Number(form.valorAtual)) && (
                  <span className="block mt-1 text-[11px] text-[var(--fg-faint)]">{BRL.format(Number(form.valorAtual))}</span>
                )}
              </div>
            ))}
          </div>
          {sec.title === "FIPE" && historico.length >= 2 && (
            <div className="mt-5 pt-4 border-t" style={{ borderColor: "var(--hairline)" }}>
              <div className="text-[10px] uppercase tracking-[0.16em] text-[var(--fg-muted)] mb-2">Histórico FIPE · 12 meses</div>
              <FipeChart points={historico.slice(-12)} />
            </div>
          )}
        </section>
      ))}

      {/* Fotos */}
      <section className="surface p-5">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-3">
          <h2 className="font-display uppercase tracking-[0.16em] text-sm text-[var(--accent)]">Fotos do veículo</h2>
          <button type="button" onClick={() => fileRef.current?.click()} disabled={disabled} className="btn-ghost text-sm">+ Adicionar Fotos</button>
          <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => { addPhotos(e.target.files); e.target.value = ""; }} />
        </div>
        {photos.length === 0 ? (
          <p className="text-[12px] text-[var(--fg-faint)]">Nenhuma foto adicionada.</p>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-3">
            {photos.map((ph, i) => (
              <div key={i} className="relative group">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={ph.url} alt={ph.name} className="w-full h-24 object-cover rounded-md border" style={{ borderColor: "var(--hairline)" }} />
                {!locked && (
                  <button type="button" onClick={() => setPhotos((p) => p.filter((_, j) => j !== i))}
                    className="absolute top-1 right-1 w-6 h-6 rounded-full text-[12px] leading-none"
                    style={{ background: "rgba(0,0,0,0.6)", color: "#fff" }} aria-label="Remover foto">×</button>
                )}
              </div>
            ))}
          </div>
        )}
        <p className="mt-2 text-[11px] text-[var(--fg-faint)]">As fotos ficam no navegador (pré-visualização). O armazenamento permanente será habilitado em breve.</p>
      </section>

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-3 pt-1">
        {!locked && (
          <button type="button" onClick={onSave} disabled={saving} className="btn-primary">
            {saving ? "Salvando…" : "SALVAR"}
          </button>
        )}
        {locked && (
          <button type="button" onClick={() => setLocked(false)} className="btn-primary">EDITAR</button>
        )}
        <button type="button" onClick={onDelete} disabled={saving} className="btn-ghost" style={{ borderColor: "rgba(248,113,113,0.5)", color: "#f87171" }}>APAGAR</button>

        {/* Gerar Anúncio — em breve */}
        <div className="relative inline-block">
          <span className="absolute -top-2 left-1/2 -translate-x-1/2 z-10 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wide whitespace-nowrap"
            style={{ background: "var(--accent)", color: "#06070d" }}>Em breve</span>
          <button type="button" disabled aria-disabled className="btn-ghost opacity-60 cursor-not-allowed">Gerar Anúncio</button>
        </div>

        {savedId && <span className="text-[12px] text-[var(--fg-faint)]">Salvo · <span className="font-mono">{savedId.slice(0, 8)}</span></span>}
      </div>
    </div>
  );
}

const BRL0 = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const ml = (p: Pt) => `${String(p.mes).padStart(2, "0")}/${String(p.ano).slice(2)}`;

/** Compact FIPE price line chart (last 12 months). */
function FipeChart({ points }: { points: Pt[] }) {
  if (points.length < 2) return null;
  const W = 520, H = 150, PADL = 8, PADR = 8, PADT = 8, PADB = 20;
  const vals = points.map((p) => p.valor);
  const min = Math.min(...vals), max = Math.max(...vals), range = max - min || 1;
  const iw = W - PADL - PADR, ih = H - PADT - PADB;
  const X = (i: number) => PADL + (i / (points.length - 1)) * iw;
  const Y = (v: number) => PADT + ih - ((v - min) / range) * ih;
  const line = points.map((p, i) => `${X(i).toFixed(1)},${Y(p.valor).toFixed(1)}`).join(" ");
  const area = `${X(0).toFixed(1)},${(PADT + ih).toFixed(1)} ${line} ${X(points.length - 1).toFixed(1)},${(PADT + ih).toFixed(1)}`;
  const first = points[0], last = points[points.length - 1];
  const delta = last.valor - first.valor, pct = first.valor ? (delta / first.valor) * 100 : 0, up = delta >= 0;
  const accent = "var(--accent)";
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1">
        <span className="text-[13px] font-semibold text-[var(--fg-strong)]">{BRL0.format(last.valor)} <span className="text-[10px] font-normal text-[var(--fg-muted)]">atual ({ml(last)})</span></span>
        <span className="text-[11px] font-semibold" style={{ color: up ? "var(--success)" : "var(--danger)" }}>{up ? "▲" : "▼"} {Math.abs(pct).toFixed(1).replace(".", ",")}%</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" preserveAspectRatio="none" style={{ height: 130 }}>
        <polygon points={area} fill={accent} opacity="0.13" />
        <polyline points={line} fill="none" stroke={accent} strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" />
        {points.map((p, i) => <circle key={i} cx={X(i)} cy={Y(p.valor)} r={i === points.length - 1 ? 3 : 1.4} fill={accent} />)}
        <text x={PADL} y={Y(max) - 2} fontSize="8" fill="var(--fg-muted)">{BRL0.format(max)}</text>
        <text x={PADL} y={Y(min) + 9} fontSize="8" fill="var(--fg-muted)">{BRL0.format(min)}</text>
        <text x={X(0)} y={H - 4} fontSize="8" fill="var(--fg-muted)" textAnchor="start">{ml(first)}</text>
        <text x={X(points.length - 1)} y={H - 4} fontSize="8" fill="var(--fg-muted)" textAnchor="end">{ml(last)}</text>
      </svg>
    </div>
  );
}
