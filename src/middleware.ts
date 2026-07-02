// middleware.ts — closes the whole app behind authentication.
//
// Unauthenticated requests to any app route are redirected to /login. The only
// public routes are /login and /register. Authenticated users who hit those are
// sent into the app. Session verification uses the Web-Crypto HMAC verifier
// (edge-safe) from lib/auth/session.

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/auth/session";

const PUBLIC_PATHS = ["/login", "/register"];

// Open to everyone (logged in OR out) with no redirect either way — e.g. the
// privacy policy must be reachable before login AND while authenticated (Art. 9º
// transparency). Distinct from PUBLIC_PATHS, which bounce logged-in users away.
const OPEN_PATHS = ["/privacidade"];

function isPublic(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

function isOpen(pathname: string): boolean {
  return OPEN_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Programmatic APIs authenticated by their own bearer token, not the session cookie:
  // the partner consult API (/api/v1) and the token-authed admin provisioning endpoint
  // (/api/admin, Bearer PLACAS_ADMIN_TOKEN) that the CRM calls. Skip the login-redirect guard.
  if (pathname.startsWith("/api/v1/") || pathname.startsWith("/api/admin/")) {
    return NextResponse.next();
  }

  // Always-open pages (e.g. the privacy policy): no auth guard, no redirects.
  if (isOpen(pathname)) return NextResponse.next();

  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const session = await verifySession(token, process.env.AUTH_SECRET ?? "");

  // Logged-in users shouldn't see the auth pages.
  if (session && isPublic(pathname)) {
    const url = req.nextUrl.clone();
    url.pathname = "/precos";
    url.search = "";
    return NextResponse.redirect(url);
  }

  // Everything that isn't public requires a session.
  if (!session && !isPublic(pathname)) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = pathname && pathname !== "/" ? `?next=${encodeURIComponent(pathname)}` : "";
    return NextResponse.redirect(url);
  }

  // Force a first-login password change: while flagged, the user can only reach
  // /trocar-senha (the change-password page + its server action). Everything
  // else bounces there.
  const CHANGE_PATH = "/trocar-senha";
  if (session?.mustChange && pathname !== CHANGE_PATH) {
    const url = req.nextUrl.clone();
    url.pathname = CHANGE_PATH;
    url.search = "";
    return NextResponse.redirect(url);
  }
  // Once changed, don't linger on the change page.
  if (session && !session.mustChange && pathname === CHANGE_PATH) {
    const url = req.nextUrl.clone();
    url.pathname = "/precos";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  // Run on everything except Next internals and static asset files.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|txt|xml|woff2?)$).*)"],
};
