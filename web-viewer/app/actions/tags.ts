"use server";
/**
 * tags.ts — Tag management actions.
 *
 * Exports:
 *   getTags          — fetch all tags for the current user with post counts
 *   getPostTags      — fetch tags for a specific post
 *   createTag        — create a new tag
 *   deleteTag        — delete a tag (cascade removes post_tags)
 *   addTagToPost     — attach a tag to a post
 *   removeTagFromPost — detach a tag from a post
 */
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAuth } from "@/lib/server-auth";
import { ok, fail, type ActionResult } from "@/lib/action-result";
import type { Tag, TagWithCount } from "@/lib/types";

// ── Zod schemas ───────────────────────────────────────────────────────────────
const uuidSchema = z.string().uuid("Geçersiz ID.");
const tagNameSchema = z
  .string()
  .min(1, "Etiket adı boş olamaz.")
  .max(50, "Etiket adı en fazla 50 karakter olabilir.")
  .transform((s) => s.trim());

// ── getTags ───────────────────────────────────────────────────────────────────

/**
 * Fetches all tags for the current user with their post counts.
 * Sorted by name ascending.
 */
export async function getTags(): Promise<ActionResult<TagWithCount[]>> {
  try {
    const { supabase, session } = await requireAuth();

    // Get tags with post counts using a left join and group by
    const { data, error } = await supabase
      .from("tags")
      .select("id, user_id, name, created_at")
      .eq("user_id", session.user.id)
      .order("name", { ascending: true });

    if (error) return fail(error.message);

    // Get post counts for each tag
    const tagIds = (data ?? []).map((t) => t.id);
    const { data: counts } = await supabase
      .from("post_tags")
      .select("tag_id")
      .in("tag_id", tagIds.length > 0 ? tagIds : ["00000000-0000-0000-0000-000000000000"]);

    const countMap = new Map<string, number>();
    (counts ?? []).forEach((pt) => {
      countMap.set(pt.tag_id, (countMap.get(pt.tag_id) ?? 0) + 1);
    });

    const tags: TagWithCount[] = (data ?? []).map((t) => ({
      ...t,
      post_count: countMap.get(t.id) ?? 0,
    }));

    return ok(tags);
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Etiketler yüklenemedi.");
  }
}

// ── getPostTags ───────────────────────────────────────────────────────────────

/**
 * Fetches tags attached to a specific post.
 * Only returns tags owned by the current user.
 */
export async function getPostTags(postId: string): Promise<ActionResult<Tag[]>> {
  const parsed = uuidSchema.safeParse(postId);
  if (!parsed.success) return fail(parsed.error.errors[0].message);

  try {
    const { supabase } = await requireAuth();

    const { data, error } = await supabase
      .from("post_tags")
      .select("tags(id, user_id, name, created_at)")
      .eq("post_id", postId);

    if (error) return fail(error.message);

    // Extract tags from the nested structure
    const tags: Tag[] = (data ?? [])
      .map((pt) => (pt.tags as unknown) as Tag)
      .filter(Boolean);

    return ok(tags);
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Etiketler yüklenemedi.");
  }
}

// ── getTagsForPosts ───────────────────────────────────────────────────────────

/**
 * Fetches tags for multiple posts in a single query.
 * Returns a map of postId -> Tag[].
 */
export async function getTagsForPosts(
  postIds: string[]
): Promise<ActionResult<Record<string, Tag[]>>> {
  if (postIds.length === 0) return ok({});

  try {
    const { supabase } = await requireAuth();

    const { data, error } = await supabase
      .from("post_tags")
      .select("post_id, tags(id, user_id, name, created_at)")
      .in("post_id", postIds);

    if (error) return fail(error.message);

    const result: Record<string, Tag[]> = {};
    (data ?? []).forEach((pt) => {
      const tag = (pt.tags as unknown) as Tag;
      if (!tag) return;
      if (!result[pt.post_id]) result[pt.post_id] = [];
      result[pt.post_id].push(tag);
    });

    return ok(result);
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Etiketler yüklenemedi.");
  }
}

// ── createTag ─────────────────────────────────────────────────────────────────

