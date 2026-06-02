"use client";

// PrecosClient.tsx — plate input + KBB pricing renderer.
//
// Layout (top → bottom):
//   1. Plate input + Search button (server action: lookupPlacaPrecos).
//   2. Decoder strip (Plate / VIN / ModelYear / Status / MolicarId).
//   3. KBB pricing table — five sale-channel cards (NewVehicle, UsedDealer,
//      SellPrivateParty, SellDealer, FPP) each with Min / Fair / Max.
//   4. Molicar reference price (single big number).
//   5. Vehicle data — every non-empty field from VehicleData rendered as a
//      definition grid.
//   6. Raw JSON expander for diagnostics / debugging.

import { useState, useTransition } from "react";
import { normalizePlaca, isValidPlaca } from "@/lib/placa/normalize";
import { lookupPlacaPrecos, type PrecosLookupResult } from "@/app/actions/precos";
import type { MolicarPayload, PriceRange } from "@/lib/pricing/types";

// Visual order matches a typical dealership negotiation flow: what's the
// car worth new → what does it sell for → what does the dealer pay.
// Tighten the key type to just the price-range categories — KBBPricing also
// contains string fields (UF, Grade, MY, Mileage, Color) that aren't
// indexable as a PriceRange.
type KBBCategoryKey = "NewVehicle" | "UsedDealer" | "SellPrivateParty" | "SellDealer" | "FPP";
const KBB_CATEGORIES: Array<{
  key: KBBCategoryKey;
  label: string;
  blurb: string;
}> = [
  { key: "NewVehicle",       label: "Zero-km (referência)",   blurb: "Preço de referência do modelo equivalente novo (zero-km)." },
  { key: "UsedDealer",       label: "Varejo (concessionária)", blurb: "Preço de varejo praticado na concessionária para o usado." },
  { key: "SellPrivateParty", label: "Particular",              blurb: "Preço de anúncio entre particulares (sem intermédio de dealer)." },
  { key: "SellDealer",       label: "Troca (dealer paga)",     blurb: "Valor que o dealer paga ao comprar o usado para troca." },
  { key: "FPP",              label: "Atacado (FPP)",           blurb: "Floor Price Point — piso de aceite do dealer no atacado." },
];

