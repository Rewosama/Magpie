"use server";
/**
 * sharing.ts — Invite code actions.
 * Generate, redeem, list active, and revoke single-use invite codes.
 * Only collection owners can generate or revoke codes.
 */
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { generateCode } from "@/lib/invite-code";
import type { ActiveInvite } from "@/lib/types";
import { requireAuth } from "@/lib/server-auth";
import { ok, fail, type ActionResult } from "@/lib/action-result";

// ── Zod schemas ───────────────────────────────────────────────────────────────
const uuidSchema     = z.string().uuid("Geçersiz koleksiyon ID.");
const inviteIdSchema = z.string().uuid("Geçersiz davet kodu ID.");
const roleSchema     = z.enum(["viewer", "collaborator"]);
const codeSchema     = z.string().regex(/^[A-Z0-9]{8}$/, "geçersiz kod");

// ── Actions ───────────────────────────────────────────────────────────────────

export async function generateInviteCode(
  collectionId: string,
  grantsRole: "viewer" | "collaborator" = "viewer",
): Promise<ActionResult<{ code: string; expiresAt: string }>> {
  const idParsed   = uuidSchema.safeParse(collectionId);
  const roleParsed = roleSchema.safeParse(grantsRole);
  if (!idParsed.success)   return fail(idParsed.error.errors[0].message);
  if (!roleParsed.success) return fail("Geçersiz rol değeri.");

  try {
    const { supabase, session } = await requireAuth();

    const { data: ownedCol } = await supabase
      .from("collections")
      .select("id")
      .eq("id", collectionId)
      .eq("user_id", session.user.id)
      .maybeSingle();

    if (!ownedCol) return fail("Yalnızca koleksiyon sahibi davet kodu oluşturabilir.");

    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    for (let attempt = 0; attempt < 5; attempt++) {
      const code = generateCode();
      const { error } = await supabase.from("collection_invites").insert({
        collection_id: collectionId,
        created_by: session.user.id,
        code,
        expires_at: expiresAt,
        grants_role: grantsRole,
      });
      if (!error) return ok({ code, expiresAt });
      if (error.code !== "23505") return fail(error.message);
    }
    return fail("Kod oluşturulamadı. Tekrar deneyin.");
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Kod oluşturma başarısız.");
  }
}

export async function joinCollectionViaCode(
  rawCode: string,
): Promise<ActionResult<{ collectionId: string; collectionName: string; memberRole: "viewer" | "collaborator" }>> {
  const normalised = rawCode.trim().toUpperCase();
  const parsed = codeSchema.safeParse(normalised);
  if (!parsed.success) return fail("geçersiz kod");

  try {
    const { supabase, session } = await requireAuth();

    const { data, error } = await supabase.rpc("redeem_invite", {
      p_code: normalised,
      p_user_id: session.user.id,
    });

    if (error) {
      const msg = error.message ?? "";
      if (msg.includes("UNAUTHORIZED"))           return fail("Oturum bilgisi geçersiz.");
      if (msg.includes("INVALID") || msg.includes("NOT_FOUND") ||
          msg.includes("ALREADY_USED") || msg.includes("EXPIRED")) return fail("geçersiz kod");
      if (msg.includes("RATE_LIMITED"))    return fail("Çok fazla başarısız deneme. 15 dakika sonra tekrar deneyin.");
      if (msg.includes("IS_OWNER"))        return fail("Kendi koleksiyonunuza üye olamazsınız");
      if (msg.includes("ALREADY_MEMBER")) return fail("Bu koleksiyona zaten üyesiniz");
      return fail(error.message);
    }

    const row = Array.isArray(data) ? data[0] : data;
    revalidatePath("/feed");
    return ok({
      collectionId:   row.collection_id,
      collectionName: row.collection_name,
      memberRole:     (row.member_role ?? "viewer") as "viewer" | "collaborator",
    });
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Katılma başarısız.");
  }
}

export async function getActiveInvites(
  collectionId: string,
): Promise<ActionResult<{ invites: ActiveInvite[] }>> {
  const parsed = uuidSchema.safeParse(collectionId);
  if (!parsed.success) return fail(parsed.error.errors[0].message);

  try {
    const { supabase, session: _session } = await requireAuth();

    const { data, error } = await supabase.rpc("get_active_invites", {
      p_collection_id: collectionId,
    });
    if (error) return fail(error.message);
    return ok({ invites: (data as ActiveInvite[]) ?? [] });
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Davet kodları yüklenemedi.");
  }
}

export async function revokeInviteCode(
  inviteId: string,
): Promise<ActionResult> {
  const parsed = inviteIdSchema.safeParse(inviteId);
  if (!parsed.success) return fail(parsed.error.errors[0].message);

  try {
    const { supabase, session } = await requireAuth();

    const { data: invite } = await supabase
      .from("collection_invites")
      .select("collection_id")
      .eq("id", inviteId)
      .maybeSingle();

    if (!invite) return fail("Kod bulunamadı.");

    const { data: col } = await supabase
      .from("collections")
      .select("id")
      .eq("id", invite.collection_id)
      .eq("user_id", session.user.id)
      .maybeSingle();

    if (!col) return fail("Bu işlem için yetkiniz yok.");

    const { error } = await supabase
      .from("collection_invites")
      .delete()
      .eq("id", inviteId);

    if (error) return fail(error.message);
    return ok(undefined);
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Kod iptali başarısız.");
  }
}
