"use client";

import Link from "next/link";
import { useActionState } from "react";
import { register, type AuthResult } from "@/app/actions/auth";

export function RegisterForm({ inviteFromUrl }: { inviteFromUrl?: string }) {
  const [state, formAction, pending] = useActionState<AuthResult, FormData>(
    async (_prev, formData) => register(formData),
    undefined,
  );

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="auth-head">
          <span className="auth-head-bar" />
          <span className="auth-title">Criar conta</span>
        </div>
        <p className="auth-sub">Cadastro restrito — é necessário um código de convite.</p>
        <form action={formAction} className="auth-body">
          {state?.error && <p className="auth-error">{state.error}</p>}

          <div className="auth-field">
            <label htmlFor="name">Nome</label>
            <input id="name" name="name" type="text" autoComplete="name" required className="input" />
          </div>
          <div className="auth-field">
            <label htmlFor="email">E-mail</label>
            <input id="email" name="email" type="email" autoComplete="email" required className="input" />
          </div>
          <div className="auth-field">
            <label htmlFor="password">Senha (mín. 8 caracteres)</label>
            <input id="password" name="password" type="password" autoComplete="new-password" minLength={8} required className="input" />
          </div>
          <div className="auth-field">
            <label htmlFor="invite">Código de convite</label>
            <input id="invite" name="invite" type="text" defaultValue={inviteFromUrl ?? ""} required className="input" />
          </div>

          <div className="auth-actions">
            <button type="submit" disabled={pending} className="btn-primary">
              {pending ? "Criando…" : "Criar conta"}
            </button>
          </div>

          <p className="auth-foot">
            Já tem conta? <Link href="/login">Entrar</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
