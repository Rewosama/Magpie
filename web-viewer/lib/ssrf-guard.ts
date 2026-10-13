/**
 * ssrf-guard.ts
 * URL validation and SSRF protection for server-side fetches.
 *
 * Security measures:
 * 1. Whitelist only allowed hostnames (Instagram, X/Twitter, Threads)
 * 2. Block private/internal IP addresses
 * 3. Enforce HTTPS
 * 4. Limit URL length
 */

import { z } from "zod";

// ── Constants ─────────────────────────────────────────────────────────────────

const MAX_URL_LENGTH = 2048;

/**
 * Allowed hostnames for server-side fetching.
 * Only social media platforms we support.
 */
const ALLOWED_HOSTS = new Set([
  // Instagram
  "www.instagram.com",
  "instagram.com",
  // X / Twitter
  "x.com",
  "www.x.com",
  "twitter.com",
  "www.twitter.com",
  "publish.x.com", // oEmbed API
  "publish.twitter.com", // oEmbed API (legacy)
  "api.vxtwitter.com", // vxTwitter API for media URLs
  // Threads
  "www.threads.net",
  "threads.net",
]);

/**
 * Private IP ranges that must be blocked.
 * Prevents SSRF attacks targeting internal services.
 */
const PRIVATE_IP_PATTERNS = [
  /^127\./, // Loopback
  /^10\./, // Private Class A
  /^172\.(1[6-9]|2[0-9]|3[0-1])\./, // Private Class B
  /^192\.168\./, // Private Class C
  /^169\.254\./, // Link-local
  /^0\./, // Current network
  /^::1$/, // IPv6 loopback
  /^fc00:/i, // IPv6 unique local
  /^fe80:/i, // IPv6 link-local
  /^fd/i, // IPv6 unique local
  /^localhost$/i,
];

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ValidatedUrl {
  url: URL;
  hostname: string;
}

export type ValidationResult =
  | { ok: true; data: ValidatedUrl }
  | { ok: false; error: string };

// ── Zod Schema ────────────────────────────────────────────────────────────────

export const urlSchema = z
  .string()
  .min(1, "URL boş olamaz.")
  .max(MAX_URL_LENGTH, `URL çok uzun (max ${MAX_URL_LENGTH} karakter).`)
  .refine(
    (val) => {
      try {
        new URL(val);
        return true;
      } catch {
        return false;
      }
    },
    { message: "Geçersiz URL formatı." },
  );

// ── Validation Functions ──────────────────────────────────────────────────────

/**
 * Checks if an IP address or hostname is private/internal.
 */
function isPrivateHost(hostname: string): boolean {
  return PRIVATE_IP_PATTERNS.some((pattern) => pattern.test(hostname));
}

/**
 * Validates a URL for safe server-side fetching.
 *
 * Checks:
 * 1. URL format validity
 * 2. HTTPS protocol
 * 3. Allowed hostname whitelist
 * 4. Not a private/internal address
 */
export function validateUrlForFetch(rawUrl: string): ValidationResult {
  // Length check
  if (rawUrl.length > MAX_URL_LENGTH) {
    return {
      ok: false,
      error: `URL çok uzun (max ${MAX_URL_LENGTH} karakter).`,
    };
  }

  // Parse URL
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return { ok: false, error: "Geçersiz URL formatı." };
  }

  // Protocol check (HTTPS only)
  if (url.protocol !== "https:") {
    return { ok: false, error: "Sadece HTTPS URL'leri desteklenir." };
  }

  // Hostname whitelist check
  const hostname = url.hostname.toLowerCase();
  if (!ALLOWED_HOSTS.has(hostname)) {
    return {
      ok: false,
      error: "Bu alan adından içerik çekilemez.",
    };
  }

  // Private IP check (defense in depth)
  if (isPrivateHost(hostname)) {
    return { ok: false, error: "İç ağ adresleri desteklenmez." };
  }

  return {
    ok: true,
    data: { url, hostname },
  };
}

/**
 * Validates a URL specifically for social media posts.
 * More restrictive than validateUrlForFetch — only allows post URLs.
 */
export function validatePostUrl(rawUrl: string): ValidationResult {
  const result = validateUrlForFetch(rawUrl);
  if (!result.ok) return result;

  const { url, hostname } = result.data;

  // Additional check: must be a post URL, not just any URL on allowed domains
  const pathname = url.pathname;

  // Instagram: /p/, /reel/, /reels/, /tv/, or /@username/...
  if (hostname.includes("instagram.com")) {
    if (
      !pathname.includes("/p/") &&
      !pathname.includes("/reel") &&
      !pathname.includes("/tv/")
    ) {
      return { ok: false, error: "Geçerli bir Instagram post URL'si değil." };
    }
  }

  // X/Twitter: must contain /status/
  if (hostname.includes("x.com") || hostname.includes("twitter.com")) {
    if (!pathname.includes("/status/")) {
      return { ok: false, error: "Geçerli bir X/Twitter post URL'si değil." };
    }
  }

  // Threads: /t/ or /post/
  if (hostname.includes("threads.net")) {
    if (!pathname.includes("/t/") && !pathname.includes("/post/")) {
      return { ok: false, error: "Geçerli bir Threads post URL'si değil." };
    }
  }

  return result;
}
