/**
 * adapters/x/url-utils.ts
 * X/Twitter URL normalization.
 */

import type { NormalizedPostLink } from "../../../shared/platform";
import { X_HOSTS, TWEET_ID_RE } from "./selectors";

// ─────────────────────────────────────────────────────────────────────────────
// URL Canonicalization
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Converts an X/Twitter URL to canonical form.
 * Strips tracking params and normalizes to x.com/i/web/status/{id}
 */
export function canonicalizeXUrl(rawUrl: string): string | null {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }

  if (!X_HOSTS.has(url.hostname)) return null;

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

/**
 * Extracts normalized post link from an X URL.
 */
export function normalizeXUrl(rawUrl: string): NormalizedPostLink | null {
  const canonical = canonicalizeXUrl(rawUrl);
  if (!canonical) return null;

  // Extract tweet ID from canonical URL
  const match = canonical.match(/\/status\/(\d+)/);
  if (!match) return null;

  return {
    id: match[1],
    canonicalUrl: canonical,
    postType: "tweet",
  };
}
