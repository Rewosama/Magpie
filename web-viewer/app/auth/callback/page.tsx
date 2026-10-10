"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

export default function AuthCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClientComponentClient({
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL!,
      supabaseKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    });

    async function handleAuth() {
      // 1. Try to read access_token from URL hash (implicit flow)
      const hash = window.location.hash;
      const params = new URLSearchParams(hash.substring(1));
      const access_token = params.get("access_token");
      const refresh_token = params.get("refresh_token");

      console.log("[Magpie callback] hash token present:", !!access_token);

      if (access_token) {
        // Manually set the session — this writes it to cookies via auth-helpers
        const { data, error } = await supabase.auth.setSession({
          access_token,
          refresh_token: refresh_token ?? "",
        });
        console.log("[Magpie callback] setSession:", !!data.session, error?.message);
        if (data.session) {
          router.replace("/feed");
          return;
        }
      }

      // 2. Try PKCE code in query params (supabase-js handles this automatically)
      const code = new URLSearchParams(window.location.search).get("code");
      if (code) {
        const { data, error } = await supabase.auth.exchangeCodeForSession(code);
        console.log("[Magpie callback] exchangeCode:", !!data.session, error?.message);
        if (data.session) {
          router.replace("/feed");
          return;
        }
      }

      // 3. Check if session already exists
      const { data: { session } } = await supabase.auth.getSession();
      console.log("[Magpie callback] existing session:", !!session);
      router.replace(session ? "/feed" : "/login?error=oauth_failed");
    }

    handleAuth();
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent mx-auto mb-4" />
        <p className="text-sm text-gray-500">Signing in…</p>
      </div>
    </div>
  );
}
