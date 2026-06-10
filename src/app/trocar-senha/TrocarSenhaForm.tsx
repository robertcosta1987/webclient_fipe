"use client";

import { useActionState } from "react";
import { changePassword, logout, type AuthResult } from "@/app/actions/auth";

export function TrocarSenhaForm({ email }: { email: string }) {
  const [state, formAction, pending] = useActionState<AuthResult, FormData>(
    async (_prev, formData) => changePassword(formData),
    undefined,
  );

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="auth-head">
          <span className="auth-head-bar" />
          <span className="auth-title">Definir nova senha</span>
        </div>
        <p className="auth-sub">
          Primeiro acesso de <strong>{email}</strong>. Defina uma nova senha para continuar.
        </p>
        <form action={formAction} className="auth-body">
          {state?.error && <p className="auth-error">{state.error}</p>}

          <div className="auth-field">
            <label htmlFor="password">Nova senha</label>
            <input id="password" name="password" type="password" autoComplete="new-password" minLength={8} required className="input" />
          </div>
          <div className="auth-field">
            <label htmlFor="confirm">Confirmar nova senha</label>
            <input id="confirm" name="confirm" type="password" autoComplete="new-password" minLength={8} required className="input" />
          </div>

          <div className="auth-actions">
            <button type="submit" disabled={pending} className="btn-primary">
              {pending ? "Salvando…" : "Salvar e entrar"}
            </button>
          </div>
        </form>
        <form action={logout} className="auth-foot">
          <button type="submit" className="btn-ghost text-sm">Sair</button>
        </form>
      </div>
    </div>
  );
}
