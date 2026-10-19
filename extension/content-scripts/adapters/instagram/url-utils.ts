/**
 * adapters/instagram/url-utils.ts
 * Instagram URL normalization and permalink extraction.
 */

import type { NormalizedPostLink } from "../../../shared/platform";
import {
  INSTAGRAM_ORIGIN,
  PATH_PATTERNS,
  SHORTCODE_RE,
} from "./selectors";

// ─────────────────────────────────────────────────────────────────────────────
// URL Parsing
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Safely converts an href string to a URL object.
 * Relative URLs are completed with instagram.com origin.
 */
function toURL(href: string): URL | null {
  try {
    const base = href.startsWith("/") ? INSTAGRAM_ORIGIN : undefined;
    return new URL(href, base);
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Normalizes an Instagram URL to canonical form.
 *
 * @param rawHref - Raw URL or href attribute value
 * @returns Normalized link or null if invalid
 */
export function normalizeInstagramMediaUrl(
  rawHref: string
): NormalizedPostLink | null {
  const url = toURL(rawHref);
  if (!url) return null;

  // Reject non-Instagram URLs
  if (url.hostname !== "www.instagram.com" && url.hostname !== "instagram.com") {
    return null;
  }

  // Parse path segments: ["", "reel", "ABC123", ""] → ["reel", "ABC123"]
  const segments = url.pathname.split("/").filter(Boolean);
  if (segments.length < 2) return null;

  const [typeSegment, shortcode, ...rest] = segments;

  // Validate shortcode format
  if (!shortcode || !SHORTCODE_RE.test(shortcode)) return null;

  // Reject sub-pages (liked_by, comments, activity)
  if (rest.length > 0) {
    const forbiddenSubs = ["liked_by", "comments", "activity"];
    if (forbiddenSubs.includes(rest[0])) return null;
  }

  // Find matching pattern
  const pattern = PATH_PATTERNS.find((p) => p.segment === typeSegment);
  if (!pattern) return null;

  // Reject category pages (/reels/audio/, /reels/saved/, etc.)
  const EXCLUDED_SECOND_SEGMENTS = new Set(["audio", "saved", "suggested"]);
  if (EXCLUDED_SECOND_SEGMENTS.has(shortcode)) return null;

  const canonicalUrl = `${INSTAGRAM_ORIGIN}/${pattern.canonical}/${shortcode}/`;

  return {
    id: shortcode,
    canonicalUrl,
    postType: pattern.mediaType,
  };
}

/**
 * Finds the first valid Instagram media link within an element.
 * Prefers specific post/reel links over unknown types.
 */
export function findNormalizedLinkInRoot(
  root: Element
): NormalizedPostLink | null {
  const anchors = root.querySelectorAll<HTMLAnchorElement>("a[href]");
  let fallback: NormalizedPostLink | null = null;

  for (const anchor of Array.from(anchors)) {
    const normalized = normalizeInstagramMediaUrl(anchor.href);
    if (!normalized) continue;
    if (normalized.postType !== "unknown") return normalized;
    if (!fallback) fallback = normalized;
  }

  return fallback;
}

/**
 * Canonicalizes an Instagram URL for deduplication.
 */
export function canonicalizeInstagramUrl(rawUrl: string): string | null {
  const normalized = normalizeInstagramMediaUrl(rawUrl);
  return normalized?.canonicalUrl ?? null;
}

/**
 * Extracts shortcode from a path string.
 */
export function shortcodeFromPath(path: string): string | null {
  return path.match(/\/(?:p|reel|reels|tv)\/([\w-]{8,15})/)?.[1] ?? null;
}
