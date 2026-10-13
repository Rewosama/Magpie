"use client";

import { usePathname } from "next/navigation";

const HIDE_AUTH_PATHS = ["/privacy", "/terms", "/login"];

export function NavbarAuth({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  
  // Hide auth components on public pages
  if (HIDE_AUTH_PATHS.includes(pathname)) {
    return null;
  }
  
  return <>{children}</>;
}
