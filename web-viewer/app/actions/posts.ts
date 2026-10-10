"use server";
/**
 * posts.ts — Saved post actions.
 *
 * Exports:
 *   getPosts    — cursor-based page fetch (24 posts, no OFFSET)
 *   deletePost  — single post deletion with Storage cleanup
 *   deletePosts — bulk post deletion with Storage cleanup
 */
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAuth } from "@/lib/server-auth";
import { ok, fail, type ActionResult } from "@/lib/action-result";
import type { FeedPost, PostCursor } from "@/lib/types";

// ── Constants ─────────────────────────────────────────────────────────────────
const PAGE_SIZE = 24;

/**
 * Explicit column list for saved_posts feed queries.
 * Excludes search_vector (tsvector) to avoid sending binary index data to the
 * client — it can be several KB per post for long captions.
 */
const FEED_SELECT =
  "id, user_id, post_url, post_type, platform, " +
  "author_username, author_display_name, author_avatar_url, " +
  "content_text, media_urls, post_timestamp, saved_at, " +
  "collection_id, raw_metadata, thumbnail_url, canonical_url, " +
  "collections(name)";

// ── Zod schemas ───────────────────────────────────────────────────────────────
const uuidSchema = z.string().uuid("Geçersiz post ID.");
const uuidArraySchema = z.array(uuidSchema).min(1, "En az bir post seçilmeli.");

const GetPostsSchema = z.object({
  collectionId: z.string().uuid().optional(),
  cursor: z
    .object({
      // Supabase returns timestamptz as ISO-8601 with microseconds + tz offset,
      // e.g. "2024-11-15T10:30:00.123456+00:00". We store it verbatim and let
      // URLSearchParams encode the '+' as '%2B' when passed to PostgREST.
      saved_at: z.string().min(1),
      id: z.string().uuid(),
    })
    .optional(),
});

// ── getPosts ──────────────────────────────────────────────────────────────────

export type GetPostsResult = {
  posts: FeedPost[];
  nextCursor: PostCursor | null;
};

/**
 * Fetches one page (PAGE_SIZE = 24) of saved posts using keyset/cursor pagination.
 *
 * Sort order: saved_at DESC, id DESC
 * Supported filters: collectionId (optional)
 *
 * Pass `cursor` (the value returned as `nextCursor` from the previous call) to
 * fetch the next page. Omit cursor for the first page.
 *
 * Returns `nextCursor: null` when there are no more posts.
 *
 * Called from:
 *   - PostCardList (client) for infinite-scroll subsequent pages
 *   - feed/page.tsx (server) for the initial page load
 */
