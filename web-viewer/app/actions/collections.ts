"use server";
/**
 * collections.ts — Collection management actions.
 * Rename and default-collection operations; only owners can modify.
 */
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAuth } from "@/lib/server-auth";
import { ok, fail, type ActionResult } from "@/lib/action-result";

// ── Zod schemas ───────────────────────────────────────────────────────────────
const uuidSchema        = z.string().uuid("Geçersiz koleksiyon ID.");
const collectionName    = z.string().min(1, "Ad boş olamaz.").max(255, "Ad çok uzun.");

// ── Actions ───────────────────────────────────────────────────────────────────

export async function renameCollection(
  collectionId: string,
  newName: string,
): Promise<ActionResult> {
  const idParsed   = uuidSchema.safeParse(collectionId);
  const nameParsed = collectionName.safeParse(newName.trim());
  if (!idParsed.success)   return fail(idParsed.error.errors[0].message);
  if (!nameParsed.success) return fail(nameParsed.error.errors[0].message);

  try {
    const { supabase, session } = await requireAuth();

    const { error } = await supabase
      .from("collections")
      .update({ name: nameParsed.data })
      .eq("id", collectionId)
      .eq("user_id", session.user.id);

    if (error) return fail(error.message);
    revalidatePath("/feed");
    return ok(undefined);
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Yeniden adlandırma başarısız.");
  }
}

export async function setDefaultCollection(
  collectionId: string,
): Promise<ActionResult> {
  const parsed = uuidSchema.safeParse(collectionId);
  if (!parsed.success) return fail(parsed.error.errors[0].message);

  try {
    const { supabase, session } = await requireAuth();

    await supabase
      .from("collections")
      .update({ is_default: false })
      .eq("user_id", session.user.id)
      .eq("is_default", true);

    const { error } = await supabase
      .from("collections")
      .update({ is_default: true })
      .eq("id", collectionId)
      .eq("user_id", session.user.id);

    if (error) return fail(error.message);
    revalidatePath("/feed");
    return ok(undefined);
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Varsayılan ayarlama başarısız.");
  }
}
