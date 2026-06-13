"use client";

import { useRef, useState, useTransition } from "react";
import { normalizePlaca, isValidPlaca } from "@/lib/placa/normalize";
import { Plate } from "@/components/Plate";
import { autoFillPlate, saveVehicle, removeVehicle } from "./actions";
import { gerarAnuncio, publishAnuncio } from "./anuncio";
import type { Anuncio } from "@/lib/anuncio/types";
import type { VehicleInput } from "@/lib/db/testVehicles";

// Telefone de contato no anúncio — placeholder até vir do cliente.
const CONTACT_PHONE = "5511900000000";
const CONTACT_PHONE_LABEL = "+55 (11) 90000-0000";

type Pt = { mes: number; ano: number; valor: number };

type Field = keyof FormState;
type FormState = {
  marca: string; modelo: string; versao: string; anoFabricacao: string; anoModelo: string;
  chassi: string; numMotor: string; combustivel: string; corVeiculo: string; tipoVeiculo: string;
  especieVeiculo: string; procedencia: string; municipio: string; potencia: string; cilindradas: string; eixos: string;
  pbtKg: string; capMaxTracao: string; capacidadePassageiro: string; caixaCambio: string; numCarroceria: string;
  codigoFipe: string; fipeId: string; valorAtual: string;
};

const EMPTY: FormState = {
  marca: "", modelo: "", versao: "", anoFabricacao: "", anoModelo: "", chassi: "", numMotor: "",
  combustivel: "", corVeiculo: "", tipoVeiculo: "", especieVeiculo: "", procedencia: "", municipio: "", potencia: "",
  cilindradas: "", eixos: "", pbtKg: "", capMaxTracao: "", capacidadePassageiro: "", caixaCambio: "",
  numCarroceria: "", codigoFipe: "", fipeId: "", valorAtual: "",
};

const SECTIONS: { title: string; fields: { key: Field; label: string; wide?: boolean; years?: boolean; select?: string[] }[] }[] = [
  { title: "Identificação", fields: [
    { key: "marca", label: "Marca" },
    { key: "modelo", label: "Modelo (Modelo + Versão)", wide: true },
    { key: "versao", label: "Versão", wide: true },
    { key: "anoFabricacao", label: "Ano Fab / Modelo", years: true },
    { key: "chassi", label: "Chassi" }, { key: "numMotor", label: "Nº do motor" },
    { key: "combustivel", label: "Combustível" }, { key: "corVeiculo", label: "Cor" },
    { key: "tipoVeiculo", label: "Tipo" }, { key: "especieVeiculo", label: "Espécie" },
    { key: "procedencia", label: "Procedência", select: ["NACIONAL", "IMPORTADO"] },
    { key: "municipio", label: "Tarjeta do Município", wide: true },
  ] },
  { title: "Ficha técnica", fields: [
    { key: "potencia", label: "Potência (cv)" }, { key: "cilindradas", label: "Cilindradas (cc)" },
    { key: "eixos", label: "Eixos" }, { key: "pbtKg", label: "PBT (kg)" },
    { key: "capMaxTracao", label: "Cap. máx. tração" },
    { key: "capacidadePassageiro", label: "Passageiros" }, { key: "caixaCambio", label: "Caixa de câmbio" },
    { key: "numCarroceria", label: "Nº carroceria" },
  ] },
  { title: "FIPE", fields: [
    { key: "codigoFipe", label: "Código FIPE" }, { key: "fipeId", label: "FIPE ID" },
    { key: "valorAtual", label: "Valor FIPE (R$)" },
  ] },
];

const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

// PBT → kg. The vendor returns PBT in kg, but the 202 payload often gives it in
// tens of kg (e.g. 162 = 1.620 kg); values under 1000 are scaled ×10.
function pbtToKg(raw: string | null | undefined): string {
  if (!raw) return "";
  const n = Number(String(raw).replace(/[^\d.]/g, ""));
  if (!Number.isFinite(n) || n <= 0) return "";
  return String(n < 1000 ? Math.round(n * 10) : Math.round(n));
}

