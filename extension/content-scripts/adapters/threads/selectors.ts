/**
 * adapters/threads/selectors.ts
 * DOM selectors for Threads.
 *
 * Note: Threads is a Meta platform sharing some patterns with Instagram.
 * These selectors may need updates as Threads UI evolves.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Post Container
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Thread post container selectors.
 * Threads uses a similar structure to Instagram.
 */
export const THREADS_POST_SELECTOR = 'div[data-pressable-container="true"]';

/** Fallback: article elements */
export const THREADS_ARTICLE_SELECTOR = "article";

// ─────────────────────────────────────────────────────────────────────────────
// Within Post Selectors
// ─────────────────────────────────────────────────────────────────────────────

export const WITHIN_THREAD = {
  /** Profile link containing username */
  profileLink: 'a[href^="/@"]',
  /** Post content text */
  postText: 'div[dir="auto"]',
  /** Post link (for extracting thread ID) */
  postLink: 'a[href*="/post/"]',
  /** Timestamp */
  timestamp: "time[datetime]",
  /** Images */
  photo: "img",
  /** Video */
  video: "video",
  /** Action buttons container */
  actionBar: 'div[role="group"]',
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Button Positioning
// ─────────────────────────────────────────────────────────────────────────────

/** Like button aria-labels (multiple languages) */
export const LIKE_LABELS = ["Like", "Beğen", "Unlike", "Beğeniyi geri al"];

/** Reply button aria-labels */
export const REPLY_LABELS = ["Reply", "Yanıtla"];

/** Share button aria-labels */
export const SHARE_LABELS = ["Share", "Paylaş"];

// ─────────────────────────────────────────────────────────────────────────────
// URL Patterns
// ─────────────────────────────────────────────────────────────────────────────

export const THREADS_ORIGIN = "https://www.threads.net";

export const THREADS_HOSTS = new Set([
  "www.threads.net",
  "threads.net",
]);

/** Thread ID pattern (alphanumeric) */
export const THREAD_ID_RE = /^[A-Za-z0-9_-]+$/;
