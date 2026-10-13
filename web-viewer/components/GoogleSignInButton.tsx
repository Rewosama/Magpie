"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { createBrowserClient } from "@/lib/supabase.browser";

export default function GoogleSignInButton() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const searchParams = useSearchParams();

  // Store the 'next' param and share params in localStorage so callback can use it
  useEffect(() => {
    const next = searchParams.get("next");
    const shareUrl = searchParams.get("share_url");
    const shareText = searchParams.get("share_text");

    try {
      if (next) {
        localStorage.setItem("auth_redirect_next", next);
      }
      // Store share params for after auth
      if (shareUrl) {
        localStorage.setItem("auth_share_url", shareUrl);
      }
      if (shareText) {
        localStorage.setItem("auth_share_text", shareText);
      }
    } catch {
      // localStorage might not be available
    }
  }, [searchParams]);

  async function handleSignIn() {
    setError(null);
    setLoading(true);
    try {
      const supabase = createBrowserClient();
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          queryParams: { prompt: "select_account" },
        },
      });
      if (error) {
        setError("Google ile giriş başlatılamadı: " + error.message);
        setLoading(false);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Beklenmeyen hata");
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        onClick={handleSignIn}
        disabled={loading}
        className="flex items-center gap-3 px-6 py-3 border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-sm font-medium text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? (
          <span className="mono text-zinc-400">...</span>
        ) : (
          <svg
            viewBox="0 0 48 48"
            className="h-5 w-5 shrink-0"
            aria-hidden="true"
          >
            <path
              fill="#4285F4"
              d="M47.5 24.5c0-1.6-.1-3.1-.4-4.5H24v8.5h13.2c-.6 3-2.3 5.5-4.9 7.2v6h7.9c4.6-4.3 7.3-10.6 7.3-17.2z"
            />
            <path
              fill="#34A853"
              d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.9-6c-2.1 1.4-4.8 2.3-8 2.3-6.1 0-11.3-4.1-13.2-9.7H2.7v6.2C6.7 42.8 14.8 48 24 48z"
            />
            <path
              fill="#FBBC05"
              d="M10.8 28.8A14.7 14.7 0 0 1 10 24c0-1.7.3-3.3.8-4.8v-6.2H2.7A24 24 0 0 0 0 24c0 3.9.9 7.6 2.7 10.9l8.1-6.1z"
            />
            <path
              fill="#EA4335"
              d="M24 9.5c3.4 0 6.5 1.2 8.9 3.5l6.7-6.7C35.9 2.4 30.5 0 24 0 14.8 0 6.7 5.2 2.7 13.1l8.1 6.1C12.7 13.6 17.9 9.5 24 9.5z"
            />
          </svg>
        )}
        Google ile devam et
      </button>
      {error && (
        <p className="mono text-red-500 text-center max-w-xs">{error}</p>
      )}
    </div>
  );
}
