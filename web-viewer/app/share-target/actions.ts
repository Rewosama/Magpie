"use server";

/**
 * Share Target Server Actions
 *
 * Handles saving posts shared via Web Share Target.
 * Includes server-side metadata fetching with SSRF protection.
 */

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAuth } from "@/lib/server-auth";
import { ok, fail, type ActionResult } from "@/lib/action-result";
import { validatePostUrl } from "@/lib/ssrf-guard";
import { fetchPostMetadata } from "@/lib/metadata-fetcher";
import type { Platform } from "@/lib/canonicalizeUrl";

// ── Zod Schemas ───────────────────────────────────────────────────────────────

const SaveSharedPostSchema = z.object({
  url: z.string().min(1, "URL gerekli.").max(2048, "URL çok uzun."),
  canonicalUrl: z.string().min(1, "Canonical URL gerekli."),
  platform: z.enum(["instagram", "x", "threads"]),
  collectionId: z.string().uuid().nullable(),
});

type SaveSharedPostInput = z.infer<typeof SaveSharedPostSchema>;

// ── Save Action ───────────────────────────────────────────────────────────────

export async function saveSharedPost(
  input: SaveSharedPostInput,
): Promise<ActionResult<{ postId: string }>> {
  // Validate input
  const parsed = SaveSharedPostSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.errors[0].message);
  }

  const { url, canonicalUrl, platform, collectionId } = parsed.data;

  // Validate URL for SSRF protection
  const urlValidation = validatePostUrl(url);
  if (!urlValidation.ok) {
    return fail(urlValidation.error);
  }

  try {
    const { supabase, session } = await requireAuth();

    // Check for duplicate (same canonical URL for this user)
    const { data: existing } = await supabase
      .from("saved_posts")
      .select("id")
      .eq("user_id", session.user.id)
      .eq("canonical_url", canonicalUrl)
      .maybeSingle();

    if (existing) {
      return fail("Bu post zaten arşivinde kayıtlı.");
    }

    // Fetch metadata (with timeout, won't throw)
    const metadata = await fetchPostMetadata(url, platform as Platform);

    // Prepare post data
    const postData = {
      user_id: session.user.id,
      post_url: url,
      canonical_url: canonicalUrl,
      platform,
      post_type: metadata.postType,
      author_username: metadata.authorUsername,
      author_display_name: metadata.authorDisplayName,
      author_avatar_url: metadata.authorAvatarUrl,
      content_text: metadata.contentText,
      thumbnail_url: metadata.thumbnailUrl,
      collection_id: collectionId,
      // Store metadata fetch status in raw_metadata
      raw_metadata: {
        metadata_incomplete: metadata.incomplete,
        shared_via: "web_share_target",
        shared_at: new Date().toISOString(),
      },
    };

    // Insert post
    const { data: post, error } = await supabase
      .from("saved_posts")
      .insert(postData)
      .select("id")
      .single();

    if (error) {
      console.error("Failed to save shared post:", error);
      return fail("Post kaydedilemedi: " + error.message);
    }

    revalidatePath("/feed");
    return ok({ postId: post.id });
  } catch (e) {
    console.error("saveSharedPost error:", e);
    return fail(e instanceof Error ? e.message : "Bir hata oluştu.");
  }
}
