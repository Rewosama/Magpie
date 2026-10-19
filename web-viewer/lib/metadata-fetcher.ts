/**
 * metadata-fetcher.ts
 * Server-side metadata extraction for social media posts.
 *
 * Strategy per platform:
 * - Instagram: Fetch with Googlebot UA and parse OG tags
 * - X/Twitter: Use official oEmbed API
 * - Threads: Fetch with Googlebot UA and parse OG tags
 *
 * Security: All URLs are validated through ssrf-guard before fetching.
 */

import type { Platform } from "./canonicalizeUrl";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PostMetadata {
  platform: Platform;
  authorUsername: string | null;
  authorDisplayName: string | null;
  authorAvatarUrl: string | null;
  contentText: string | null;
  thumbnailUrl: string | null;
  postType: "post" | "reel" | "story" | "tweet" | "thread" | null;
  /** True if metadata fetch failed and only URL/platform is known */
  incomplete: boolean;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const FETCH_TIMEOUT = 10000; // 10 seconds

// Googlebot UA gets OG tags from Instagram without login
const GOOGLEBOT_USER_AGENT =
  "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)";

// ── Fetch Helpers ─────────────────────────────────────────────────────────────

/**
 * Fetches with timeout and specified headers.
 */
async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeout = FETCH_TIMEOUT,
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

function decodeHTMLEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, "/")
    .replace(/&#(\d+);/g, (_, num) => String.fromCharCode(parseInt(num, 10)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) =>
      String.fromCharCode(parseInt(hex, 16)),
    );
}

// ── OpenGraph Parser ──────────────────────────────────────────────────────────

interface OGData {
  title: string | null;
  description: string | null;
  image: string | null;
  siteName: string | null;
}

function extractOGTags(html: string): OGData {
  const getMetaContent = (property: string): string | null => {
    // Match property="og:..." content="..."
    const patterns = [
      new RegExp(
        `<meta\\s+property=["']${property}["']\\s+content=["']([^"']+)["']`,
        "i",
      ),
      new RegExp(
        `<meta\\s+content=["']([^"']+)["']\\s+property=["']${property}["']`,
        "i",
      ),
      // Also match name="..." for twitter cards
      new RegExp(
        `<meta\\s+name=["']${property.replace("og:", "twitter:")}["']\\s+content=["']([^"']+)["']`,
        "i",
      ),
    ];

    for (const pattern of patterns) {
      const match = html.match(pattern);
      if (match?.[1]) return decodeHTMLEntities(match[1]);
    }
    return null;
  };

  return {
    title: getMetaContent("og:title"),
    description:
      getMetaContent("og:description") || getMetaContent("description"),
    image: getMetaContent("og:image") || getMetaContent("twitter:image"),
    siteName: getMetaContent("og:site_name"),
  };
}

// ── Instagram OG Fetcher ──────────────────────────────────────────────────────

interface InstagramOGData {
  username: string | null;
  caption: string | null;
  imageUrl: string | null;
}

