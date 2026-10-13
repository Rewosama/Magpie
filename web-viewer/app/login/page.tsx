import Image from "next/image";
import { Suspense } from "react";
import GoogleSignInButton from "@/components/GoogleSignInButton";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: { error?: string; reason?: string };
}) {
  const oauthFailed = searchParams.error === "oauth_failed";
  const expired = searchParams.reason === "expired";

  return (
    <div className="flex min-h-screen items-center justify-center px-4 bg-zinc-50 dark:bg-zinc-950">
      <div className="w-full max-w-sm space-y-8">
        {/* Brand */}
        <div className="text-center space-y-3">
          <Image
            src="/logo-512.png"
            alt="Magpie"
            width={64}
            height={64}
            className="mx-auto opacity-80"
            priority
          />
          <div>
            <h1 className="mono text-sm font-semibold tracking-[0.15em] text-zinc-900 dark:text-zinc-100 uppercase">
              Magpie Archive
            </h1>
            <p className="mono text-zinc-500 mt-1">
              Kişisel sosyal medya arşivin
            </p>
          </div>
        </div>

        {/* Error messages */}
        {oauthFailed && (
          <div
            role="alert"
            className="border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/30 px-4 py-3 text-sm text-red-600 dark:text-red-400 text-center"
          >
            Giriş başarısız. Lütfen tekrar deneyin.
          </div>
        )}
        {expired && (
          <div
            role="alert"
            className="border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 px-4 py-3 text-sm text-amber-600 dark:text-amber-400 text-center"
          >
            Oturumunuz sona erdi. Lütfen tekrar giriş yapın.
          </div>
        )}

        {/* Sign-in */}
        <div className="flex justify-center">
          <Suspense fallback={<div className="h-12" />}>
            <GoogleSignInButton />
          </Suspense>
        </div>

        <p className="text-center mono text-zinc-400">
          Sadece sen kayıtlı içeriklerini görebilirsin.
        </p>

        {/* Legal links */}
        <div className="flex items-center justify-center gap-4 pt-4">
          <a
            href="/privacy"
            className="mono text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
          >
            Gizlilik
          </a>
          <span className="text-zinc-300 dark:text-zinc-700">·</span>
          <a
            href="/terms"
            className="mono text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
          >
            Kullanım Koşulları
          </a>
        </div>
      </div>
    </div>
  );
}