export function VehicleForm() {
  const [placa, setPlaca] = useState("");
  const [form, setForm] = useState<FormState>(EMPTY);
  const [historico, setHistorico] = useState<Pt[]>([]);
  const [processed, setProcessed] = useState<unknown>(null);
  const [raw, setRaw] = useState<unknown>(null);
  const [photos, setPhotos] = useState<{ dataUrl: string; name: string }[]>([]);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [filling, startFill] = useTransition();
  const [saving, startSave] = useTransition();
  const [anuncio, setAnuncio] = useState<Anuncio | null>(null);
  const [adErr, setAdErr] = useState<string | null>(null);
  const [genAd, startAd] = useTransition();
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [shareErr, setShareErr] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
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
      setForm({
        marca: U(d.marca),
        // Modelo = nome do modelo (FIPE, ex.: "COROLLA") + Versão
        modelo: U([d.modeloFipe || d.modelo, d.versao].filter(Boolean).join(" ")),
        versao: U(d.versao),
        anoFabricacao: U(d.anoFabricacao), anoModelo: U(d.anoModelo),
        chassi: U(d.chassi),
        numMotor: U(d.numMotor), combustivel: U(d.combustivel), corVeiculo: U(d.corVeiculo),
        tipoVeiculo: U(d.tipoVeiculo), especieVeiculo: U(d.especieVeiculo),
        procedencia: d.procedencia ?? "NACIONAL",
        municipio: U(d.municipio),
        potencia: U(d.potencia), cilindradas: U(d.cilindradas), eixos: U(d.eixos),
        pbtKg: pbtToKg(d.pbt),
        capMaxTracao: U(d.capMaxTracao), capacidadePassageiro: U(d.capacidadePassageiro),
        caixaCambio: U(d.caixaCambio), numCarroceria: U(d.numCarroceria),
        codigoFipe: U(d.codigoFipe), fipeId: U(d.fipeId),
        valorAtual: d.valorAtual != null ? String(d.valorAtual) : "",
      });
      setHistorico(Array.isArray(d.historico) ? d.historico : []);
      setProcessed({ placa: r.placa, source: r.source, fipe: r.fipe }); // saída entregue ao cliente (enriquecida)
      setRaw(r.raw ?? null);
      setMsg({ ok: true, text: `Preenchido pela placa ${r.placa} (${r.source === "cache" ? "cache" : "consulta nova"}).` });
    });
  }

  function toInput(): VehicleInput {
    const s = (v: string) => { const t = v.trim(); return t === "" ? null : t; };
    const valor = form.valorAtual.replace(/[^\d,.-]/g, "").replace(/\.(?=\d{3}\b)/g, "").replace(",", ".");
    return {
      placa: placaNorm || null, marca: s(form.marca), modelo: s(form.modelo), versao: s(form.versao),
      anoFabricacao: s(form.anoFabricacao), anoModelo: s(form.anoModelo), chassi: s(form.chassi),
      numMotor: s(form.numMotor), combustivel: s(form.combustivel), corVeiculo: s(form.corVeiculo),
      tipoVeiculo: s(form.tipoVeiculo), especieVeiculo: s(form.especieVeiculo), nacional: s(form.procedencia),
      potencia: s(form.potencia), cilindradas: s(form.cilindradas), eixos: s(form.eixos),
      capMaxTracao: s(form.capMaxTracao), capacidadePassageiro: s(form.capacidadePassageiro),
      caixaCambio: s(form.caixaCambio), numCarroceria: s(form.numCarroceria), codigoFipe: s(form.codigoFipe),
      fipeId: s(form.fipeId), versaoFipe: null,
      valorAtual: valor && Number.isFinite(Number(valor)) ? Number(valor) : null,
      photoCount: photos.length,
      photos: null, // URLs são preenchidas no servidor após o upload
    };
  }

  function onSave() {
    setMsg(null);
    startSave(async () => {
      const r = await saveVehicle(toInput(), photos.map((p) => p.dataUrl), savedId);
      if (!r.ok) { setMsg({ ok: false, text: r.error }); return; }
      setSavedId(r.id); setLocked(true);
      setMsg({ ok: true, text: `Veículo salvo${r.photoCount ? ` · ${r.photoCount} foto(s) enviada(s)` : ""}.` });
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
    setPlaca(""); setForm(EMPTY); setHistorico([]); setProcessed(null); setRaw(null); setPhotos([]); setAnuncio(null); setAdErr(null); setShareUrl(null); setShareErr(null); setSavedId(null); setLocked(false);
    lastFetched.current = "";
  }

  function addPhotos(files: FileList | null) {
    if (!files) return;
    // Resize + compress to keep payloads small (server-action body limit) and
    // embed as JPEG data URLs (work in the offer/PDF and upload on save).
    for (const f of Array.from(files)) {
      if (!f.type.startsWith("image/")) continue;
      const reader = new FileReader();
      reader.onload = () => {
        const src = String(reader.result);
        const img = new window.Image();
        img.onload = () => {
          const MAX = 1400;
          let { width, height } = img;
          if (width > MAX || height > MAX) { const s = MAX / Math.max(width, height); width = Math.round(width * s); height = Math.round(height * s); }
          const canvas = document.createElement("canvas");
          canvas.width = width; canvas.height = height;
          const ctx = canvas.getContext("2d");
          let dataUrl = src;
          if (ctx) { ctx.drawImage(img, 0, 0, width, height); try { dataUrl = canvas.toDataURL("image/jpeg", 0.82); } catch { /* keep original */ } }
          setPhotos((p) => [...p, { dataUrl, name: f.name }]);
        };
        img.onerror = () => setPhotos((p) => [...p, { dataUrl: src, name: f.name }]);
        img.src = src;
      };
      reader.readAsDataURL(f);
    }
  }

  function onGerarAnuncio() {
    if (photos.length === 0) { setAdErr("Adicione ao menos 1 foto do veículo para gerar o anúncio."); return; }
    setAdErr(null); setAnuncio(null); setShareUrl(null); setShareErr(null); setCopiedLink(false);
    startAd(async () => {
      const r = await gerarAnuncio({
        placa: placaNorm || null, marca: form.marca || null, modelo: form.modelo || null, versao: form.versao || null,
        anoFabricacao: form.anoFabricacao || null, anoModelo: form.anoModelo || null, corVeiculo: form.corVeiculo || null,
        combustivel: form.combustivel || null, potencia: form.potencia || null, cilindradas: form.cilindradas || null,
        caixaCambio: form.caixaCambio || null, municipio: form.municipio || null,
        valorFipe: form.valorAtual && Number.isFinite(Number(form.valorAtual)) ? Number(form.valorAtual) : null,
      });
      if (!r.ok) { setAdErr(r.error); return; }
      setAnuncio(r.anuncio);
      // Publish a shareable page (Azure static website) — non-fatal: a failure
      // here must never block the PDF/offer.
      try {
        const p = await publishAnuncio(buildAnuncioHtml(form, r.anuncio, photos, placaNorm, true));
        if (p.ok) setShareUrl(p.url); else setShareErr(p.error);
      } catch { setShareErr("Não foi possível publicar o link agora."); }
    });
  }

  function downloadAnuncioPdf() {
    if (!anuncio) return;
    const url = URL.createObjectURL(new Blob([buildAnuncioHtml(form, anuncio, photos, placaNorm)], { type: "text/html" }));
    const w = window.open(url, "_blank", "width=900,height=1000");
    if (!w) { URL.revokeObjectURL(url); window.alert("Permita pop-ups para baixar o PDF e tente novamente."); return; }
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }

  const copy = (t: string) => { navigator.clipboard?.writeText(t).catch(() => {}); };

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
                {f.years ? (
                  <div className="flex items-center gap-2">
                    <input
                      id="tap-anoFabricacao" value={form.anoFabricacao} disabled={disabled}
                      onChange={(e) => set("anoFabricacao", e.target.value.toUpperCase())}
                      className="input text-center" placeholder="ANO FAB" aria-label="Ano de fabricação"
                      style={{ textTransform: "uppercase" }}
                    />
                    <span className="text-[var(--fg-muted)] font-display">/</span>
                    <input
                      id="tap-anoModelo" value={form.anoModelo} disabled={disabled}
                      onChange={(e) => set("anoModelo", e.target.value.toUpperCase())}
                      className="input text-center" placeholder="ANO MODELO" aria-label="Ano do modelo"
                      style={{ textTransform: "uppercase" }}
                    />
                  </div>
                ) : f.select ? (
                  <select
                    id={`tap-${f.key}`} value={form[f.key]} disabled={disabled}
                    onChange={(e) => set(f.key, e.target.value)} className="input"
                  >
                    {f.select.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                  </select>
                ) : (
                  <input
                    id={`tap-${f.key}`} value={form[f.key]} disabled={disabled}
                    onChange={(e) => set(f.key, f.key === "valorAtual" ? e.target.value : e.target.value.toUpperCase())}
                    className="input" style={{ textTransform: "uppercase" }}
                  />
                )}
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
                <img src={ph.dataUrl} alt={ph.name} className="w-full h-24 object-cover rounded-md border" style={{ borderColor: "var(--hairline)" }} />
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

        <button type="button" onClick={onGerarAnuncio} disabled={genAd || photos.length === 0}
          title={photos.length === 0 ? "Adicione ao menos 1 foto" : undefined} className="btn-primary">
          {genAd ? "Gerando anúncio…" : "Gerar Anúncio"}
        </button>

        {savedId && <span className="text-[12px] text-[var(--fg-faint)]">Salvo · <span className="font-mono">{savedId.slice(0, 8)}</span></span>}
      </div>
      {adErr && <p className="text-[13px]" style={{ color: "var(--danger)" }}>{adErr}</p>}

      {/* Result JSON — processed (what the customer gets) + raw vendor payload */}
      {processed != null && (
        <details className="surface p-4" open>
          <summary className="cursor-pointer text-xs uppercase tracking-[0.18em] text-[var(--accent)] hover:text-[var(--fg)] select-none">
            Resultado — JSON entregue ao cliente (processado)
          </summary>
          <p className="mt-2 text-[11px] text-[var(--fg-faint)]">Saída final da API: códigos da tabela oficial (marca/combustível), Código FIPE formatado e cor enriquecida.</p>
          <div className="mt-2 flex justify-end">
            <button type="button" className="btn-ghost text-[11px]"
              onClick={() => { navigator.clipboard?.writeText(JSON.stringify(processed, null, 2)).catch(() => {}); }}>
              Copiar JSON
            </button>
          </div>
          <pre className="mt-2 max-h-[28rem] overflow-auto text-[11px] leading-snug text-[var(--fg)] font-mono whitespace-pre-wrap break-words">
{JSON.stringify(processed, null, 2)}
          </pre>
        </details>
      )}
      {raw != null && (
        <details className="surface p-4">
          <summary className="cursor-pointer text-xs uppercase tracking-[0.18em] text-[var(--fg-muted)] hover:text-[var(--fg)] select-none">
            JSON bruto do fornecedor (CheckTudo) — não processado
          </summary>
          <p className="mt-2 text-[11px] text-[var(--fg-faint)]">Payload original do fornecedor. Os códigos aqui são do fornecedor (ex.: codigoMarca) e NÃO são os da nossa tabela — use o JSON processado acima.</p>
          <div className="mt-2 flex justify-end">
            <button type="button" className="btn-ghost text-[11px]"
              onClick={() => { navigator.clipboard?.writeText(JSON.stringify(raw, null, 2)).catch(() => {}); }}>
              Copiar JSON
            </button>
          </div>
          <pre className="mt-2 max-h-[28rem] overflow-auto text-[11px] leading-snug text-[var(--fg)] font-mono whitespace-pre-wrap break-words">
{JSON.stringify(raw, null, 2)}
          </pre>
        </details>
      )}

      {/* Anúncio gerado (modal) */}
      {anuncio && (
        <div className="fixed inset-0 z-50 overflow-y-auto p-4" style={{ background: "rgba(0,0,0,0.6)" }}
          onClick={() => setAnuncio(null)} role="dialog" aria-modal="true">
          <div className="glass mx-auto my-4 max-w-3xl p-6 space-y-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="chip">Anúncio gerado por IA</span>
                <h2 className="font-display text-xl text-[var(--fg-strong)] mt-2">{anuncio.titulo}</h2>
                <p className="text-[13px] text-[var(--fg-muted)]">{anuncio.subtitulo}</p>
              </div>
              <button type="button" onClick={() => setAnuncio(null)} className="btn-ghost text-sm">Fechar</button>
            </div>

            {photos.length > 0 && (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {photos.map((ph, i) => <img key={i} src={ph.dataUrl} alt={ph.name} className="w-full h-20 object-cover rounded-md" />)}
              </div>
            )}

            <div>
              <h3 className="text-[11px] uppercase tracking-[0.14em] text-[var(--fg-muted)] mb-1">Destaques</h3>
              <ul className="list-disc pl-5 text-[13.5px] text-[var(--fg)] space-y-0.5">
                {anuncio.destaques.map((d, i) => <li key={i}>{d}</li>)}
              </ul>
            </div>

            <div>
              <h3 className="text-[11px] uppercase tracking-[0.14em] text-[var(--fg-muted)] mb-1">Descrição</h3>
              <p className="text-[13.5px] text-[var(--fg)] whitespace-pre-wrap">{anuncio.descricao}</p>
              <p className="text-[12.5px] text-[var(--fg-muted)] mt-2">{anuncio.precoTexto}</p>
              {anuncio.hashtags.length > 0 && <p className="text-[12px] text-[var(--accent)] mt-2">{anuncio.hashtags.join(" ")}</p>}
            </div>

            <div className="space-y-2">
              <h3 className="text-[11px] uppercase tracking-[0.14em] text-[var(--fg-muted)]">Copiar para portais</h3>
              {([["Webmotors", anuncio.portais.webmotors], ["OLX", anuncio.portais.olx], ["Redes sociais", anuncio.portais.social], ["WhatsApp", anuncio.portais.whatsapp]] as const).map(([label, txt]) => (
                <div key={label} className="surface p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[12px] font-semibold text-[var(--fg-strong)]">{label}</span>
                    <button type="button" onClick={() => copy(txt)} className="btn-ghost text-[11px]">Copiar</button>
                  </div>
                  <p className="text-[12.5px] text-[var(--fg)] whitespace-pre-wrap">{txt}</p>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-1">
              <button type="button" onClick={downloadAnuncioPdf} className="btn-primary">⬇ Baixar PDF</button>
              {shareUrl ? (
                <>
                  <a href={shareUrl} target="_blank" rel="noopener noreferrer" className="btn-ghost text-sm" style={{ borderColor: "var(--accent)", color: "var(--accent)" }}>🔗 Abrir link do anúncio</a>
                  <button type="button" onClick={() => { copy(shareUrl); setCopiedLink(true); }} className="btn-ghost text-sm">{copiedLink ? "Link copiado!" : "Copiar link"}</button>
                </>
              ) : shareErr ? (
                <span className="text-[12px]" style={{ color: "var(--danger)" }}>Link: {shareErr}</span>
              ) : (
                <span className="text-[12px] text-[var(--fg-faint)]">Publicando link compartilhável…</span>
              )}
              <a href={`https://wa.me/${CONTACT_PHONE}`} target="_blank" rel="noopener noreferrer" className="btn-ghost text-sm inline-flex items-center gap-1.5" style={{ borderColor: "rgba(37,211,102,0.55)" }}>
                Fale Conosco · {CONTACT_PHONE_LABEL}
              </a>
            </div>
            <p className="text-[11px] text-[var(--fg-faint)]">O telefone do botão Fale Conosco é um placeholder. Em breve: remoção de fundo das fotos e mockups.</p>
          </div>
        </div>
      )}
    </div>
  );
}

const BRL0 = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

/** Self-contained HTML for the generated ad. `web=true` → shareable page (no
 *  auto-print, with a Fale Conosco button); otherwise a printable PDF doc. */
function buildAnuncioHtml(form: FormState, a: Anuncio, photos: { dataUrl: string; name: string }[], placa: string, web = false): string {
  const esc = (s: string) => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c] as string));
  const imgs = photos.map((p) => `<img src="${p.dataUrl}" alt="">`).join("");
  const bullets = a.destaques.map((d) => `<li>${esc(d)}</li>`).join("");
  const cta = web
    ? `<a class="cta" href="https://wa.me/${CONTACT_PHONE}" target="_blank" rel="noopener">📞 Fale Conosco — ${CONTACT_PHONE_LABEL}</a>`
    : `<div class="contact"><strong>Fale Conosco:</strong> ${CONTACT_PHONE_LABEL} (placeholder)</div>`;
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(a.titulo)}</title>
<style>
  @page{size:A4;margin:14mm}*{box-sizing:border-box}
  body{font-family:-apple-system,"Segoe UI",Roboto,Arial,sans-serif;color:#1a2233;font-size:13px;line-height:1.5;margin:0;${web ? "background:#f4f7fc;padding:18px" : ""}}
  .wrap{${web ? "max-width:780px;margin:0 auto;background:#fff;border-radius:12px;padding:22px;box-shadow:0 10px 40px -20px rgba(16,24,40,.35)" : ""}}
  .bar{border-bottom:3px solid #1f6feb;padding-bottom:8px;margin-bottom:12px}
  .brand{font-weight:800;color:#1f6feb;font-size:16px}
  h1{font-size:22px;color:#0b2a4a;margin:6px 0 2px}.sub{color:#5a6b80}
  .grid{display:flex;flex-wrap:wrap;gap:6px;margin:10px 0}.grid img{width:32%;height:130px;object-fit:cover;border-radius:6px}
  h2{font-size:13px;color:#0b2a4a;border-bottom:1px solid #e4ebf3;padding-bottom:3px;margin:14px 0 6px}
  ul{margin:6px 0 6px 18px}.price{color:#0b2a4a;font-weight:600}.tags{color:#1f6feb;font-size:11px;margin-top:6px}
  .contact{margin-top:14px;padding:10px 12px;background:#eef6ff;border-left:4px solid #1f6feb;border-radius:0 6px 6px 0}
  .cta{display:inline-block;margin-top:14px;background:#25D366;color:#fff;text-decoration:none;font-weight:700;padding:11px 18px;border-radius:8px}
  footer{margin-top:16px;border-top:1px solid #e4ebf3;padding-top:8px;color:#8a97a8;font-size:10px}
</style></head><body${web ? "" : ' onload="window.print()"'}>
  <div class="wrap">
    <div class="bar"><span class="brand">Placas360</span></div>
    <h1>${esc(a.titulo)}</h1><div class="sub">${esc(a.subtitulo)}${placa ? ` · Placa ${esc(placa)}` : ""}</div>
    ${imgs ? `<div class="grid">${imgs}</div>` : ""}
    <h2>Destaques</h2><ul>${bullets}</ul>
    <h2>Descrição</h2><p>${esc(a.descricao).replace(/\n/g, "<br>")}</p>
    <p class="price">${esc(a.precoTexto)}</p>
    <p class="tags">${esc(a.hashtags.join(" "))}</p>
    ${cta}
    <footer>Placas360 · Anúncio gerado automaticamente a partir dos dados do veículo${form.marca ? ` (${esc(form.marca)})` : ""}.</footer>
  </div>
</body></html>`;
}
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
