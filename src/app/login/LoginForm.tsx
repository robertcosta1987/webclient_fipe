"use client";

import Link from "next/link";
import { useActionState } from "react";
import { login, type AuthResult } from "@/app/actions/auth";

export function LoginForm() {
  const [state, formAction, pending] = useActionState<AuthResult, FormData>(
    async (_prev, formData) => login(formData),
    undefined,
  );

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="auth-head">
          <span className="auth-head-bar" />
          <span className="auth-title">Entrar — Concessionária Demo</span>
        </div>
        <p className="auth-sub">Acesso restrito. Informe suas credenciais.</p>
        <form action={formAction} className="auth-body">
          {state?.error && <p className="auth-error">{state.error}</p>}

          <div className="auth-field">
            <label htmlFor="email">E-mail</label>
            <input id="email" name="email" type="email" autoComplete="email" required className="input" />
          </div>
          <div className="auth-field">
            <label htmlFor="password">Senha</label>
            <input id="password" name="password" type="password" autoComplete="current-password" required className="input" />
          </div>

          <div className="auth-actions">
            <button type="submit" disabled={pending} className="btn-primary">
              {pending ? "Entrando…" : "Entrar"}
            </button>
          </div>

          <p className="auth-foot">
            Tem um convite? <Link href="/register">Criar conta</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
