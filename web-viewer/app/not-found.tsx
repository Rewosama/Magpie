"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

/**
 * 404 Not Found page.
 * Standalone page with logo - no header shown.
 * Shows appropriate button based on auth state (cookie check).
 */
export default function NotFound() {
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);

  useEffect(() => {
    // Check for Supabase auth cookie
    const hasAuthCookie = document.cookie
      .split(";")
      .some((c) => c.trim().startsWith("sb-") && c.includes("auth-token"));
    setIsLoggedIn(hasAuthCookie);
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center px-4 bg-zinc-50 dark:bg-zinc-950">
      <div className="text-center space-y-8 max-w-md">
        {/* Logo */}
        <div className="flex justify-center">
          <Image
            src="/logo-96.png"
            alt="Magpie"
            width={48}
            height={48}
            className="opacity-60"
            priority
          />
        </div>

        {/* 404 */}
        <div className="space-y-2">
          <h1 className="mono text-7xl font-bold text-zinc-200 dark:text-zinc-800">
            404
          </h1>
          <p className="mono text-zinc-900 dark:text-zinc-100 uppercase tracking-widest text-sm">
            Sayfa Bulunamadı
          </p>
        </div>

        {/* Message */}
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Aradığın sayfa mevcut değil veya taşınmış olabilir.
        </p>

        {/* Action - shows based on auth state */}
        <div className="pt-2">
          {isLoggedIn === null ? (
            // Loading state
            <div className="h-10" />
          ) : isLoggedIn ? (
            <a
              href="/feed"
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-sm font-medium hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors"
            >
              <svg
                className="w-4 h-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                <polyline points="9 22 9 12 15 12 15 22" />
              </svg>
              Arşive Dön
            </a>
          ) : (
            <a
              href="/login"
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-sm font-medium hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors"
            >
              <svg
                className="w-4 h-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                <polyline points="10 17 15 12 10 7" />
                <line x1="15" y1="12" x2="3" y2="12" />
              </svg>
              Giriş Yap
            </a>
          )}
        </div>

        {/* Brand */}
        <div className="pt-8">
          <p className="mono text-[10px] text-zinc-400 dark:text-zinc-600 uppercase tracking-[0.2em]">
            Magpie Archive
          </p>
        </div>
      </div>
    </div>
  );
}
