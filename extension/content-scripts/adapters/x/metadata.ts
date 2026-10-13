/**
 * adapters/x/metadata.ts
 * X/Twitter metadata extraction from DOM.
 */

import type { PostMetadata } from "../../../shared/types/domain";
import type { NormalizedPostLink } from "../../../shared/platform";
import { WITHIN_TWEET } from "./selectors";
import { canonicalizeXUrl } from "./url-utils";

// ─────────────────────────────────────────────────────────────────────────────
// Main Export
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Extracts metadata from a tweet article element.
 * Returns null if tweet URL cannot be located.
 */
export function extractXMetadata(
  el: Element,
  _link: NormalizedPostLink
): Partial<PostMetadata> {
  // 1. Locate tweet link
  const tweetLinkEl = el.querySelector<HTMLAnchorElement>(WITHIN_TWEET.tweetLink);
  if (!tweetLinkEl?.href) {
    return {};
  }

  const rawUrl = new URL(tweetLinkEl.href, window.location.origin).href;
  const canonical = canonicalizeXUrl(rawUrl);
  const post_url = canonical ?? rawUrl;

  // 2. Author name/handle
  const authorNameEl = el.querySelector(WITHIN_TWEET.authorName);
  const spans = authorNameEl?.querySelectorAll("span");
  const author_display_name = spans?.[0]?.textContent?.trim() ?? null;
  const author_username =
    spans?.[1]?.textContent?.replace("@", "").trim() ?? null;

  // 3. Avatar URL
  const avatarEl = el.querySelector<HTMLImageElement>(WITHIN_TWEET.authorAvatar);
  const author_avatar_url = avatarEl?.src ?? null;

  // 4. Tweet text
  const textEl = el.querySelector(WITHIN_TWEET.tweetText);
  const content_text = textEl?.textContent?.trim() ?? null;

  // 5. Timestamp
  const timeEl = el.querySelector<HTMLTimeElement>(WITHIN_TWEET.timestamp);
  const post_timestamp = timeEl?.getAttribute("datetime") ?? null;

  // 6. Media URLs
  const photoEls = Array.from(
    el.querySelectorAll<HTMLImageElement>(WITHIN_TWEET.photo)
  );
  const videoPosterEls = Array.from(
    el.querySelectorAll<HTMLVideoElement>("video[poster]")
  );
  const media_urls: string[] = [
    ...photoEls.map((i) => i.src).filter((s) => s && s !== author_avatar_url),
    ...videoPosterEls.map((v) => v.getAttribute("poster") ?? "").filter(Boolean),
  ];

  // 7. Quoted tweet
  let quoted_suffix = "";
  const quotedContainers = Array.from(
    el.querySelectorAll<HTMLElement>('div[tabindex="0"][role="link"]')
  );
  
  for (const container of quotedContainers) {
    const quotedTextEl = container.querySelector<HTMLElement>(
      '[data-testid="tweetText"]'
    );
    if (!quotedTextEl) continue;

    const quotedAuthorEl = container.querySelector(WITHIN_TWEET.authorName);
    const quotedSpans = quotedAuthorEl?.querySelectorAll("span");
    const quotedHandle =
      quotedSpans?.[1]?.textContent?.replace("@", "").trim() ?? "";
    const quotedBody = quotedTextEl.textContent?.trim() ?? "";

    if (quotedBody || quotedHandle) {
      quoted_suffix = `\n\n↩ @${quotedHandle}: ${quotedBody}`;
    }

    // Quoted tweet media
    const qPhotos = Array.from(
      container.querySelectorAll<HTMLImageElement>('[data-testid="tweetPhoto"] img')
    );
    const qPosters = Array.from(
      container.querySelectorAll<HTMLVideoElement>("video[poster]")
    );
    media_urls.push(
      ...qPhotos.map((i) => i.src).filter((s) => s),
      ...qPosters.map((v) => v.getAttribute("poster") ?? "").filter(Boolean)
    );

    break; // Only first quoted tweet
  }

  const final_content = content_text
    ? content_text + quoted_suffix
    : quoted_suffix || null;

  return {
    post_url,
    post_type: "tweet",
    platform: "x",
    author_username,
    author_display_name,
    author_avatar_url,
    content_text: final_content,
    media_urls,
    post_timestamp,
    raw_metadata: {
      page_url: window.location.href,
      extracted_at: new Date().toISOString(),
    },
  };
}