async function fetchInstagramOG(
  postUrl: string,
): Promise<InstagramOGData | null> {
  try {
    const response = await fetchWithTimeout(postUrl, {
      headers: {
        "User-Agent": GOOGLEBOT_USER_AGENT,
        Accept: "text/html",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });

    if (!response.ok) return null;

    const html = await response.text();
    const og = extractOGTags(html);

    // Extract username from og:title
    // Format: "Username on Instagram: \"caption...\""
    let username: string | null = null;
    if (og.title) {
      const match = og.title.match(/^(.+?)\s+on\s+Instagram/i);
      if (match) {
        username = match[1].replace(/^@/, "").trim();
      }
    }

    // Extract caption from og:description
    // Format: "X likes, Y comments - username on DATE: \"caption\""
    let caption: string | null = null;
    if (og.description) {
      // Try to extract only the quoted caption part
      // Pattern: ... : "actual caption text"
      // Using [\s\S] instead of . with 's' flag for ES5 compatibility
      const quoteMatch = og.description.match(/:\s*"([\s\S]+)"\.?\s*$/);
      if (quoteMatch) {
        caption = quoteMatch[1].trim();
      }
      // If no quoted caption found, don't use the stats line
    }

    return {
      username,
      caption,
      imageUrl: og.image,
    };
  } catch (e) {
    console.error("[metadata-fetcher] Instagram OG fetch error:", e);
    return null;
  }
}

// ── X/Twitter vxTwitter API Fetcher ───────────────────────────────────────────

interface VxTwitterData {
  username: string | null;
  displayName: string | null;
  text: string | null;
  mediaUrl: string | null;
}

/**
 * Extracts username and status ID from X/Twitter URL.
 */
function parseXUrl(
  postUrl: string,
): { username: string; statusId: string } | null {
  const match = postUrl.match(
    /(?:twitter\.com|x\.com)\/([^/?]+)\/status\/(\d+)/,
  );
  if (!match) return null;
  return { username: match[1], statusId: match[2] };
}

/**
 * Fetches X/Twitter post metadata via vxTwitter API.
 * vxTwitter is a free, open-source API that provides tweet data including media.
 */
async function fetchVxTwitter(postUrl: string): Promise<VxTwitterData | null> {
  const parsed = parseXUrl(postUrl);
  if (!parsed) return null;

  const apiUrl = `https://api.vxtwitter.com/${parsed.username}/status/${parsed.statusId}`;

  try {
    const response = await fetchWithTimeout(apiUrl, {
      headers: {
        Accept: "application/json",
      },
    });
    if (!response.ok) return null;

    const data = await response.json();

    // Extract first media URL if available
    let mediaUrl: string | null = null;
    if (data.mediaURLs && data.mediaURLs.length > 0) {
      mediaUrl = data.mediaURLs[0];
      // For videos, prefer thumbnail_url
      if (
        data.media_extended?.[0]?.type === "video" &&
        data.media_extended[0].thumbnail_url
      ) {
        mediaUrl = data.media_extended[0].thumbnail_url;
      }
    }

    return {
      username: data.user_screen_name || parsed.username,
      displayName: data.user_name || null,
      text: data.text || null,
      mediaUrl,
    };
  } catch (e) {
    console.error("[metadata-fetcher] vxTwitter fetch error:", e);
    return null;
  }
}

// ── X/Twitter oEmbed Fetcher (fallback) ───────────────────────────────────────

interface XOEmbedData {
  authorName: string | null;
  authorUrl: string | null;
  html: string | null;
}

/**
 * Fetches X/Twitter post metadata via official oEmbed API.
 * Used as fallback if vxTwitter fails.
 */
async function fetchXOEmbed(postUrl: string): Promise<XOEmbedData | null> {
  // Use publish.x.com (twitter.com redirects here)
  const oembedUrl = `https://publish.x.com/oembed?url=${encodeURIComponent(postUrl)}&format=json`;

  try {
    const response = await fetchWithTimeout(oembedUrl, {
      headers: {
        Accept: "application/json",
        "User-Agent": GOOGLEBOT_USER_AGENT,
      },
    });
    if (!response.ok) return null;

    const data = await response.json();
    return {
      authorName: data.author_name || null,
      authorUrl: data.author_url || null,
      html: data.html || null,
    };
  } catch (e) {
    console.error("[metadata-fetcher] X oEmbed fetch error:", e);
    return null;
  }
}

/**
 * Extracts tweet text from oEmbed HTML.
 */
function extractTweetText(html: string): string | null {
  // oEmbed HTML format: <blockquote>...<p>tweet text</p>...— author (@username)</blockquote>
  const match = html.match(/<p[^>]*>([\s\S]*?)<\/p>/);
  if (!match) return null;

  const text = match[1]
    .replace(/<a[^>]*>(.*?)<\/a>/g, "$1") // Keep link text
    .replace(/<[^>]+>/g, "") // Remove other HTML
    .trim();

  return decodeHTMLEntities(text);
}

/**
 * Extracts username from author URL.
 */
function extractXUsername(authorUrl: string | null): string | null {
  if (!authorUrl) return null;
  const match = authorUrl.match(/(?:twitter\.com|x\.com)\/([^/?]+)/);
  return match ? match[1] : null;
}

// ── Threads OG Fetcher ────────────────────────────────────────────────────────

interface ThreadsOGData {
  username: string | null;
  text: string | null;
  imageUrl: string | null;
}

async function fetchThreadsOG(postUrl: string): Promise<ThreadsOGData | null> {
  try {
    const response = await fetchWithTimeout(postUrl, {
      headers: {
        "User-Agent": GOOGLEBOT_USER_AGENT,
        Accept: "text/html",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });

    if (!response.ok) return null;

    const html = await response.text();
    const og = extractOGTags(html);

    // Extract username from og:title (similar to Instagram)
    let username: string | null = null;
    if (og.title) {
      const match = og.title.match(/^(.+?)\s+on\s+Threads/i);
      if (match) {
        username = match[1].replace(/^@/, "").trim();
      }
    }

    return {
      username,
      text: og.description,
      imageUrl: og.image,
    };
  } catch (e) {
    console.error("[metadata-fetcher] Threads OG fetch error:", e);
    return null;
  }
}

// ── Platform-Specific Helpers ─────────────────────────────────────────────────

function detectPostType(
  url: string,
  platform: Platform,
): PostMetadata["postType"] {
  try {
    const pathname = new URL(url).pathname.toLowerCase();

    if (platform === "instagram") {
      if (pathname.includes("/reel")) return "reel";
      if (pathname.includes("/tv/")) return "reel";
      return "post";
    }

    if (platform === "x") {
      return "tweet";
    }

    if (platform === "threads") {
      return "thread";
    }
  } catch {
    // Ignore URL parse errors
  }

  return null;
}

// ── Main API ──────────────────────────────────────────────────────────────────

/**
 * Fetches metadata for a social media post.
 *
 * Uses platform-specific strategies:
 * - Instagram: OG tags with Googlebot UA
 * - X/Twitter: Official oEmbed API
 * - Threads: OG tags with Googlebot UA
 *
 * Never throws — returns partial data with `incomplete: true` on failure.
 */
export async function fetchPostMetadata(
  postUrl: string,
  platform: Platform,
): Promise<PostMetadata> {
  const baseResult: PostMetadata = {
    platform,
    authorUsername: null,
    authorDisplayName: null,
    authorAvatarUrl: null,
    contentText: null,
    thumbnailUrl: null,
    postType: detectPostType(postUrl, platform),
    incomplete: true,
  };

  // ── Instagram ───────────────────────────────────────────────────────────────
  if (platform === "instagram") {
    const ogData = await fetchInstagramOG(postUrl);
    if (ogData && (ogData.username || ogData.caption || ogData.imageUrl)) {
      return {
        ...baseResult,
        authorUsername: ogData.username,
        authorDisplayName: ogData.username,
        authorAvatarUrl: null, // OG tags don't include avatar
        contentText: ogData.caption,
        thumbnailUrl: ogData.imageUrl,
        incomplete: false,
      };
    }
    return baseResult;
  }

  // ── X/Twitter ───────────────────────────────────────────────────────────────
  if (platform === "x") {
    // Try vxTwitter API first (includes media URLs)
    const vxData = await fetchVxTwitter(postUrl);
    if (vxData) {
      return {
        ...baseResult,
        authorUsername: vxData.username,
        authorDisplayName: vxData.displayName,
        authorAvatarUrl: null,
        contentText: vxData.text,
        thumbnailUrl: vxData.mediaUrl,
        incomplete: false,
      };
    }

    // Fallback to oEmbed if vxTwitter fails
    const oembedData = await fetchXOEmbed(postUrl);
    if (oembedData) {
      const tweetText = oembedData.html
        ? extractTweetText(oembedData.html)
        : null;
      return {
        ...baseResult,
        authorUsername: extractXUsername(oembedData.authorUrl),
        authorDisplayName: oembedData.authorName,
        authorAvatarUrl: null,
        contentText: tweetText,
        thumbnailUrl: null, // oEmbed doesn't provide thumbnail
        incomplete: false,
      };
    }
    return baseResult;
  }

  // ── Threads ─────────────────────────────────────────────────────────────────
  if (platform === "threads") {
    const ogData = await fetchThreadsOG(postUrl);
    if (ogData && (ogData.username || ogData.text || ogData.imageUrl)) {
      return {
        ...baseResult,
        authorUsername: ogData.username,
        authorDisplayName: ogData.username,
        authorAvatarUrl: null,
        contentText: ogData.text,
        thumbnailUrl: ogData.imageUrl,
        incomplete: false,
      };
    }
    return baseResult;
  }

  return baseResult;
}
