/**
 * Share Target Page
 *
 * Handles posts shared from mobile apps via Web Share Target API.
 * Flow:
 * 1. Receives URL from share intent (GET params: url, text, title)
 * 2. Detects platform and canonicalizes URL
 * 3. Shows collection selector modal
 * 4. Saves post with server-fetched metadata
 */
import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase";
import ShareTargetClient from "./ShareTargetClient";
import type { Collection } from "@/lib/types";

interface ShareTargetPageProps {
  searchParams: {
    url?: string;
    text?: string;
    title?: string;
  };
}

export default async function ShareTargetPage({
  searchParams,
}: ShareTargetPageProps) {
  const supabase = createServerClient();

  // Check authentication
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // If not authenticated, redirect to login with share params preserved
  if (!user) {
    const loginUrl = new URL("/login", process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000");
    loginUrl.searchParams.set("next", "/share-target");
    if (searchParams.url) loginUrl.searchParams.set("share_url", searchParams.url);
    if (searchParams.text) loginUrl.searchParams.set("share_text", searchParams.text);
    redirect(loginUrl.toString());
  }

  // Extract shared URL
  // The URL can come from:
  // 1. ?url= parameter (direct share)
  // 2. ?text= parameter (some apps put URL in text)
  let sharedUrl = searchParams.url || "";

  // If no URL in url param, try to extract from text
  if (!sharedUrl && searchParams.text) {
    const urlMatch = searchParams.text.match(
      /https?:\/\/[^\s]+/i,
    );
    if (urlMatch) {
      sharedUrl = urlMatch[0];
    }
  }

  // If still no URL, show error
  if (!sharedUrl) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 bg-zinc-50 dark:bg-zinc-950">
        <div className="text-center space-y-4 max-w-sm">
          <div className="w-12 h-12 mx-auto flex items-center justify-center bg-red-100 dark:bg-red-900/30">
            <svg
              className="w-6 h-6 text-red-500"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="15" y1="9" x2="9" y2="15" />
              <line x1="9" y1="9" x2="15" y2="15" />
            </svg>
          </div>
          <h1 className="mono text-sm font-medium text-zinc-900 dark:text-zinc-100 uppercase tracking-wider">
            URL Bulunamadı
          </h1>
          <p className="text-sm text-zinc-500">
            Paylaşılan içerikte geçerli bir URL bulunamadı.
          </p>
          <a
            href="/feed"
            className="inline-block mt-4 px-4 py-2 text-sm bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors"
          >
            Arşive Dön
          </a>
        </div>
      </div>
    );
  }

  // Fetch user's collections for the selector
  const { data: collections } = await supabase
    .from("collections")
    .select("id, name, is_default")
    .eq("user_id", user.id)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: true });

  return (
    <ShareTargetClient
      sharedUrl={sharedUrl}
      sharedText={searchParams.text}
      collections={(collections as Collection[]) ?? []}
    />
  );
}
