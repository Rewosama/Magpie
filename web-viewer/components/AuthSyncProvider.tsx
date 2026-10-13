"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";

// Only skip redirect for login and auth callback (already on auth pages)
const SKIP_REDIRECT_PATHS = ["/login", "/auth/callback", "/privacy", "/terms"];
const LOGOUT_SIGNAL_KEY = "magpie_logout_signal";

export function AuthSyncProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // Listen for logout signals from other tabs via localStorage
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === LOGOUT_SIGNAL_KEY && e.newValue) {
        // Another tab triggered logout - redirect to login unless on public pages
        if (!SKIP_REDIRECT_PATHS.includes(pathname)) {
          router.push("/login");
        } else {
          // On public pages, just refresh to update navbar state
          router.refresh();
        }
      }
    };

    window.addEventListener("storage", handleStorageChange);

    return () => {
      window.removeEventListener("storage", handleStorageChange);
    };
  }, [router, pathname]);

  return <>{children}</>;
}

/**
 * Broadcasts a logout signal to all other tabs.
 * Call this after signOut() to sync all web tabs.
 */
export function broadcastLogout() {
  // Write a timestamp to trigger storage event in other tabs
  localStorage.setItem(LOGOUT_SIGNAL_KEY, Date.now().toString());
  // Clean up immediately - we only need the event, not the value
  localStorage.removeItem(LOGOUT_SIGNAL_KEY);
}
