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

function isPublic(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
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

  return NextResponse.next();
}

export const config = {
  // Run on everything except Next internals and static asset files.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|txt|xml|woff2?)$).*)"],
};
