/**
 * canonicalizeUrl.ts
 * Converts raw social-media post URLs to a stable canonical form for deduplication.
 *
 * Rules:
 *  Instagram — strips query/hash, normalises host to www.instagram.com,
 *              normalises /reels/ → /reel/, handles /username/type/code patterns.
 *  X/Twitter — normalises twitter.com → x.com, strips tracking params (s, t,
 *              ref_src …), extracts tweet ID and returns
 *              https://x.com/i/web/status/{id} (username-independent form).
 *
 * Returns null for unrecognised or non-media URLs.
 */

export type Platform = "instagram" | "x";

const IG_HOSTS = new Set(["www.instagram.com", "instagram.com"]);
const X_HOSTS  = new Set(["x.com", "twitter.com", "www.x.com", "www.twitter.com"]);
const IG_TYPES = new Set(["p", "reel", "reels", "tv"]);

const SHORTCODE_RE = /^[\w-]+$/;
const TWEET_ID_RE  = /^\d+$/;

// ── Instagram ────────────────────────────────────────────────────────────────

function canonicalInstagram(url: URL): string | null {
  const parts = url.pathname.split("/").filter(Boolean);

  // Try at offset 0 (/type/shortcode) and offset 1 (/username/type/shortcode)
  for (let offset = 0; offset <= 1; offset++) {
    const typeSegment = parts[offset];
    const shortcode   = parts[offset + 1];
    if (!typeSegment || !IG_TYPES.has(typeSegment)) continue;
    if (!shortcode || !SHORTCODE_RE.test(shortcode)) continue;

    // Reject sub-pages (liked_by, comments, activity)
    const sub = parts[offset + 2];
    if (sub && ["liked_by", "comments", "activity"].includes(sub)) return null;

    const type = typeSegment === "reels" ? "reel" : typeSegment;
    return `https://www.instagram.com/${type}/${shortcode}/`;
  }

  return null;
}

// ── X / Twitter ──────────────────────────────────────────────────────────────

function canonicalX(url: URL): string | null {
  const parts = url.pathname.split("/").filter(Boolean);
  // Works for: /username/status/id, /i/web/status/id, /i/status/id
  const statusIdx = parts.lastIndexOf("status");
  if (statusIdx >= 0) {
    const id = parts[statusIdx + 1];
    if (id && TWEET_ID_RE.test(id)) {
      return `https://x.com/i/web/status/${id}`;
    }
  }
  return null;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Returns the canonical URL for a social-media post, or null if the URL
 * cannot be recognised as a saveable media post.
 *
 * @example
 * canonicalizeUrl("https://twitter.com/user/status/123?s=20", "x")
 * // → "https://x.com/i/web/status/123"
 *
 * canonicalizeUrl("https://www.instagram.com/reels/ABC123/?igshid=xyz", "instagram")
 * // → "https://www.instagram.com/reel/ABC123/"
 */
export function canonicalizeUrl(rawUrl: string, platform: Platform): string | null {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }

  if (platform === "instagram") {
    return IG_HOSTS.has(url.hostname) ? canonicalInstagram(url) : null;
  }
  if (platform === "x") {
    return X_HOSTS.has(url.hostname) ? canonicalX(url) : null;
  }
  return null;
}
