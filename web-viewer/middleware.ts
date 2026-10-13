/**
 * Next.js middleware for route protection.
 *
 * Strategy:
 * - Handle ONLY known routes (protected, public, auth)
 * - Unknown routes pass through → Next.js shows 404
 * - No catch-all redirect logic
 */

import { NextRequest, NextResponse } from "next/server";
import { createMiddlewareSupabaseClient } from "@/lib/supabase";

// ─────────────────────────────────────────────────────────────────────────────
// Route Definitions
// ─────────────────────────────────────────────────────────────────────────────

/** Routes that require authentication */
const PROTECTED_ROUTES = ["/feed", "/settings", "/share-target"];

/** Routes only for unauthenticated users (logged-in users get redirected) */
const AUTH_ROUTES = ["/login"];

/** Routes that always pass through without auth checks */
const PUBLIC_ROUTES = ["/privacy", "/terms"];

/** Auth handler routes - OAuth callback, signout */
const AUTH_HANDLERS = ["/auth/callback", "/auth/signout"];

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function matchesRoute(pathname: string, routes: string[]): boolean {
  return routes.some(
    (route) => pathname === route || pathname.startsWith(route + "/"),
  );
}

function isKnownRoute(pathname: string): boolean {
  if (pathname === "/") return true;
  return (
    matchesRoute(pathname, PROTECTED_ROUTES) ||
    matchesRoute(pathname, AUTH_ROUTES) ||
    matchesRoute(pathname, PUBLIC_ROUTES) ||
    matchesRoute(pathname, AUTH_HANDLERS)
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Middleware
// ─────────────────────────────────────────────────────────────────────────────

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ── Skip static files and API routes ────────────────────────────────────────
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  // ── Auth handlers - always pass through ─────────────────────────────────────
  if (matchesRoute(pathname, AUTH_HANDLERS)) {
    return NextResponse.next();
  }

  // ── Public routes - always pass through ─────────────────────────────────────
  if (matchesRoute(pathname, PUBLIC_ROUTES)) {
    return NextResponse.next();
  }

  // ── Unknown routes - let Next.js handle (404) ───────────────────────────────
  if (!isKnownRoute(pathname)) {
    return NextResponse.next();
  }

  // ── From here on, we need auth state ────────────────────────────────────────
  const res = NextResponse.next();
  const supabase = createMiddlewareSupabaseClient(request, res);

  // Refresh session (important for cookie refresh)
  await supabase.auth.getSession();

  // Get user (validates JWT with Supabase)
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // ── Root path - redirect based on auth ──────────────────────────────────────
  if (pathname === "/") {
    return NextResponse.redirect(
      new URL(user ? "/feed" : "/login", request.url),
    );
  }

  // ── Auth routes (login) - redirect logged-in users to feed ──────────────────
  if (matchesRoute(pathname, AUTH_ROUTES)) {
    if (user) {
      return NextResponse.redirect(new URL("/feed", request.url));
    }
    return NextResponse.next();
  }

  // ── Protected routes - require authentication ───────────────────────────────
  if (matchesRoute(pathname, PROTECTED_ROUTES)) {
    if (!user) {
      const loginUrl = new URL("/login", request.url);

      // Add next parameter to redirect back after login
      loginUrl.searchParams.set("next", pathname);

      // Check if session expired
      const hadSessionCookie = request.cookies
        .getAll()
        .some((c) => c.name.startsWith("sb-") && c.name.includes("auth-token"));

      if (hadSessionCookie) {
        loginUrl.searchParams.set("reason", "expired");
      }

      const loginRedirect = NextResponse.redirect(loginUrl);

      // Clear stale cookies
      if (hadSessionCookie) {
        for (const cookie of request.cookies.getAll()) {
          if (cookie.name.startsWith("sb-")) {
            loginRedirect.cookies.set(cookie.name, "", {
              path: "/",
              expires: new Date(0),
              maxAge: 0,
            });
          }
        }
      }

      return loginRedirect;
    }

    return res;
  }

  return NextResponse.next();
}

// ─────────────────────────────────────────────────────────────────────────────
// Config - Only match routes we care about
// ─────────────────────────────────────────────────────────────────────────────

export const config = {
  matcher: [
    /*
     * Match all paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico, icon files
     * - Static assets (svg, png, jpg, etc.)
     */
    "/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff|woff2)$).*)",
  ],
};
