"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { AddCarModal } from "./AddCarModal";

const nav = [
  { href: "/carros-ativos", label: "Carros Ativos" },
  { href: "/buscar", label: "Buscar" },
  { href: "/relatorios", label: "Relatórios", disabled: true },
];

export function TopBar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  return (
    <>
      <header className="sticky top-0 z-30 bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between h-14">
          <div className="flex items-center gap-6">
            <div className="font-semibold tracking-tight text-slate-900 flex items-center gap-2">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500" />
              Concessionária Demo
            </div>
            <nav className="flex items-center gap-1">
              {nav.map((it) => {
                const active = pathname === it.href || (it.href !== "/" && pathname?.startsWith(it.href));
                if (it.disabled) {
                  return (
                    <span
                      key={it.href}
                      title="Em breve"
                      className="px-3 py-1.5 rounded-md text-sm text-slate-400 cursor-not-allowed select-none"
                    >
                      {it.label}
                    </span>
                  );
                }
                return (
                  <Link
                    key={it.href}
                    href={it.href}
                    className={`px-3 py-1.5 rounded-md text-sm ${
                      active
                        ? "bg-slate-900 text-white"
                        : "text-slate-700 hover:bg-slate-100"
                    }`}
                  >
                    {it.label}
                  </Link>
                );
              })}
            </nav>
          </div>
          <button
            onClick={() => setOpen(true)}
            className="bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium px-4 py-2 rounded-md shadow-sm"
          >
            + Adicionar Veículo
          </button>
        </div>
      </header>
      <AddCarModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