export async function getPosts(
  params: z.infer<typeof GetPostsSchema>
): Promise<ActionResult<GetPostsResult>> {
  const parsed = GetPostsSchema.safeParse(params);
  if (!parsed.success) return fail(parsed.error.errors[0].message);

  try {
    const { supabase } = await requireAuth();
    const { collectionId, cursor } = parsed.data;

    // Fetch one extra row to detect whether a next page exists.
    let q = supabase
      .from("saved_posts")
      .select(FEED_SELECT)
      .order("saved_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(PAGE_SIZE + 1);

    if (collectionId) q = q.eq("collection_id", collectionId);

    if (cursor) {
      // Keyset cursor condition:
      //   (saved_at < cursor.saved_at)
      //   OR (saved_at = cursor.saved_at AND id < cursor.id)
      //
      // URLSearchParams will percent-encode '+' in the tz offset → '%2B',
      // which PostgREST decodes back to a valid timestamptz literal.
      q = q.or(
        `saved_at.lt.${cursor.saved_at},and(saved_at.eq.${cursor.saved_at},id.lt.${cursor.id})`
      );
    }

    const { data, error } = await q;
    if (error) return fail(error.message);

    const rows = (data ?? []) as unknown as FeedPost[];
    const hasMore = rows.length > PAGE_SIZE;
    const posts = hasMore ? rows.slice(0, PAGE_SIZE) : rows;
    const last = posts[posts.length - 1];
    const nextCursor: PostCursor | null =
      hasMore && last ? { saved_at: last.saved_at, id: last.id } : null;

    return ok({ posts, nextCursor });
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Postlar yüklenemedi.");
  }
}

// ── Storage helpers ───────────────────────────────────────────────────────────
function storagePathFromThumbnailUrl(url: string): string | null {
  try {
    const marker = "/thumbnails/";
    const idx = new URL(url).pathname.indexOf(marker);
    if (idx === -1) return null;
    return new URL(url).pathname.slice(idx + marker.length);
  } catch {
    return null;
  }
}

function collectStoragePaths(post: {
  thumbnail_url?: string | null;
  author_avatar_url?: string | null;
}): string[] {
  const paths: string[] = [];
  if (post.thumbnail_url) {
    const p = storagePathFromThumbnailUrl(post.thumbnail_url);
    if (p) paths.push(p);
  }
  if (post.author_avatar_url?.includes("/thumbnails/")) {
    const p = storagePathFromThumbnailUrl(post.author_avatar_url);
    if (p) paths.push(p);
  }
  return paths;
}

// ── deletePost ────────────────────────────────────────────────────────────────

export async function deletePost(postId: string): Promise<ActionResult> {
  const parsed = uuidSchema.safeParse(postId);
  if (!parsed.success) return fail(parsed.error.errors[0].message);

  try {
    const { supabase, session } = await requireAuth();

    const { data: post } = await supabase
      .from("saved_posts")
      .select("thumbnail_url, author_avatar_url")
      .eq("id", postId)
      .eq("user_id", session.user.id)
      .maybeSingle();

    const { error } = await supabase
      .from("saved_posts")
      .delete()
      .eq("id", postId)
      .eq("user_id", session.user.id);

    if (error) return fail(error.message);

    if (post) {
      const paths = collectStoragePaths(post);
      if (paths.length > 0)
        await supabase.storage.from("thumbnails").remove(paths).catch(() => {});
    }

    revalidatePath("/feed");
    return ok(undefined);
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Silme başarısız.");
  }
}

// ── deletePosts ───────────────────────────────────────────────────────────────

export async function deletePosts(postIds: string[]): Promise<ActionResult> {
  const parsed = uuidArraySchema.safeParse(postIds);
  if (!parsed.success) return fail(parsed.error.errors[0].message);
  if (parsed.data.length === 0) return ok(undefined);

  try {
    const { supabase, session } = await requireAuth();

    const { data: posts } = await supabase
      .from("saved_posts")
      .select("thumbnail_url, author_avatar_url")
      .in("id", parsed.data)
      .eq("user_id", session.user.id);

    const { error } = await supabase
      .from("saved_posts")
      .delete()
      .in("id", parsed.data)
      .eq("user_id", session.user.id);

    if (error) return fail(error.message);

    if (posts?.length) {
      const storagePaths = posts.flatMap(collectStoragePaths);
      if (storagePaths.length > 0)
        await supabase.storage.from("thumbnails").remove(storagePaths).catch(() => {});
    }

    revalidatePath("/feed");
    return ok(undefined);
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Toplu silme başarısız.");
  }
}

// ── movePost ──────────────────────────────────────────────────────────────────

/**
 * Moves a post to a different collection (or uncategorized if null).
 * Only the post owner can move their own posts.
 */
export async function movePost(
  postId: string,
  collectionId: string | null,
): Promise<ActionResult> {
  const parsed = uuidSchema.safeParse(postId);
  if (!parsed.success) return fail(parsed.error.errors[0].message);

  if (collectionId !== null) {
    const colParsed = uuidSchema.safeParse(collectionId);
    if (!colParsed.success) return fail(colParsed.error.errors[0].message);
  }

  try {
    const { supabase, session } = await requireAuth();

    const { error } = await supabase
      .from("saved_posts")
      .update({ collection_id: collectionId })
      .eq("id", postId)
      .eq("user_id", session.user.id);

    if (error) return fail(error.message);
    revalidatePath("/feed");
    return ok(undefined);
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Taşıma başarısız.");
  }
}
