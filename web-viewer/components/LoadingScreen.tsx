/**
 * Loading Screen Component
 *
 * Reusable full-screen loading state with logo and square spinner.
 */

import Image from "next/image";

export function LoadingScreen() {
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-zinc-50 dark:bg-zinc-950">
      <div className="text-center space-y-6">
        {/* Logo */}
        <div className="flex justify-center">
          <Image
            src="/logo-dark@2x.png"
            alt="Magpie"
            width={48}
            height={48}
            className="dark:hidden"
            priority
          />
          <Image
            src="/logo@2x.png"
            alt="Magpie"
            width={48}
            height={48}
            className="hidden dark:block"
            priority
          />
        </div>

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

        <p className="mono text-sm text-zinc-500">Yükleniyor...</p>
      </div>
    </div>
  );
}
