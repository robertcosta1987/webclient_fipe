// laudo/[consultaId] — AI vehicle-history report. Auth-gated by middleware;
// owner-scoped (master reads all) inside getLaudo. Generates + caches the AI
// narrative on first view.

import Link from "next/link";
import { getLaudo } from "@/app/actions/laudo";
import { LaudoView } from "./LaudoView";

export const dynamic = "force-dynamic";

export default async function LaudoPage({ params }: { params: Promise<{ consultaId: string }> }) {
  const { consultaId } = await params;
  const res = await getLaudo(consultaId);

  if (!res.ok) {
    return (
      <section className="space-y-4">
        <h1 className="font-display uppercase tracking-[0.04em] text-[var(--fg-strong)] text-3xl">Laudo</h1>
        <div className="surface p-6 text-sm text-[var(--fg-muted)]">{res.error}</div>
        <Link href="/checktudo" className="btn-ghost text-sm">← Voltar ao CheckTudo</Link>
      </section>
    );
  }

  return <LaudoView consultaId={consultaId} facts={res.facts} laudo={res.laudo} fonte={res.fonte} />;
}
