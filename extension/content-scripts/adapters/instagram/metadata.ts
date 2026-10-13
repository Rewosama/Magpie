/**
 * adapters/instagram/metadata.ts
 * Instagram metadata extraction from DOM.
 */

import type { PostMetadata } from "../../../shared/types/domain";
import type { NormalizedPostLink } from "../../../shared/platform";
import { RESERVED_SEGMENTS, REELS_USER_RE, MIN_IMG_PX } from "./selectors";
import { shortcodeFromPath } from "./url-utils";

// ─────────────────────────────────────────────────────────────────────────────
// Utilities
// ─────────────────────────────────────────────────────────────────────────────

/** Safe wrapper that catches errors and returns fallback */
function safe<T>(fn: () => T, fallback: T): T {
  try {
    return fn();
  } catch (err) {
    console.warn("[Magpie] Field extraction error:", err);
    return fallback;
  }
}

function meta(property: string): string | null {
  return (
    document
      .querySelector<HTMLMetaElement>(`meta[property="${property}"]`)
      ?.content?.trim() || null
  );
}

/**
 * Checks if og:* meta tags are fresh for the given link.
 * In SPA, meta tags may be stale from the previous page.
 */
function metaIsForLink(link: NormalizedPostLink): boolean {
  const code = shortcodeFromPath(location.pathname);
  if (!code) return false;

  const inLink = link.canonicalUrl.includes(code);
  if (!inLink) return false;

  const ogUrl = meta("og:url");
  return !ogUrl || ogUrl.includes(code);
}

