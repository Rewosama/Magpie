"use server";
/**
 * members.ts — Collection membership actions.
 * List members, revoke (owner removes a member), and self-leave.
 */
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { CollectionMember } from "@/lib/types";
import { requireAuth } from "@/lib/server-auth";
import { ok, fail, type ActionResult } from "@/lib/action-result";

// ── Zod schemas ───────────────────────────────────────────────────────────────
const uuidSchema = z.string().uuid("Geçersiz ID.");

// ── Actions ───────────────────────────────────────────────────────────────────

export async function getCollectionMembers(
  collectionId: string,
): Promise<ActionResult<{ members: CollectionMember[] }>> {
  const parsed = uuidSchema.safeParse(collectionId);
  if (!parsed.success) return fail(parsed.error.errors[0].message);

  try {
    const { supabase, session: _session } = await requireAuth();

    const { data, error } = await supabase.rpc("get_members_with_email", {
      p_collection_id: collectionId,
    });
    if (error) return fail(error.message);
    return ok({ members: (data as CollectionMember[]) ?? [] });
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Üyeler yüklenemedi.");
  }
}

export async function revokeCollectionMember(
  collectionId: string,
  memberUserId: string,
): Promise<ActionResult> {
  const colParsed    = uuidSchema.safeParse(collectionId);
  const memberParsed = uuidSchema.safeParse(memberUserId);
  if (!colParsed.success)    return fail(colParsed.error.errors[0].message);
  if (!memberParsed.success) return fail(memberParsed.error.errors[0].message);

  try {
    const { supabase, session } = await requireAuth();

    const { data: col } = await supabase
      .from("collections")
      .select("id")
      .eq("id", collectionId)
      .eq("user_id", session.user.id)
      .maybeSingle();

    if (!col) return fail("Bu koleksiyona erişim yetkiniz yok.");

    const { error } = await supabase
      .from("collection_members")
      .delete()
      .eq("collection_id", collectionId)
      .eq("member_user_id", memberUserId);

    if (error) return fail(error.message);
    revalidatePath("/feed");
    return ok(undefined);
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Üye kaldırma başarısız.");
  }
}

export async function leaveCollection(
  collectionId: string,
): Promise<ActionResult> {
  const parsed = uuidSchema.safeParse(collectionId);
  if (!parsed.success) return fail(parsed.error.errors[0].message);

  try {
    const { supabase, session } = await requireAuth();

    const { error } = await supabase
      .from("collection_members")
      .delete()
      .eq("collection_id", collectionId)
      .eq("member_user_id", session.user.id);

    if (error) return fail(error.message);
    revalidatePath("/feed");
    return ok(undefined);
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Koleksiyondan ayrılma başarısız.");
  }
}
