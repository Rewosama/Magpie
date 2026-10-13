/**
 * adapters/threads/metadata.ts
 * Threads metadata extraction from DOM.
 */

import type { PostMetadata } from "../../../shared/types/domain";
import type { NormalizedPostLink } from "../../../shared/platform";
import { WITHIN_THREAD } from "./selectors";

// ─────────────────────────────────────────────────────────────────────────────
// Utilities
// ─────────────────────────────────────────────────────────────────────────────

/** Minimum image size to be considered content (not avatar/icon) */
const MIN_IMG_PX = 150;

// ─────────────────────────────────────────────────────────────────────────────
// Main Export
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Extracts metadata from a Threads post element.
 */
export function extractThreadsMetadata(
  el: Element,
  _link: NormalizedPostLink
): Partial<PostMetadata> {
  // 1. Author username from profile link
  const profileLink = el.querySelector<HTMLAnchorElement>(WITHIN_THREAD.profileLink);
  const author_username = profileLink?.getAttribute("href")?.replace("/@", "").split("/")[0] ?? null;

  // 2. Post content
  const textEls = Array.from(el.querySelectorAll<HTMLElement>(WITHIN_THREAD.postText))
    .filter((d) => d.textContent && d.textContent.trim().length > 0)
    .sort((a, b) => (b.textContent?.length ?? 0) - (a.textContent?.length ?? 0));
  const content_text = textEls[0]?.textContent?.trim() ?? null;

  // 3. Timestamp
  const timeEl = el.querySelector<HTMLTimeElement>(WITHIN_THREAD.timestamp);
  const post_timestamp = timeEl?.getAttribute("datetime") ?? null;

  // 4. Media URLs
  const media_urls: string[] = [];

  // Images (filter out small avatars)
  const images = Array.from(el.querySelectorAll<HTMLImageElement>(WITHIN_THREAD.photo));
  for (const img of images) {
    const w = img.getBoundingClientRect().width || img.naturalWidth || img.width;
    if (w <= MIN_IMG_PX) continue;
    const src = img.currentSrc || img.src;
    if (src && !src.startsWith("data:") && !media_urls.includes(src)) {
      // Skip profile pictures (usually in header area)
      if (!img.closest("header") && !img.alt?.toLowerCase().includes("profile")) {
        media_urls.push(src);
      }
    }
  }

  // Video posters
  const videos = Array.from(el.querySelectorAll<HTMLVideoElement>("video[poster]"));
  for (const video of videos) {
    const poster = video.getAttribute("poster");
    if (poster && !media_urls.includes(poster)) {
      media_urls.push(poster);
    }
  }

  return {
    author_username,
    author_display_name: null,
    author_avatar_url: null,
    content_text,
    media_urls,
    post_timestamp,
    raw_metadata: {
      page_url: window.location.href,
      extracted_at: new Date().toISOString(),
    },
  };
}
