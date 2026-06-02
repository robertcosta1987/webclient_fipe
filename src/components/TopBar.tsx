"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { AddCarModal } from "./AddCarModal";

const nav = [
  { href: "/carros-ativos", label: "Carros Ativos" },
  { href: "/buscar", label: "Buscar" },
  { href: "/precos", label: "Preços" },
  { href: "/relatorios", label: "Relatórios", disabled: true },
];

export function TopBar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  return (
    <>
      <header className="sticky top-0 z-30 border-b border-[var(--border)] bg-[var(--bg)]/85 backdrop-blur supports-[backdrop-filter]:bg-[var(--bg)]/70">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 flex items-center justify-between h-16">
          {/* Wordmark — a hazard-tape orange bar next to a stencil display name.
              Subtle service-bay vibe without going full mechanic. */}
          <div className="flex items-center gap-8">
            <Link href="/" className="flex items-center gap-3 rise rise-d1 group">
              <span className="block w-1.5 h-7 bg-[var(--accent)] group-hover:bg-[var(--accent-hot)] transition-colors" />
              <span className="font-display uppercase tracking-[0.18em] text-[var(--fg-strong)] text-lg leading-none">
                Concessionária <span className="text-[var(--accent)]">/</span> Demo
              </span>
            </Link>
            <nav className="flex items-center gap-1">
              {nav.map((it, i) => {
                const active = pathname === it.href || (it.href !== "/" && pathname?.startsWith(it.href));
                if (it.disabled) {
                  return (
                    <span
                      key={it.href}
                      title="Em breve"
                      className={`px-3 py-1.5 text-sm font-medium tracking-wide text-[var(--fg-faint)] cursor-not-allowed select-none rise rise-d${i + 2}`}
                    >
                      {it.label}
                    </span>
                  );
                }
                return (
                  <Link
                    key={it.href}
                    href={it.href}
                    className={`relative px-3 py-1.5 text-sm font-medium tracking-wide transition-colors rise rise-d${i + 2} ${
                      active
                        ? "text-[var(--fg-strong)]"
                        : "text-[var(--fg-muted)] hover:text-[var(--fg)]"
                    }`}
                  >
                    {it.label}
                    {active && (
                      <span className="absolute left-3 right-3 -bottom-[17px] h-[2px] bg-[var(--accent)]" />
                    )}
                  </Link>
                );
              })}
            </nav>
          </div>
          <button
            onClick={() => setOpen(true)}
            className="btn-primary text-sm rise rise-d4"
          >
            + Adicionar Veículo
          </button>
        </div>
      </header>
      <AddCarModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
