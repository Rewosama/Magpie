"use client";

import { useEffect, useState } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

type AuthStatus = "loading" | "authenticating" | "success" | "error";

export default function AuthCallbackPage() {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [errorMessage, setErrorMessage] = useState<string>("");

  useEffect(() => {
    const supabase = createClientComponentClient({
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL!,
      supabaseKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    });

    let redirectTimeout: NodeJS.Timeout;

    // Get the redirect destination from localStorage (set by login page)
    // Falls back to /feed if not set
    // Also handles share target params for PWA share flow
    const getRedirectUrl = (): string => {
      try {
        const next = localStorage.getItem("auth_redirect_next");
        const shareUrl = localStorage.getItem("auth_share_url");
        const shareText = localStorage.getItem("auth_share_text");

        // Clean up
        localStorage.removeItem("auth_redirect_next");
        localStorage.removeItem("auth_share_url");
        localStorage.removeItem("auth_share_text");

        // If we have share params, redirect to share-target with them
        if (next === "/share-target" && shareUrl) {
          const params = new URLSearchParams();
          params.set("url", shareUrl);
          if (shareText) params.set("text", shareText);
          return `/share-target?${params.toString()}`;
        }

        // Validate: must start with / and not be an external URL
        if (next && next.startsWith("/") && !next.startsWith("//")) {
          return next;
        }
      } catch {
        // localStorage might not be available
      }
      return "/feed";
    };

    async function handleAuth() {
      try {
        setStatus("authenticating");
        const redirectUrl = getRedirectUrl();

        // 1. Try to read access_token from URL hash (implicit flow)
        const hash = window.location.hash;
        if (hash) {
          const params = new URLSearchParams(hash.substring(1));
          const access_token = params.get("access_token");
          const refresh_token = params.get("refresh_token");

          if (access_token) {
            const { data, error } = await supabase.auth.setSession({
              access_token,
              refresh_token: refresh_token ?? "",
            });

            if (data.session && !error) {
              setStatus("success");
              // Use longer delay to ensure cookies are fully set
              redirectTimeout = setTimeout(() => {
                window.location.href = redirectUrl;
              }, 500);
              return;
            }

            if (error) {
              console.error("[Auth callback] setSession error:", error);
            }
          }
        }

        // 2. Try PKCE code in query params
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get("code");

        if (code) {
          const { data, error } =
            await supabase.auth.exchangeCodeForSession(code);

          if (data.session && !error) {
            setStatus("success");
            redirectTimeout = setTimeout(() => {
              window.location.href = redirectUrl;
            }, 500);
            return;
          }

          if (error) {
            console.error("[Auth callback] exchangeCode error:", error);
            setErrorMessage(error.message);
          }
        }

        // 3. Check if session already exists (maybe from a previous flow)
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (session) {
          setStatus("success");
          redirectTimeout = setTimeout(() => {
            window.location.href = redirectUrl;
          }, 300);
          return;
        }

        // Check for error in URL params
        const errorParam = urlParams.get("error");
        const errorDesc = urlParams.get("error_description");

        if (errorParam) {
          setErrorMessage(errorDesc || errorParam);
        }

        // No valid auth found
        setStatus("error");
        redirectTimeout = setTimeout(() => {
          window.location.href = "/login?error=oauth_failed";
        }, 2000);
      } catch (e) {
        console.error("[Auth callback] unexpected error:", e);
        setStatus("error");
        setErrorMessage(
          e instanceof Error ? e.message : "Beklenmeyen bir hata oluştu",
        );
        redirectTimeout = setTimeout(() => {
          window.location.href = "/login?error=oauth_failed";
        }, 2000);
      }
    }

    handleAuth();

    return () => {
      if (redirectTimeout) clearTimeout(redirectTimeout);
    };
  }, []);

  // Full-screen overlay to prevent seeing anything underneath
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-zinc-50 dark:bg-zinc-950">
      <div className="text-center space-y-6">
        {(status === "loading" || status === "authenticating") && (
          <>
            {/* Square spinner with moving line */}
            <div className="relative w-10 h-10 mx-auto">
              <svg className="w-full h-full" viewBox="0 0 40 40">
                {/* Background square */}
                <rect
                  x="2"
                  y="2"
                  width="36"
                  height="36"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="text-zinc-200 dark:text-zinc-800"
                />
                {/* Animated line */}
                <rect
                  x="2"
                  y="2"
                  width="36"
                  height="36"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeDasharray="36 108"
                  className="text-zinc-900 dark:text-zinc-100 animate-square-spin"
                />
              </svg>
            </div>
            <p className="mono text-sm text-zinc-500">
              {status === "loading" ? "Hazırlanıyor..." : "Giriş yapılıyor..."}
            </p>
          </>
        )}

        {status === "success" && (
          <>
            <div className="w-12 h-12 flex items-center justify-center mx-auto">
              <svg
                className="w-10 h-10 text-emerald-500"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M20 6L9 17l-5-5" />
              </svg>
            </div>
            <p className="mono text-sm text-zinc-500">
              Giriş başarılı, yönlendiriliyorsunuz...
            </p>
          </>
        )}

        {status === "error" && (
          <>
            <div className="w-12 h-12 flex items-center justify-center mx-auto">
              <svg
                className="w-10 h-10 text-red-500"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="15" y1="9" x2="9" y2="15" />
                <line x1="9" y1="9" x2="15" y2="15" />
              </svg>
            </div>
            <div className="space-y-1">
              <p className="mono text-sm text-zinc-900 dark:text-zinc-100">
                Giriş başarısız
              </p>
              {errorMessage && (
                <p className="mono text-xs text-zinc-500 max-w-xs mx-auto">
                  {errorMessage}
                </p>
              )}
              <p className="mono text-xs text-zinc-400 mt-2">
                Login sayfasına yönlendiriliyorsunuz...
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
