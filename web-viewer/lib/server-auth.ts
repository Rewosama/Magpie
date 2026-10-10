/**
 * server-auth.ts
 * Shared authentication helper for server actions.
 * Consolidates the repetitive supabase-client + getSession() pattern.
 */
import { createServerClient } from "@/lib/supabase";
import type { Session } from "@supabase/auth-helpers-nextjs";
import type { SupabaseClient } from "@supabase/supabase-js";

interface AuthContext {
  supabase: SupabaseClient;
  session: Session;
}

/**
 * Creates a Supabase client and validates that a session exists.
 * Throws with "Not authenticated" when no session is found so callers
 * can wrap in try/catch or check the ActionResult from callers.
 */
export async function requireAuth(): Promise<AuthContext> {
  const supabase = createServerClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Oturum açmanız gerekiyor.");
  return { supabase, session };
}
