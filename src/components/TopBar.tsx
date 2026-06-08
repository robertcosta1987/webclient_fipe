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
  { href: "/historico-kbb", label: "Histórico KBB" },
  { href: "/checktudo", label: "CheckTudo" },
];

export function TopBar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  return (
    <>
      <header className="erp-topbar sticky top-0 z-30">
        <div className="erp-topbar-inner">
          <Link href="/" className="erp-brand">
            <span className="erp-brand-bar" />
            Concessionária Demo
          </Link>

          <nav className="erp-nav">
            {nav.map((it) => {
              const active =
                pathname === it.href || (it.href !== "/" && pathname?.startsWith(it.href));
              if (it.disabled) {
                return (
                  <span key={it.href} className="erp-navtab erp-navtab--disabled" title="Em breve">
                    {it.label}
                  </span>
                );
              }
              return (
                <Link
                  key={it.href}
                  href={it.href}
                  className={`erp-navtab${active ? " erp-navtab--active" : ""}`}
                >
                  {it.label}
                </Link>
              );
            })}
          </nav>

          <button onClick={() => setOpen(true)} className="btn-primary erp-addbtn text-sm">
            + Adicionar Veículo
          </button>
        </div>
      </header>
      <AddCarModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
