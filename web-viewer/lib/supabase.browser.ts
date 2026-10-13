/**
 * Browser-side Supabase client.
 *
 * Kept in a separate module so Client Components can import `createBrowserClient`
 * without pulling in the `next/headers` import that lives in supabase.ts (which
 * is server-only). Bundling `next/headers` into the client bundle causes a
 * Next.js webpack error.
 *
 * Requirements: 3.1
 */

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * Returns a Supabase client for use in Client Components.
 * Session handling is managed server-side via cookies; this client is used
 * only for auth flows (e.g. signInWithOAuth) and public queries.
 *
 * @example
 * ```tsx
 * "use client";
 * const supabase = createBrowserClient();
 * await supabase.auth.signInWithOAuth({ provider: "google" });
 * ```
 */
export function createBrowserClient() {
  return createClient(supabaseUrl, supabaseAnonKey);
}
