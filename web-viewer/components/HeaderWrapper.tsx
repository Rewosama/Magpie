"use client";

import { usePathname } from "next/navigation";

/**
 * Hides the header on specific pages:
 * - /login (auth page)
 * - /auth/* (auth routes - callback, signout)
 * - Unknown routes (404 pages)
 */

const KNOWN_ROUTES = ["/feed", "/settings", "/privacy", "/terms"];

export function HeaderWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // Hide on login page
  if (pathname === "/login") return null;

  // Hide on auth routes (callback, signout)
  if (pathname.startsWith("/auth/")) return null;

  // Hide on root (it redirects anyway)
  if (pathname === "/") return null;

  // Check if this is a known route
  const isKnownRoute = KNOWN_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(route + "/"),
  );

  // Hide header on unknown routes (404 pages)
  if (!isKnownRoute) return null;

  return <>{children}</>;
}
