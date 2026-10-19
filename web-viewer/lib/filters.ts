import type { FeedPost } from "./types";

/**
 * Filters posts by a case-insensitive substring match on `content_text`.
 *
 * - If `query` is empty or whitespace-only, returns all posts unchanged.
 * - Posts with `null` `content_text` are excluded when a query is active
 *   because they cannot satisfy the containment check.
 *
 * Satisfies Requirements 17.2, 17.3.
 */
export function applyTextFilter(posts: FeedPost[], query: string): FeedPost[] {
  const trimmed = query.trim();
  if (trimmed === "") {
    return posts;
  }

  const lowerQuery = trimmed.toLowerCase();
  return posts.filter(
    (post) => post.content_text?.toLowerCase().includes(lowerQuery) === true
  );
}

/**
 * Applies collection and text filters conjunctively (AND logic).
 *
 * - `collectionId`: when provided, keeps only posts whose `collection_id`
 *   equals that value (strict equality — Requirements 17.4, 17.5).
 * - `query`: delegated to `applyTextFilter` (Requirements 17.2, 17.3).
 *
 * Either filter may be omitted; omitting both returns all posts.
 */
export function applyFilters(
  posts: FeedPost[],
  filters: { collectionId?: string; query?: string }
): FeedPost[] {
  let result = posts;

  if (filters.collectionId !== undefined) {
    result = result.filter(
      (post) => post.collection_id === filters.collectionId
    );
  }

  result = applyTextFilter(result, filters.query ?? "");

  return result;
}
