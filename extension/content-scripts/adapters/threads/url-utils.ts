/**
 * adapters/threads/url-utils.ts
 * Threads URL normalization.
 */

import type { NormalizedPostLink } from "../../../shared/platform";
import { THREADS_ORIGIN, THREADS_HOSTS, THREAD_ID_RE } from "./selectors";

// ─────────────────────────────────────────────────────────────────────────────
// URL Canonicalization
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Converts a Threads URL to canonical form.
 * Format: https://www.threads.net/@username/post/{threadId}
 * Canonical: https://www.threads.net/t/{threadId}
 */
export function canonicalizeThreadsUrl(rawUrl: string): string | null {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }

  if (!THREADS_HOSTS.has(url.hostname)) return null;

  const parts = url.pathname.split("/").filter(Boolean);

  // Pattern: /@username/post/{threadId}
  // Or: /t/{threadId}
  const postIdx = parts.indexOf("post");
  if (postIdx >= 0 && parts[postIdx + 1]) {
    const threadId = parts[postIdx + 1];
    if (THREAD_ID_RE.test(threadId)) {
      return `${THREADS_ORIGIN}/t/${threadId}`;
    }
  }

  // Already canonical form: /t/{threadId}
  if (parts[0] === "t" && parts[1] && THREAD_ID_RE.test(parts[1])) {
    return `${THREADS_ORIGIN}/t/${parts[1]}`;
  }

  return null;
}

/**
 * Extracts normalized post link from a Threads URL.
 */
export function normalizeThreadsUrl(rawUrl: string): NormalizedPostLink | null {
  const canonical = canonicalizeThreadsUrl(rawUrl);
  if (!canonical) return null;

  // Extract thread ID from canonical URL
  const match = canonical.match(/\/t\/([A-Za-z0-9_-]+)/);
  if (!match) return null;

  return {
    id: match[1],
    canonicalUrl: canonical,
    postType: "thread",
  };
}