/** Parses caption from og:description format */
function parseCaptionFromOg(desc: string): string | undefined {
  const quoted = desc.match(
    /:\s*[\u201c\u201d"]([\s\S]+)[\u201c\u201d"]\s*\.?\s*$/,
  );
  if (quoted?.[1]) return quoted[1].trim();

  const idx = desc.indexOf(": ");
  if (idx > 0 && idx < 150) {
    const rest = desc
      .substring(idx + 2)
      .trim()
      .replace(/^[\u201c\u201d"]/, "");
    if (rest) return rest;
  }
  return undefined;
}

/** Cleans text content: br→\n, removes "more" buttons */
function cleanText(el: Element): string | undefined {
  const clone = el.cloneNode(true) as HTMLElement;
  clone.querySelectorAll("[role='button']").forEach((b) => b.remove());
  clone.querySelectorAll("br").forEach((br) => br.replaceWith("\n"));
  const text = (clone.textContent ?? "")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .trim();
  return text || undefined;
}

// ─────────────────────────────────────────────────────────────────────────────
// Author Extraction
// ─────────────────────────────────────────────────────────────────────────────

interface AuthorInfo {
  authorUsername?: string;
  authorUrl?: string;
}

function extractAuthor(root: Element): AuthorInfo {
  const names: string[] = [];

  const push = (slug: string | null | undefined): void => {
    if (
      !slug ||
      RESERVED_SEGMENTS.has(slug) ||
      slug.length > 50 ||
      names.includes(slug)
    )
      return;
    names.push(slug);
  };

  const profileSlug = (a: Element): string | undefined =>
    a.getAttribute("href")?.match(/^\/([^/]+)\/$/)?.[1];

  // Priority 1: header profile links
  root
    .querySelectorAll("header a[href^='/']")
    .forEach((a) => push(profileSlug(a)));

  // Priority 2: /username/reels/ links (reels viewer)
  root
    .querySelectorAll("a[href]")
    .forEach((a) => push(a.getAttribute("href")?.match(REELS_USER_RE)?.[1]));

  // Priority 3: Collab/tagged users with SVG
  root.querySelectorAll('a[href="#"]').forEach((a) => {
    const t = a.textContent?.trim() ?? "";
    if (a.querySelector("svg") && /^[\w.]{1,30}$/.test(t)) push(t);
  });

  // Priority 4: h2 links
  if (!names.length) {
    root
      .querySelectorAll("h2 a[href^='/']")
      .forEach((a) => push(profileSlug(a)));
  }

  // Priority 5: any profile link
  if (!names.length) {
    for (const a of Array.from(root.querySelectorAll("a[href^='/']"))) {
      push(profileSlug(a));
      if (names.length > 0) break;
    }
  }

  if (!names.length) return {};
  return {
    authorUsername: names[0],
    authorUrl: `https://www.instagram.com/${names[0]}/`,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Image Extraction
// ─────────────────────────────────────────────────────────────────────────────

function extractImages(root: Element): string[] {
  const seen = new Set<string>();
  const results: string[] = [];

  for (const img of Array.from(
    root.querySelectorAll<HTMLImageElement>("img"),
  )) {
    // Skip profile pictures
    if (/profil|profile/i.test(img.alt) || img.closest("header") !== null)
      continue;

    const w =
      img.getBoundingClientRect().width || img.naturalWidth || img.width;
    if (w <= MIN_IMG_PX) continue;

    const src = img.currentSrc || img.src;
    if (!src || src.startsWith("data:") || seen.has(src)) continue;
    seen.add(src);
    results.push(src);
  }
  return results;
}

// ─────────────────────────────────────────────────────────────────────────────
// Video Extraction & Thumbnail Cache
// ─────────────────────────────────────────────────────────────────────────────

interface CachedFrame {
  src: string;
  frame: string;
}

const frameCache = new WeakMap<Element, CachedFrame>();
const inFlight = new WeakSet<Element>();

const videoKey = (v: HTMLVideoElement): string => v.currentSrc || v.src || "";

function getCachedFrame(
  root: Element,
  video: HTMLVideoElement,
): string | undefined {
  const hit = frameCache.get(root);
  return hit && hit.src === videoKey(video) ? hit.frame : undefined;
}

function captureFrame(video: HTMLVideoElement): string | null {
  if (video.readyState < 2 || !video.videoWidth) return null;
  const scale = Math.min(1, 480 / video.videoWidth);
  const c = document.createElement("canvas");
  c.width = Math.round(video.videoWidth * scale);
  c.height = Math.round(video.videoHeight * scale);
  try {
    c.getContext("2d")?.drawImage(video, 0, 0, c.width, c.height);
    return c.toDataURL("image/jpeg", 0.8);
  } catch {
    return null;
  }
}

function extractVideo(root: Element): {
  thumbnailUrl?: string;
  mediaUrl?: string;
} {
  const video = root.querySelector<HTMLVideoElement>("video");
  if (!video) return {};

  const src = video.currentSrc || video.src || undefined;
  const mediaUrl = src && !src.startsWith("blob:") ? src : undefined;

  const cached = getCachedFrame(root, video);
  if (cached) return { thumbnailUrl: cached, mediaUrl };

  const poster = video.getAttribute("poster") || undefined;
  if (poster) return { thumbnailUrl: poster, mediaUrl };

  return { thumbnailUrl: captureFrame(video) ?? undefined, mediaUrl };
}

const sleep = (ms: number): Promise<void> =>
  new Promise((r) => setTimeout(r, ms));

/**
 * Pre-captures video thumbnail in background.
 */
export async function warmUpVideoThumbnail(root: Element): Promise<void> {
  if (inFlight.has(root)) return;
  inFlight.add(root);
  try {
    const deadline = Date.now() + 12_000;
    while (Date.now() < deadline && root.isConnected) {
      const video = root.querySelector<HTMLVideoElement>("video");
      if (!video) return;
      const key = videoKey(video);
      if (key) {
        if (getCachedFrame(root, video)) return;
        const frame = captureFrame(video);
        if (frame) {
          frameCache.set(root, { src: key, frame });
          return;
        }
      }
      await sleep(250);
    }
  } finally {
    inFlight.delete(root);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Caption Extraction
// ─────────────────────────────────────────────────────────────────────────────

function extractCaption(
  root: Element,
  link: NormalizedPostLink,
  authorUsername?: string,
): string | undefined {
  // 1. h1: post/reel detail page
  const h1 = root.querySelector("h1[dir='auto']") ?? root.querySelector("h1");
  if (h1) {
    const t = cleanText(h1);
    if (t) return t;
  }

  // 2. Feed: div[style*="display:inline"] > span[dir="auto"]
  const inlineSpan = root.querySelector(
    'div[style*="display:inline"] > span[dir="auto"], div[style*="display: inline"] > span[dir="auto"]',
  );
  if (inlineSpan) {
    const t = cleanText(inlineSpan);
    if (t) return t;
  }

  // 3. Reels viewer: caption div[dir="auto"]
  // This applies to /reels/ pages AND reel dialogs (non-ARTICLE containers)
  const pathname = location.pathname;
  const isReelsPage = pathname.startsWith("/reels/");
  const isReelDialog =
    root.tagName !== "ARTICLE" && root.closest('[role="dialog"]') !== null;

  if (isReelsPage || isReelDialog || root.tagName !== "ARTICLE") {
    const best = Array.from(
      root.querySelectorAll<HTMLElement>("div[dir='auto']"),
    )
      .map((d) => ({ d, len: (d.textContent ?? "").trim().length }))
      .filter((x) => x.len > 0)
      .sort((a, b) => b.len - a.len)[0];
    if (best) {
      const t = cleanText(best.d);
      if (t) return t;
    }
  }

  // 4. og:description / og:title (only if fresh)
  if (metaIsForLink(link)) {
    const fromDesc = parseCaptionFromOg(meta("og:description") ?? "");
    if (fromDesc) return fromDesc;
    const fromTitle = parseCaptionFromOg(meta("og:title") ?? "");
    if (fromTitle) return fromTitle;
  }

  // 5. Last resort: longest span in feed
  if (shortcodeFromPath(location.pathname)) return undefined;

  const candidates = Array.from(
    root.querySelectorAll<HTMLSpanElement>("span[dir]"),
  )
    .filter((s) => {
      if (s.querySelector("a, time, svg")) return false;
      const text = s.textContent?.trim();
      if (!text || text.length < 2) return false;
      if (authorUsername && text === authorUsername) return false;
      if (/^[•·\s]+$/.test(text)) return false;
      if (/^[\d.,]+\s?[a-zA-ZÂ-ÿ]{0,3}$/.test(text)) return false;
      return true;
    })
    .map((s) => (s.textContent ?? "").trim());

  candidates.sort((a, b) => b.length - a.length);
  return candidates[0];
}

// ─────────────────────────────────────────────────────────────────────────────
// Date Extraction
// ─────────────────────────────────────────────────────────────────────────────

function getJsonLdDate(): string | undefined {
  for (const sc of Array.from(
    document.querySelectorAll<HTMLScriptElement>(
      'script[type="application/ld+json"]',
    ),
  )) {
    try {
      const parsed: unknown = JSON.parse(sc.textContent ?? "");
      for (const item of Array.isArray(parsed) ? parsed : [parsed]) {
        if (typeof item !== "object" || !item) continue;
        const obj = item as Record<string, unknown>;
        const d =
          obj["uploadDate"] ?? obj["datePublished"] ?? obj["dateCreated"];
        if (typeof d === "string") return new Date(d).toISOString();
      }
    } catch {
      /* invalid JSON / invalid date */
    }
  }
  return undefined;
}

function extractPublishedAt(
  root: Element,
  link: NormalizedPostLink,
): string | undefined {
  const times = Array.from(
    root.querySelectorAll<HTMLTimeElement>("time[datetime]"),
  );
  const captionTime = root
    .querySelector("h1")
    ?.closest("li")
    ?.querySelector<HTMLTimeElement>("time[datetime]");
  const own = captionTime ?? times.find((t) => !t.closest("ul")) ?? times[0];
  const dt = own?.getAttribute("datetime");
  if (dt) return dt;
  return metaIsForLink(link) ? getJsonLdDate() : undefined;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Export
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Extracts all available metadata from an Instagram post element.
 */
export function extractInstagramMetadata(
  root: Element,
  link: NormalizedPostLink,
): Partial<PostMetadata> {
  const { authorUsername, authorUrl } = safe(() => extractAuthor(root), {});
  const video = safe(
    () => extractVideo(root),
    {} as { thumbnailUrl?: string; mediaUrl?: string },
  );
  const images = safe(() => extractImages(root), [] as string[]);
  const caption = safe(
    () => extractCaption(root, link, authorUsername),
    undefined,
  );
  const publishedAt = safe(() => extractPublishedAt(root, link), undefined);

  // Build media_urls array
  const media_urls: string[] = [];
  if (video.thumbnailUrl) media_urls.push(video.thumbnailUrl);
  if (video.mediaUrl && video.mediaUrl !== video.thumbnailUrl) {
    media_urls.push(video.mediaUrl);
  }
  if (images.length > 0) {
    for (const img of images) {
      if (!media_urls.includes(img)) media_urls.push(img);
    }
  }

  return {
    author_username: authorUsername ?? null,
    author_display_name: null,
    author_avatar_url: authorUrl ?? null,
    content_text: caption ?? null,
    media_urls,
    post_timestamp: publishedAt ?? null,
  };
}
