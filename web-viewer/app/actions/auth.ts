"use server";
/**
 * auth.ts — Authentication actions.
 *
 * signOut      — signs out the current session and redirects to /login.
 * deleteAccount — calls the delete-account Edge Function (which holds the
 *                service-role key) so the web viewer never needs it.
 */
import { createServerClient } from "@/lib/supabase";
import { requireAuth } from "@/lib/server-auth";
import type { ActionResult } from "@/lib/action-result";
import { ok, fail } from "@/lib/action-result";

export async function signOut(): Promise<void> {
  const { redirect } = await import("next/navigation");
  const supabase = createServerClient();
  await supabase.auth.signOut();
  redirect("/login");
}

/**
 * Permanently deletes the authenticated user's account.
 *
 * Delegates the heavy lifting to the delete-account Edge Function so that
 * SUPABASE_SERVICE_ROLE_KEY never needs to be present in the web-viewer
 * environment.
 *
 * The Edge Function:
 *   1. Verifies the JWT
 *   2. Deletes thumbnails/{userId}/* from Storage
 *   3. Calls auth.admin.deleteUser() → cascades all DB rows
 */
export async function deleteAccount(): Promise<ActionResult<void>> {
  try {
    const { session } = await requireAuth();

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey     = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !anonKey) {
      return fail("Sunucu yapılandırma hatası.");
    }

    const res = await fetch(`${supabaseUrl}/functions/v1/delete-account`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        apikey: anonKey,
        "Content-Type": "application/json",
      },
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      const message = (body as { error?: string }).error ?? `HTTP ${res.status}`;
      return fail("Hesap silinirken bir hata oluştu: " + message);
    }

    return ok(undefined);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Bilinmeyen hata";
    return fail(message);
  }
}
