// admin/uso-apis/page.tsx — "Usage Report for APIs". Admin/master only.
// Shows each API's billable usage; expand to see per-subscription (customer)
// usage broken down by product, with quantities, amounts and timestamps.

import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/server";
import { usageReport } from "@/lib/db/subscriptions";
import { UsageReportClient } from "./UsageReportClient";

export const dynamic = "force-dynamic";

export default async function UsoApisPage() {
  const session = await getSession();
  if (!session || session.role !== "admin") redirect("/precos");

  const apis = await usageReport();

  return (
    <section>
      <header className="mb-7">
        <div className="flex items-center gap-3 mb-1 rise rise-d1">
          <span className="block w-1 h-6 bg-[var(--accent)]" />
          <span className="font-display uppercase tracking-[0.22em] text-xs text-[var(--accent)]">
            Administração · Faturamento
          </span>
        </div>
        <h1 className="font-display uppercase tracking-[0.04em] text-[var(--fg-strong)] text-4xl leading-none rise rise-d2">
          Usage Report for APIs
        </h1>
        <p className="text-sm text-[var(--fg-muted)] mt-2 max-w-2xl rise rise-d2">
          Consumo por API, separado entre <strong>ao vivo</strong> (chamadas reais —
          faturáveis) e <strong>cache</strong> (servidas do cache — contadas para
          relatório, <strong>não cobradas</strong>). O total <strong>A cobrar</strong> considera
          apenas o uso ao vivo. Expanda uma API para ver o uso por assinatura (cliente) e produto.
        </p>
      </header>
      <UsageReportClient apis={apis} />
    </section>
  );
}
