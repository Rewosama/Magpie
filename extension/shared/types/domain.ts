/**
 * Shared TypeScript domain types
 * Used by the Chrome Extension and Web Viewer components.
 *
 * Requirements: 7.1–7.11, 14.1, 14.2
 */

// ── Core database entities ──────────────────────────────────────────────────

/**
 * A user-defined named group for organising SavedPosts.
 * Mirrors the `collections` database table (Requirement 14.1).
 */
export interface Collection {
  /** UUID primary key */
  id: string;
  /** UUID of the owning user (auth.users reference) */
  user_id: string;
  /** Collection display name (1–255 characters) */
  name: string;
  /** ISO 8601 UTC creation timestamp */
  created_at: string;
  /** Whether this is the user's default save target (at most one per user) */
  is_default: boolean;
  /** True when this is a shared collection the user has collaborator access to */
  is_shared?: boolean;
  /** For shared collections: the user's role ('collaborator') */
  member_role?: string;
}

/**
 * A single captured social media post and all its extracted metadata.
 * Mirrors the `saved_posts` database table (Requirement 14.2).
 */
export interface SavedPost {
  /** UUID primary key */
  id: string;
  /** UUID of the owning user */
  user_id: string;
  /** Full URL of the original post */
  post_url: string | null;
  /** Specific content type on the source platform */
  post_type: "post" | "reel" | "story" | "tweet" | null;
  /** Source social media platform */
  platform: "instagram" | "x" | null;
  /** Author's handle / username */
  author_username: string | null;
  /** Author's display / full name */
  author_display_name: string | null;
  /** URL of the author's profile avatar */
  author_avatar_url: string | null;
  /** Caption text or tweet body */
  content_text: string | null;
  /** Absolute URLs of all images and videos in the post (excludes avatar) */
  media_urls: string[] | null;
  /** ISO 8601 UTC original publication timestamp */
  post_timestamp: string | null;
  /** ISO 8601 UTC timestamp when the post was archived (Requirement 7.10) */
  saved_at: string;
  /** UUID of the assigned Collection; null when no collection or after collection deletion */
  collection_id: string | null;
  /** Platform-specific data not captured by other fields (Requirement 7.11) */
  raw_metadata: Record<string, unknown> | null;
}

// ── Partial scraped data (Content Script output) ────────────────────────────

/**
 * Scraped metadata extracted from the DOM at save-time.
 * `post_url` is the only required field; all other fields may be null if the
 * DOM element does not expose them (Requirements 7.1–7.12).
 * Returning null from extraction signals a missing `post_url` and aborts
 * the save (Requirement 7.13).
 */
export interface PostMetadata {
  /** Required — save is aborted if this cannot be extracted (Requirement 7.13) */
  post_url: string;
  /** Detected content type on the platform */
  post_type: "post" | "reel" | "story" | "tweet";
  /** Platform the post was scraped from */
  platform: "instagram" | "x";
  author_username: string | null;
  author_display_name: string | null;
  author_avatar_url: string | null;
  content_text: string | null;
  /** Absolute media URLs collected from the post element */
  media_urls: string[];
  /** ISO 8601 UTC original publication timestamp */
  post_timestamp: string | null;
  /** Platform-specific extra data (Requirement 7.11) */
  raw_metadata: Record<string, unknown>;
}

// ── Extension ↔ Edge Function request / response contracts ──────────────────

/**
 * Payload sent by the Background Service Worker to the `save-post` Edge
 * Function (Requirement 8.1).
 */
export interface SavePostRequest {
  /** Required: full URL of the post to save */
  post_url: string;
  /** Required: UUID of the target Collection */
  collection_id: string;
  post_type: string;
  platform: string;
  author_username?: string | null;
  author_display_name?: string | null;
  author_avatar_url?: string | null;
  content_text?: string | null;
  media_urls?: string[] | null;
  /** ISO 8601 UTC */
  post_timestamp?: string | null;
  raw_metadata?: Record<string, unknown> | null;
}

/**
 * Successful response body returned by the `save-post` Edge Function
 * (Requirements 8.3, 8.4).
 */
export interface SavePostResponse {
  /** UUID of the created or updated saved_posts row */
  id: string;
  /** "created" → HTTP 201 (new row); "updated" → HTTP 200 (existing row updated) */
  status: "created" | "updated";
}

// ── Collection management ───────────────────────────────────────────────────

/** The operations supported by the `manage-collection` Edge Function */
export type ManageCollectionOperation = "list" | "create" | "rename" | "delete" | "set_default";

/**
 * Payload sent by the Background Service Worker to the `manage-collection`
 * Edge Function (Requirement 9.1).
 */
export interface ManageCollectionRequest {
  /** Which operation to perform */
  operation: ManageCollectionOperation;
  /** Required for "rename" and "delete" operations (Requirement 9.10) */
  collection_id?: string;
  /** Required for "create" and "rename" operations (Requirement 9.9) */
  name?: string;
}

/**
 * Discriminated union of all successful response shapes returned by the
 * `manage-collection` Edge Function.
 */
export type ManageCollectionResponse =
  | { operation: "list"; collections: Collection[] }
  | { operation: "create"; collection: Collection }
  | { operation: "rename"; collection: Collection }
  | { operation: "delete"; deleted_id: string }
  | { operation: "set_default"; collection: Collection };

// ── Extension storage ────────────────────────────────────────────────────────

/**
 * Shape of the session object persisted in `chrome.storage.sync`
 * (Requirements 2.2, 2.4).
 */
export interface StoredSession {
  /** Supabase JWT for authorising Edge Function calls */
  jwt: string;
  /** Unix timestamp in seconds when the JWT expires (Requirement 1.3) */
  expiry: number;
  /** UUID of the authenticated user extracted from the JWT */
  user_id: string;
  /**
   * Supabase refresh token — used to silently obtain a new access JWT when
   * the current one expires. Storing this allows the extension to survive
   * Chrome restarts without requiring re-authentication.
   */
  refresh_token?: string;
}
