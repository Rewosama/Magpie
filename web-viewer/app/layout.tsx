import type { Metadata } from "next";
import Image from "next/image";
import { Suspense } from "react";
import { HeaderWrapper } from "@/components/HeaderWrapper";
import { UserEmail } from "@/components/UserEmail";
import { SettingsButton } from "@/components/SettingsButton";
import { createServerClient } from "@/lib/supabase";
import "./globals.css";

export const metadata: Metadata = {
  title: "Magpie",
  description: "Your personal social content archive",
};

/** Reads the session server-side and passes email to the client SettingsButton. */
async function SettingsButtonWithEmail() {
  try {
    const supabase = createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.email) return null;
    return <SettingsButton email={user.email} />;
  } catch {
    return null;
  }
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Prevent theme flash */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                const t = localStorage.getItem('magpie-theme');
                const p = window.matchMedia('(prefers-color-scheme: dark)').matches;
                if (t === 'dark' || (!t && p)) document.documentElement.classList.add('dark');
              } catch(e) {}
            `,
          }}
        />
      </head>
      <body className="min-h-screen flex flex-col" suppressHydrationWarning>
        <HeaderWrapper>
          <header className="sticky top-0 z-40 h-14 flex items-center px-6 border-b border-gray-200 dark:border-gray-800 bg-white/80 dark:bg-gray-950/80 backdrop-blur-sm">
            {/* Logo */}
            <div className="flex items-center gap-2.5 flex-1">
              <Image src="/logo-96.png" alt="Magpie" width={28} height={28} className="rounded-lg" priority />
              <span className="font-semibold text-gray-900 dark:text-white tracking-tight">Magpie</span>
            </div>

            {/* Right side */}
            <div className="flex items-center gap-2">
              <Suspense fallback={<div className="w-9 h-9" />}>
                <SettingsButtonWithEmail />
              </Suspense>
              <UserEmail />
            </div>
          </header>
        </HeaderWrapper>

        <main className="flex-1">{children}</main>
      </body>
    </html>
  );
}
