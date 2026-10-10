/**
 * Web Viewer domain types.
 *
 * These types are local to the web-viewer package and mirror the
 * shared domain types from the extension, extended with joined relations
 * returned by Supabase queries.
 */

// ── Base entity ──────────────────────────────────────────────────────────────

/**
 * A single archived social media post as stored in `saved_posts`.
 * Mirrors the database table defined in Requirement 14.2.
 */
export interface SavedPost {
  id: string;
  user_id: string;
  post_url: string | null;
  post_type: "post" | "reel" | "story" | "tweet" | null;
  platform: "instagram" | "x" | null;
  author_username: string | null;
  author_display_name: string | null;
  author_avatar_url: string | null;
  content_text: string | null;
  media_urls: string[] | null;
  post_timestamp: string | null;
  saved_at: string;
  collection_id: string | null;
  raw_metadata: Record<string, unknown> | null;
  /** Persisted thumbnail URL uploaded to Supabase Storage (Requirement 19.5). */
  thumbnail_url?: string | null;
  /** Canonical URL for cross-format deduplication (migration 019). */
  canonical_url?: string | null;
}

/**
 * A user-defined named group for organising SavedPosts.
 * Mirrors the `collections` database table (Requirement 14.1).
 */
export interface Collection {
  id: string;
  name: string;
  is_default: boolean;
}

// ── Pagination ───────────────────────────────────────────────────────────────

/**
 * Opaque cursor for keyset pagination over saved_posts.
 * The sort order is (saved_at DESC, id DESC).
 * Passing this to getPosts fetches the page *after* the row identified by
 * (saved_at, id) — no OFFSET, O(log n) index seek at any depth.
 */
export interface PostCursor {
  saved_at: string; // timestamptz ISO string as returned by Supabase
  id: string;       // UUID of the last post on the current page
}

// ── Query result type ────────────────────────────────────────────────────────

/**
 * A SavedPost enriched with the joined collection name.
 *
 * Returned by the Supabase query:
 *   `supabase.from('saved_posts').select('*, collections(name)')`
 *
 * The `collections` field is `null` when the post has no assigned collection
 * or the collection was deleted (ON DELETE SET NULL — Requirement 14.5).
 */
export interface FeedPost extends SavedPost {
  collections: { name: string } | null;
}

/** A collection shared with the current user by another owner. */
export interface SharedCollection {
  collection_id: string;
  collection_name: string;
  owner_email: string;
  joined_at: string;
  /** "viewer" = read-only (Paylaşımlı); "collaborator" = can add/delete own posts (Ortak) */
  member_role: "viewer" | "collaborator";
}

/** A member of an owned collection, as returned by getCollectionMembers. */
export interface CollectionMember {
  member_user_id: string;
  email: string;
  joined_at: string;
  invite_code: string | null;
  is_owner: boolean;
  member_role: string;
}

/** An active (unused, non-expired) invite code. */
export interface ActiveInvite {
  invite_id: string;
  code: string;
  grants_role: "viewer" | "collaborator";
  expires_at: string;
  created_by: string;
  creator_email: string;
}
