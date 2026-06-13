// teste-auto-preenchimento/page.tsx — register a vehicle: type the plate, press
// Tab/Enter, the fields auto-fill from the FIPE-by-plate lookup. Behind app auth
// (middleware). The interactive form is a client component.

import { VehicleForm } from "./VehicleForm";

export const dynamic = "force-dynamic";

export default function TesteAutoPreenchimentoPage() {
  return (
    <section className="space-y-8">
      <header className="mb-2">
        <div className="flex items-center gap-3 mb-1 rise rise-d1">
          <span className="block w-1 h-6 bg-[var(--accent)]" />
          <span className="font-display uppercase tracking-[0.22em] text-xs text-[var(--accent)]">
            Operação · Cadastro de Veículo
          </span>
        </div>
        <h1 className="font-display uppercase tracking-[0.04em] text-[var(--fg-strong)] text-4xl leading-none rise rise-d2">
          Teste Auto Preenchimento
        </h1>
        <p className="text-sm text-[var(--fg-muted)] mt-2 max-w-2xl rise rise-d2">
          Cadastre um veículo no sistema: digite a <strong>placa</strong> e pressione{" "}
          <kbd className="px-1.5 py-0.5 rounded bg-[var(--bg-elev-2)] text-[11px]">Tab</kbd> ou{" "}
          <kbd className="px-1.5 py-0.5 rounded bg-[var(--bg-elev-2)] text-[11px]">Enter</kbd> — os dados são
          buscados pela placa e os campos são preenchidos automaticamente.
        </p>
      </header>
      <VehicleForm />
    </section>
  );
}
