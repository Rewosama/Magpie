"use server";

/**
 * URL Save Server Action
 *
 * Handles saving posts by URL (web interface).
 * Fetches metadata server-side using embed endpoints.
 */

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAuth } from "@/lib/server-auth";
import { ok, fail, type ActionResult } from "@/lib/action-result";
import { validatePostUrl } from "@/lib/ssrf-guard";
import { fetchPostMetadata } from "@/lib/metadata-fetcher";
import type { Platform } from "@/lib/canonicalizeUrl";

// ── Zod Schemas ───────────────────────────────────────────────────────────────

const SavePostByUrlSchema = z.object({
  url: z.string().min(1, "URL gerekli.").max(2048, "URL çok uzun."),
  canonicalUrl: z.string().min(1, "Canonical URL gerekli."),
  platform: z.enum(["instagram", "x", "threads"]),
  collectionId: z.string().uuid().nullable(),
});

type SavePostByUrlInput = z.infer<typeof SavePostByUrlSchema>;

// ── Save Action ───────────────────────────────────────────────────────────────

export async function savePostByUrl(
  input: SavePostByUrlInput,
): Promise<ActionResult<{ postId: string }>> {
  // Validate input
  const parsed = SavePostByUrlSchema.safeParse(input);
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

    // Fetch metadata from embed endpoints
    console.log(`[url-save] Fetching metadata for ${platform}: ${url}`);
    const metadata = await fetchPostMetadata(url, platform as Platform);
    console.log(`[url-save] Metadata result:`, {
      incomplete: metadata.incomplete,
      hasAuthor: !!metadata.authorUsername,
      hasContent: !!metadata.contentText,
      hasThumbnail: !!metadata.thumbnailUrl,
    });

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
        added_via: "url_paste",
        added_at: new Date().toISOString(),
      },
    };

    // Insert post
    const { data: post, error } = await supabase
      .from("saved_posts")
      .insert(postData)
      .select("id")
      .single();

    if (error) {
      console.error("[url-save] Failed to save post:", error);
      return fail("Post kaydedilemedi: " + error.message);
    }

    revalidatePath("/feed");
    return ok({ postId: post.id });
  } catch (e) {
    console.error("[url-save] Error:", e);
    return fail(e instanceof Error ? e.message : "Bir hata oluştu.");
  }
}