/**
 * Creates a new tag for the current user.
 * Returns the created tag, or an existing one if a tag with that name exists.
 */
export async function createTag(name: string): Promise<ActionResult<Tag>> {
  const parsed = tagNameSchema.safeParse(name);
  if (!parsed.success) return fail(parsed.error.errors[0].message);

  try {
    const { supabase, session } = await requireAuth();
    const tagName = parsed.data;

    // Try to insert; if it already exists, return the existing one
    const { data, error } = await supabase
      .from("tags")
      .upsert(
        { user_id: session.user.id, name: tagName },
        { onConflict: "user_id,name", ignoreDuplicates: false }
      )
      .select("id, user_id, name, created_at")
      .single();

    if (error) return fail(error.message);
    return ok(data as Tag);
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Etiket oluşturulamadı.");
  }
}

// ── deleteTag ─────────────────────────────────────────────────────────────────

/**
 * Deletes a tag. Cascade removes all post_tags associations.
 */
export async function deleteTag(tagId: string): Promise<ActionResult> {
  const parsed = uuidSchema.safeParse(tagId);
  if (!parsed.success) return fail(parsed.error.errors[0].message);

  try {
    const { supabase, session } = await requireAuth();

    const { error } = await supabase
      .from("tags")
      .delete()
      .eq("id", tagId)
      .eq("user_id", session.user.id);

    if (error) return fail(error.message);
    revalidatePath("/feed");
    return ok(undefined);
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Etiket silinemedi.");
  }
}

// ── addTagToPost ──────────────────────────────────────────────────────────────

/**
 * Attaches a tag to a post.
 * If the association already exists, this is a no-op.
 */
export async function addTagToPost(
  postId: string,
  tagId: string
): Promise<ActionResult> {
  const postParsed = uuidSchema.safeParse(postId);
  const tagParsed = uuidSchema.safeParse(tagId);
  if (!postParsed.success) return fail(postParsed.error.errors[0].message);
  if (!tagParsed.success) return fail(tagParsed.error.errors[0].message);

  try {
    const { supabase } = await requireAuth();

    const { error } = await supabase
      .from("post_tags")
      .upsert(
        { post_id: postId, tag_id: tagId },
        { onConflict: "post_id,tag_id", ignoreDuplicates: true }
      );

    if (error) return fail(error.message);
    revalidatePath("/feed");
    return ok(undefined);
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Etiket eklenemedi.");
  }
}

// ── removeTagFromPost ─────────────────────────────────────────────────────────

/**
 * Removes a tag from a post.
 */
export async function removeTagFromPost(
  postId: string,
  tagId: string
): Promise<ActionResult> {
  const postParsed = uuidSchema.safeParse(postId);
  const tagParsed = uuidSchema.safeParse(tagId);
  if (!postParsed.success) return fail(postParsed.error.errors[0].message);
  if (!tagParsed.success) return fail(tagParsed.error.errors[0].message);

  try {
    const { supabase } = await requireAuth();

    const { error } = await supabase
      .from("post_tags")
      .delete()
      .eq("post_id", postId)
      .eq("tag_id", tagId);

    if (error) return fail(error.message);
    revalidatePath("/feed");
    return ok(undefined);
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Etiket kaldırılamadı.");
  }
}

// ── createTagAndAddToPost ─────────────────────────────────────────────────────

/**
 * Creates a new tag (or finds existing) and immediately attaches it to a post.
 * Convenience function for the inline tag creation flow.
 */
export async function createTagAndAddToPost(
  postId: string,
  tagName: string
): Promise<ActionResult<Tag>> {
  const postParsed = uuidSchema.safeParse(postId);
  const nameParsed = tagNameSchema.safeParse(tagName);
  if (!postParsed.success) return fail(postParsed.error.errors[0].message);
  if (!nameParsed.success) return fail(nameParsed.error.errors[0].message);

  try {
    // First create or get the tag
    const tagResult = await createTag(nameParsed.data);
    if (!tagResult.ok) return tagResult;

    // Then add it to the post
    const addResult = await addTagToPost(postId, tagResult.data.id);
    if (!addResult.ok) return fail(addResult.error);

    return ok(tagResult.data);
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Etiket eklenemedi.");
  }
}
