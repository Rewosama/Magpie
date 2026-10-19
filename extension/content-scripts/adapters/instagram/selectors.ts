/**
 * adapters/instagram/selectors.ts
 * DOM selectors for Instagram.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Post Container Selectors
// ─────────────────────────────────────────────────────────────────────────────

/** Minimum container height to be considered valid (px) */
export const MIN_CONTAINER_HEIGHT = 100;

/** Maximum depth when walking up the DOM tree */
export const MAX_WALK_DEPTH = 30;

// ─────────────────────────────────────────────────────────────────────────────
// Button Position Selectors
// ─────────────────────────────────────────────────────────────────────────────

/** Like button SVG aria-labels */
export const LIKE_LABELS = [
  "Beğen",
  "Beğenmekten vazgeç",
  "Beğeniyi geri al",
  "Like",
  "Unlike",
];

/** Comment button SVG aria-labels */
export const COMMENT_LABELS = ["Yorum Yap", "Comment"];

/** Share button SVG aria-labels */
export const SHARE_LABELS = ["Gönderi Paylaş", "Paylaş", "Share", "Share Post"];

/** Like SVG selector */
export const LIKE_SEL =
  'svg[aria-label="Beğen"], svg[aria-label="Like"], svg[aria-label="Beğeniyi geri al"], svg[aria-label="Beğenmekten vazgeç"], svg[aria-label="Unlike"]';

/** Native save/bookmark SVG selector */
export const SAVE_SEL =
  'svg[aria-label="Kaydet"], svg[aria-label="Save"], svg[aria-label="Kaldır"], svg[aria-label="Remove"]';

/** More options SVG selector (for vertical reels bar) */
export const MORE_SEL = 'svg[aria-label="Daha fazla"], svg[aria-label="More"]';

// ─────────────────────────────────────────────────────────────────────────────
// URL Patterns
// ─────────────────────────────────────────────────────────────────────────────

export const INSTAGRAM_ORIGIN = "https://www.instagram.com";

/** Reserved path segments that are not usernames */
export const RESERVED_SEGMENTS = new Set([
  "p",
  "reel",
  "reels",
  "tv",
  "explore",
  "stories",
  "direct",
  "accounts",
  "tags",
  "locations",
]);

/** Pattern for matching /username/reels/ links */
export const REELS_USER_RE = /^\/([^/]+)\/reels\/$/;

/** Minimum image size to be considered content (not avatar/icon) */
export const MIN_IMG_PX = 200;

/** Valid shortcode character pattern */
export const SHORTCODE_RE = /^[\w-]+$/;

/** Instagram canonical path types and their mappings */
export const PATH_PATTERNS = [
  { segment: "reel", canonical: "reel", mediaType: "reel" as const },
  { segment: "reels", canonical: "reel", mediaType: "reel" as const },
  { segment: "p", canonical: "p", mediaType: "post" as const },
  { segment: "tv", canonical: "tv", mediaType: "igtv" as const },
] as const;
