"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { logout } from "@/app/actions/auth";

const nav = [
  { href: "/infocar", label: "Infocar" },
  { href: "/precos", label: "Tabela KBB" },
  { href: "/checktudo", label: "CheckTudo" },
  { href: "/teste-auto-preenchimento", label: "Teste Auto Preenchimento" },
];

export function TopBar({ user }: { user?: { email: string; role: string } | null }) {
  const pathname = usePathname();

  // No app chrome on the public auth pages.
  if (pathname === "/login" || pathname === "/register") return null;

  return (
    <header className="erp-topbar sticky top-0 z-30">
      <div className="erp-topbar-inner">
        <Link href="/" className="erp-brand">
          <span className="erp-brand-bar" />
          Placas360
        </Link>

        <nav className="erp-nav">
          {nav.map((it) => {
            const active = pathname === it.href || pathname?.startsWith(`${it.href}/`);
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
          {user?.role === "admin" && (
            <Link
              href="/admin/assinaturas"
              className={`erp-navtab${pathname?.startsWith("/admin/assinaturas") ? " erp-navtab--active" : ""}`}
            >
              Adicionar Assinatura
            </Link>
          )}
          {user?.role === "admin" && (
            <Link
              href="/admin/convites"
              className={`erp-navtab${pathname?.startsWith("/admin/convites") ? " erp-navtab--active" : ""}`}
            >
              Convites
            </Link>
          )}
          {user?.role === "admin" && (
            <Link
              href="/admin/uso-apis"
              className={`erp-navtab${pathname?.startsWith("/admin/uso-apis") ? " erp-navtab--active" : ""}`}
            >
              Usage Report
            </Link>
          )}
        </nav>

        {user && (
          <div className="erp-user">
            <span className="erp-user-name">{user.email}</span>
            <span className="erp-user-role">{user.role}</span>
          </div>
        )}

        {user && (
          <form action={logout} style={{ marginBottom: 6 }}>
            <button type="submit" className="btn-ghost text-sm">Sair</button>
          </form>
        )}
      </div>
    </header>
  );
}
