"use client";

import { usePathname } from "next/navigation";

/** Hides the header on unauthenticated pages (login). */
export function HeaderWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname === "/login") return null;
  return <>{children}</>;
}
