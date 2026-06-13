"use client";

import { useRef, useState, useTransition } from "react";
import { normalizePlaca, isValidPlaca } from "@/lib/placa/normalize";
import { Plate } from "@/components/Plate";
import { autoFillPlate, saveVehicle, removeVehicle } from "./actions";
import type { VehicleInput } from "@/lib/db/testVehicles";

type Field = keyof FormState;
type FormState = {
  marca: string; modelo: string; versao: string; anoModelo: string; anoFabricacao: string;
  chassi: string; numMotor: string; combustivel: string; corVeiculo: string; tipoVeiculo: string;
  especieVeiculo: string; nacional: string; potencia: string; cilindradas: string; eixos: string;
  capMaxTracao: string; capacidadePassageiro: string; caixaCambio: string; numCarroceria: string;
  codigoFipe: string; fipeId: string; versaoFipe: string; valorAtual: string;
};

const EMPTY: FormState = {
  marca: "", modelo: "", versao: "", anoModelo: "", anoFabricacao: "", chassi: "", numMotor: "",
  combustivel: "", corVeiculo: "", tipoVeiculo: "", especieVeiculo: "", nacional: "", potencia: "",
  cilindradas: "", eixos: "", capMaxTracao: "", capacidadePassageiro: "", caixaCambio: "",
  numCarroceria: "", codigoFipe: "", fipeId: "", versaoFipe: "", valorAtual: "",
};

const SECTIONS: { title: string; fields: { key: Field; label: string; wide?: boolean }[] }[] = [
  { title: "Identificação", fields: [
    { key: "marca", label: "Marca" }, { key: "modelo", label: "Modelo" },
    { key: "versao", label: "Versão (completa)", wide: true },
    { key: "anoModelo", label: "Ano modelo" }, { key: "anoFabricacao", label: "Ano fabricação" },
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
    { key: "versaoFipe", label: "Versão FIPE", wide: true }, { key: "valorAtual", label: "Valor FIPE (R$)" },
  ] },
];

const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

export function VehicleForm() {
  const [placa, setPlaca] = useState("");
  const [form, setForm] = useState<FormState>(EMPTY);
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
      setForm({
        marca: d.marca ?? "", modelo: d.modelo ?? "", versao: d.versao ?? "",
        anoModelo: d.anoModelo ?? "", anoFabricacao: d.anoFabricacao ?? "", chassi: d.chassi ?? "",
        numMotor: d.numMotor ?? "", combustivel: d.combustivel ?? "", corVeiculo: d.corVeiculo ?? "",
        tipoVeiculo: d.tipoVeiculo ?? "", especieVeiculo: d.especieVeiculo ?? "", nacional: d.nacional ?? "",
        potencia: d.potencia ?? "", cilindradas: d.cilindradas ?? "", eixos: d.eixos ?? "",
        capMaxTracao: d.capMaxTracao ?? "", capacidadePassageiro: d.capacidadePassageiro ?? "",
        caixaCambio: d.caixaCambio ?? "", numCarroceria: d.numCarroceria ?? "",
        codigoFipe: d.codigoFipe ?? "", fipeId: d.fipeId ?? "", versaoFipe: d.versaoFipe ?? "",
        valorAtual: d.valorAtual != null ? String(d.valorAtual) : "",
      });
      setMsg({ ok: true, text: `Preenchido pela placa ${r.placa} (${r.source === "cache" ? "cache" : "consulta nova"}).` });
    });
  }

  function toInput(): VehicleInput {
    const s = (v: string) => { const t = v.trim(); return t === "" ? null : t; };
    const valor = form.valorAtual.replace(/[^\d,.-]/g, "").replace(/\.(?=\d{3}\b)/g, "").replace(",", ".");
    return {
      placa: placaNorm || null, marca: s(form.marca), modelo: s(form.modelo), versao: s(form.versao),
      anoModelo: s(form.anoModelo), anoFabricacao: s(form.anoFabricacao), chassi: s(form.chassi),
      numMotor: s(form.numMotor), combustivel: s(form.combustivel), corVeiculo: s(form.corVeiculo),
      tipoVeiculo: s(form.tipoVeiculo), especieVeiculo: s(form.especieVeiculo), nacional: s(form.nacional),
      potencia: s(form.potencia), cilindradas: s(form.cilindradas), eixos: s(form.eixos),
      capMaxTracao: s(form.capMaxTracao), capacidadePassageiro: s(form.capacidadePassageiro),
      caixaCambio: s(form.caixaCambio), numCarroceria: s(form.numCarroceria), codigoFipe: s(form.codigoFipe),
      fipeId: s(form.fipeId), versaoFipe: s(form.versaoFipe),
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
    setPlaca(""); setForm(EMPTY); setPhotos([]); setSavedId(null); setLocked(false);
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
                  onChange={(e) => set(f.key, e.target.value)}
                  className="input"
                />
                {f.key === "valorAtual" && form.valorAtual && Number.isFinite(Number(form.valorAtual)) && (
                  <span className="block mt-1 text-[11px] text-[var(--fg-faint)]">{BRL.format(Number(form.valorAtual))}</span>
                )}
              </div>
            ))}
          </div>
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
