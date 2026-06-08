import type { Metadata } from "next";
import { Big_Shoulders, IBM_Plex_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import "./enterprise.css";
import { TopBar } from "@/components/TopBar";
import { getSession } from "@/lib/auth/server";

// Site-wide enterprise / ASP.NET-WebForms skin. `true` adds the `erp` class to
// <body>, under which enterprise.css remaps the theme variables, restyles the
// shared primitives and turns the nav into a tab strip. Set to `false` to
// restore the original dark "workshop" theme. (Full removal: see enterprise.css.)
const ENTERPRISE_THEME = true;

// Three fonts, three jobs:
//   - Big Shoulders Display: condensed Chicago-workwear caps for h1/wordmarks.
//     Borrowed from the city of Chicago's identity system — heavy, stencil-ish,
//     not the "Space Grotesk" / "Inter" default everyone reaches for.
//   - IBM Plex Sans: body. Engineered grotesque with diacritics that handle
//     Brazilian Portuguese cleanly; reads less corporate than Inter.
//   - JetBrains Mono: plate readouts + duplicates badge. Slashed zero matters
//     because Brazilian plates mix O and 0.
const display = Big_Shoulders({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["500", "700", "900"],
  display: "swap",
});
const body = IBM_Plex_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});
const mono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Concessionária Demo · CRM",
  description: "Cliente CRM da plataforma Dadocar (demo).",
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  // Session drives the user chip / admin link in the nav. Never let a missing
  // secret or cookie error brick the shell (the auth pages must still render).
  let user: { email: string; role: string } | null = null;
  try {
    const s = await getSession();
    if (s) user = { email: s.email, role: s.role };
  } catch {
    user = null;
  }

  return (
    <html
      lang="pt-BR"
      className={`${display.variable} ${body.variable} ${mono.variable} h-full antialiased`}
    >
      <body className={`min-h-full flex flex-col bg-[var(--bg)] text-[var(--fg)]${ENTERPRISE_THEME ? " erp" : ""}`}>
        {/* Atmospheric background: warm radial bleed + diagonal workshop hatching.
            Pointer-events-none so it doesn't eat clicks. */}
        <div className="fixed inset-0 -z-10 atmos" aria-hidden />
        <TopBar user={user} />
        <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-8 py-8">{children}</main>
      </body>
    </html>
  );
}
