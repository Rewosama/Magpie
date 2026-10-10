/**
 * Supabase client helpers for the Web Viewer.
 *
 * - createServerClient  → use in Server Components and Route Handlers (reads cookies)
 * - createBrowserClient → use in Client Components (uses the singleton pattern)
 *
 * Requirements: 3.1
 */

import {
  createServerComponentClient,
  createRouteHandlerClient,
  createMiddlewareClient,
} from "@supabase/auth-helpers-nextjs";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import type { NextRequest, NextResponse } from "next/server";

// ── Environment variable assertions ──────────────────────────────────────────

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Missing required environment variables: NEXT_PUBLIC_SUPABASE_URL and/or NEXT_PUBLIC_SUPABASE_ANON_KEY. " +
      "Copy .env.example to .env.local and fill in your Supabase project credentials."
  );
}

// ── Server Component client ──────────────────────────────────────────────────

/**
 * Returns a Supabase client suitable for use inside async Server Components.
 * Reads the session from the Next.js cookie store.
 *
 * @example
 * ```ts
 * const supabase = createServerClient();
 * const { data: { session } } = await supabase.auth.getSession();
 * ```
 */
export function createServerClient() {
  return createServerComponentClient({ cookies });
}

// ── Route Handler client ─────────────────────────────────────────────────────

/**
 * Returns a Supabase client suitable for use inside Route Handlers (`route.ts`).
 * Pass the route handler's cookie store so the client can read/write the session.
 *
 * @example
 * ```ts
 * // app/auth/callback/route.ts
 * export async function GET(request: NextRequest) {
 *   const supabase = createRouteHandlerSupabaseClient(cookies);
 *   ...
 * }
 * ```
 */
export function createRouteHandlerSupabaseClient(
  cookieStore: ReturnType<typeof cookies>
) {
  return createRouteHandlerClient({ cookies: () => cookieStore });
}

// ── Middleware client ────────────────────────────────────────────────────────

/**
 * Returns a Supabase client for use inside `middleware.ts`.
 *
 * @example
 * ```ts
 * export async function middleware(req: NextRequest) {
 *   const res = NextResponse.next();
 *   const supabase = createMiddlewareSupabaseClient(req, res);
 *   await supabase.auth.getSession();
 *   return res;
 * }
 * ```
 */
export function createMiddlewareSupabaseClient(
  req: NextRequest,
  res: NextResponse
) {
  return createMiddlewareClient({ req, res });
}

// ── Browser (Client Component) client ───────────────────────────────────────

/**
 * Returns a Supabase client for use in Client Components.
 * This is a plain `createClient` call — auth-helpers' browser client is not
 * needed here because session handling is managed server-side via cookies.
 *
 * @example
 * ```tsx
 * "use client";
 * const supabase = createBrowserClient();
 * await supabase.auth.signInWithOAuth({ provider: "google" });
 * ```
 */
export function createBrowserClient() {
  return createClient(supabaseUrl!, supabaseAnonKey!);
}

// ── Service-Role (Admin) client ──────────────────────────────────────────────

/**
 * Returns a Supabase client using the service role key — bypasses RLS entirely.
 * ONLY import this inside Server Actions or Route Handlers.
 * NEVER import in Client Components, shared utilities, or anywhere accessible to the browser.
 */
export function createAdminClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    throw new Error(
      "Missing SUPABASE_SERVICE_ROLE_KEY. Add it to .env.local. " +
        "Never expose this key client-side."
    );
  }
  return createClient(supabaseUrl!, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
