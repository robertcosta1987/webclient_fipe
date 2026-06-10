// admin/assinaturas/page.tsx — "Adicionar Assinatura". Admin/master only.
// Creates a customer (CRM) + subscription + login user, with a consumption plan
// (consult credits OR cash budget) over the selected products, and returns a
// one-time temporary password that the user must change on first login.

import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/server";
import { AssinaturaForm } from "./AssinaturaForm";

export const dynamic = "force-dynamic";

export default async function AssinaturasPage() {
  const session = await getSession();
  if (!session || session.role !== "admin") redirect("/precos");

  return (
    <section>
      <header className="mb-7">
        <div className="flex items-center gap-3 mb-1 rise rise-d1">
          <span className="block w-1 h-6 bg-[var(--accent)]" />
          <span className="font-display uppercase tracking-[0.22em] text-xs text-[var(--accent)]">
            Administração · Clientes
          </span>
        </div>
        <h1 className="font-display uppercase tracking-[0.04em] text-[var(--fg-strong)] text-4xl leading-none rise rise-d2">
          Adicionar Assinatura
        </h1>
        <p className="text-sm text-[var(--fg-muted)] mt-2 max-w-2xl rise rise-d2">
          Cria o cliente (CRM), a assinatura e o usuário de login de uma vez. Escolha
          o plano de consumo — quantidade de consultas por produto ou um valor em
          reais — e os produtos contratados. Ao final, uma senha temporária é gerada
          para o primeiro acesso (troca obrigatória).
        </p>
      </header>
      <AssinaturaForm />
    </section>
  );
}