export function PrecosClient() {
  const [placa, setPlaca] = useState("");
  const [result, setResult] = useState<PrecosLookupResult | null>(null);
  const [pending, start] = useTransition();

  const placaNorm = normalizePlaca(placa);
  const placaOk = isValidPlaca(placaNorm);

  function run(e: React.FormEvent) {
    e.preventDefault();
    if (!placaOk) return;
    start(async () => {
      const next = await lookupPlacaPrecos(placaNorm);
      setResult(next);
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
        <button
          type="submit"
          disabled={pending || !placaOk}
          className="btn-primary text-sm"
        >
          {pending ? "Consultando…" : "Consultar preços"}
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
        <div
          role="alert"
          className="surface border border-[var(--danger)]/60 p-4 text-sm text-[var(--fg)]"
        >
          {result.error}
        </div>
      )}

      {result?.ok === true && <PricingReport r={result} />}
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// Rendering
// ───────────────────────────────────────────────────────────────────────────

function PricingReport({ r }: { r: Extract<PrecosLookupResult, { ok: true }> }) {
  const { payload } = r;
  const decoder = payload.Decoder ?? {};
  const vehicle = payload.VehicleData ?? {};
  const pricing = payload.Pricing ?? {};
  const kbb = payload.KBBPricing ?? {};

  return (
    <div className="space-y-6">
      <DecoderStrip
        placa={r.placa}
        decoder={decoder}
        upstreamLatencyMs={r.upstreamLatencyMs}
      />

      <section aria-labelledby="kbb-title" className="space-y-3">
        <h2
          id="kbb-title"
          className="font-display uppercase tracking-[0.16em] text-sm text-[var(--accent)]"
        >
          KBB · Faixas por classificação
        </h2>
        <p className="text-xs text-[var(--fg-muted)]">
          UF {kbb.UF ?? "—"} · {kbb.Grade ?? "Default"} · MY {kbb.MY ?? "—"} ·
          Mileage {kbb.Mileage ?? "Default"} · Cor {kbb.Color ?? "—"}
        </p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {KBB_CATEGORIES.map(({ key, label, blurb }) => (
            <PriceCard key={key} label={label} blurb={blurb} range={kbb[key] ?? undefined} />
          ))}
          <MolicarCard value={pricing.MolicarPrice} />
        </div>
      </section>

      <VehicleDataPanel vehicle={vehicle} />

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

function DecoderStrip({
  placa,
  decoder,
  upstreamLatencyMs,
}: {
  placa: string;
  decoder: NonNullable<MolicarPayload["Decoder"]>;
  upstreamLatencyMs: number | null;
}) {
  // Reuse the pre-Mercosul yellow plate aesthetic from the rest of the app
  // so the placa reads like a found object on the page.
  return (
    <div className="surface flex flex-wrap items-center gap-x-8 gap-y-3 p-4">
      <span
        className="px-3 py-1 font-mono tracking-[0.22em] text-lg"
        style={{
          background: "var(--plate-yellow)",
          color: "var(--plate-ink)",
        }}
      >
        {decoder.Plate ?? placa}
      </span>
      <Field label="Chassi (VIN)" value={decoder.Vin} mono />
      <Field label="Ano do modelo" value={decoder.ModelYear} />
      <Field label="Molicar ID" value={decoder.MolicarId} mono />
      <Field label="Status" value={decoder.Status} />
      {upstreamLatencyMs !== null && (
        <Field label="Latência upstream" value={`${upstreamLatencyMs} ms`} />
      )}
    </div>
  );
}

function PriceCard({
  label,
  blurb,
  range,
}: {
  label: string;
  blurb: string;
  range: PriceRange | undefined;
}) {
  const min = numberOrNull(range?.Min);
  const fair = numberOrNull(range?.FairPrice);
  const max = numberOrNull(range?.Max);
  const noData = min === null && fair === null && max === null;

  return (
    <article className="surface p-4 flex flex-col gap-3 min-h-[10rem]">
      <header className="flex items-baseline justify-between gap-3">
        <h3 className="font-display uppercase tracking-[0.12em] text-sm text-[var(--fg-strong)]">
          {label}
        </h3>
        <span className="text-[10px] uppercase tracking-[0.18em] text-[var(--fg-faint)]">
          KBB
        </span>
      </header>
      {noData ? (
        <p className="text-xs text-[var(--fg-muted)] italic">
          Sem dado para essa categoria.
        </p>
      ) : (
        <>
          <div className="font-mono text-2xl text-[var(--fg-strong)] leading-none">
            {formatBRL(fair) ?? "—"}
            <span className="ml-2 text-[10px] uppercase tracking-[0.18em] text-[var(--fg-muted)] align-middle">
              preço justo
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <p className="text-[10px] uppercase tracking-[0.16em] text-[var(--fg-muted)]">Mín</p>
              <p className="font-mono text-[var(--fg)]">{formatBRL(min) ?? "—"}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-[0.16em] text-[var(--fg-muted)]">Máx</p>
              <p className="font-mono text-[var(--fg)]">{formatBRL(max) ?? "—"}</p>
            </div>
          </div>
        </>
      )}
      <p className="mt-auto pt-2 text-[11px] leading-snug text-[var(--fg-muted)]">{blurb}</p>
    </article>
  );
}

function MolicarCard({ value }: { value: number | undefined | null }) {
  const v = numberOrNull(value);
  return (
    <article className="surface p-4 flex flex-col gap-3 min-h-[10rem] border border-[var(--accent)]/40">
      <header className="flex items-baseline justify-between gap-3">
        <h3 className="font-display uppercase tracking-[0.12em] text-sm text-[var(--accent)]">
          Molicar · Preço de referência
        </h3>
        <span className="text-[10px] uppercase tracking-[0.18em] text-[var(--fg-faint)]">
          Molicar
        </span>
      </header>
      <div className="font-mono text-2xl text-[var(--fg-strong)] leading-none">
        {formatBRL(v) ?? "—"}
        <span className="ml-2 text-[10px] uppercase tracking-[0.18em] text-[var(--fg-muted)] align-middle">
          referência
        </span>
      </div>
      <p className="mt-auto pt-2 text-[11px] leading-snug text-[var(--fg-muted)]">
        Preço Molicar — média ponderada do mercado para o veículo, independente
        do canal de venda.
      </p>
    </article>
  );
}

function VehicleDataPanel({ vehicle }: { vehicle: NonNullable<MolicarPayload["VehicleData"]> }) {
  // Field display order is chosen to read like a vehicle spec sheet:
  // identity first, then engine, then dimensions/registration.
  const rows: Array<[string, unknown]> = [
    ["Marca",                vehicle.Brand],
    ["Modelo",               vehicle.Model],
    ["Versão",               vehicle.Version],
    ["Ano de fabricação",    vehicle.ManufacturedYear],
    ["Cor",                  vehicle.VehicleColor],
    ["Tipo",                 vehicle.VehicleType],
    ["Carroceria",           vehicle.BodyType],
    ["Espécie",              vehicle.VehicleSpecie],
    ["Porte",                vehicle.Size],
    ["Combustível",          vehicle.FuelType],
    ["Transmissão",          vehicle.Transmission],
    ["Turbo",                typeof vehicle.HasTurbo === "boolean" ? (vehicle.HasTurbo ? "Sim" : "Não") : undefined],
    ["Tração",               vehicle.DriveTrain],
    ["Cilindradas (cc)",     vehicle.CC],
    ["Potência (cv)",        vehicle.Power],
    ["Portas",               vehicle.NrDoors],
    ["Lugares",              vehicle.NrSeats],
    ["Eixos",                vehicle.Axles],
    ["PBT (kg)",             vehicle.TotalGrossWeight],
    ["Cap. tração máx. (kg)", vehicle.MaximumTractionCapacity],
    ["Carroceria (peso kg)", vehicle.WeightCarriage],
    ["N° do motor",          vehicle.EngineNumber],
    ["Nacionalidade",        vehicle.Nationality],
    ["UF origem",            vehicle.UFOrigin],
    ["UF atual",             vehicle.UFCurrent],
    ["Município atual",      vehicle.CurrentCityName],
    ["ADAS",                 vehicle.ADAS],
  ];
  const visible = rows.filter(([, v]) => v !== undefined && v !== null && v !== "");

  if (!visible.length) {
    return (
      <section aria-labelledby="vd-title" className="surface p-4">
        <h2
          id="vd-title"
          className="font-display uppercase tracking-[0.16em] text-sm text-[var(--accent)] mb-2"
        >
          Dados do veículo
        </h2>
        <p className="text-xs text-[var(--fg-muted)] italic">Sem dados retornados pelo Molicar.</p>
      </section>
    );
  }

  return (
    <section aria-labelledby="vd-title" className="space-y-3">
      <h2
        id="vd-title"
        className="font-display uppercase tracking-[0.16em] text-sm text-[var(--accent)]"
      >
        Dados do veículo
      </h2>
      <dl className="surface grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-3 p-4">
        {visible.map(([label, val]) => (
          <div key={label}>
            <dt className="text-[10px] uppercase tracking-[0.16em] text-[var(--fg-muted)]">
              {label}
            </dt>
            <dd className="text-sm text-[var(--fg-strong)] mt-0.5 break-words">
              {String(val)}
            </dd>
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

function numberOrNull(v: number | string | null | undefined): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

const BRL = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 0,
});

function formatBRL(v: number | null): string | null {
  if (v === null) return null;
  return BRL.format(v);
}
