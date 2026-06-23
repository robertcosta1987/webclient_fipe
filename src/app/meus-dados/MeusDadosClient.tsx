"use client";

import Link from "next/link";
import { useActionState } from "react";
import { deleteMyAccount, type AccountResult } from "@/app/actions/account";

export function MeusDadosClient({ email }: { email: string }) {
  const [state, formAction, pending] = useActionState<AccountResult, FormData>(
    async (_prev, formData) => deleteMyAccount(formData),
    undefined,
  );

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Meus dados</h1>
        <p className="text-sm opacity-70">
          Conta <strong>{email}</strong>. Exerça seus direitos de titular previstos na LGPD (Lei nº 13.709/2018).
        </p>
      </header>

      {/* Access / portability — Art. 18, II e V */}
      <section className="rounded-lg border border-[var(--border,#3334)] p-5">
        <h2 className="text-lg font-semibold">Exportar meus dados</h2>
        <p className="mt-1 text-sm opacity-70">
          Baixe uma cópia dos dados que mantemos sobre você (conta, cadastro, veículos e consultas).
          A exportação não inclui senhas nem chaves de API.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <a href="/api/me/export" download className="btn-primary">Exportar em JSON</a>
          <a href="/api/me/export?format=csv" download className="btn-ghost">Exportar em CSV</a>
        </div>
      </section>

      {/* Erasure — Art. 18, VI */}
      <section className="rounded-lg border border-[var(--danger,#b91c1c)]/40 p-5">
        <h2 className="text-lg font-semibold">Excluir minha conta</h2>
        <p className="mt-1 text-sm opacity-70">
          Esta ação remove seus veículos e histórico de consultas e anonimiza seu cadastro.
          Por exigência fiscal/legal (Art. 16 da LGPD), registros de cobrança são mantidos de forma
          anonimizada. <strong>A ação é irreversível</strong> e encerra sua sessão.
        </p>
        <form action={formAction} className="mt-4 space-y-3">
          {state?.error && <p className="auth-error">{state.error}</p>}
          <label htmlFor="confirm" className="block text-sm">
            Para confirmar, digite <strong>EXCLUIR</strong>:
          </label>
          <input id="confirm" name="confirm" autoComplete="off" className="input" placeholder="EXCLUIR" required />
          <button type="submit" disabled={pending} className="btn-primary" style={{ background: "var(--danger,#b91c1c)" }}>
            {pending ? "Excluindo…" : "Excluir minha conta permanentemente"}
          </button>
        </form>
      </section>

      <p className="text-sm opacity-70">
        Dúvidas sobre tratamento de dados? Consulte nossa{" "}
        <Link href="/privacidade" className="underline">Política de Privacidade</Link>.
      </p>
    </div>
  );
}
