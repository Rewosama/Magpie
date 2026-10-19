/**
 * adapters/x/adapter.ts
 * X/Twitter platform adapter implementing PlatformAdapter interface.
 */

import type { PlatformAdapter, NormalizedPostLink, SourceContext } from "../../../shared/platform";
import type { PostMetadata } from "../../../shared/types/domain";
import { normalizeXUrl, canonicalizeXUrl } from "./url-utils";
import { extractXMetadata } from "./metadata";
import { injectXButton, hasXButton, removeXButtons } from "./button-injection";
import { X_TWEET_SELECTOR, WITHIN_TWEET } from "./selectors";

// ─────────────────────────────────────────────────────────────────────────────
// X Adapter
// ─────────────────────────────────────────────────────────────────────────────

export class XAdapter implements PlatformAdapter {
  readonly id = "x";

  readonly hostMatches = [
    "https://x.com/*",
    "https://twitter.com/*",
  ] as const;

  // ─────────────────────────────────────────────────────────────────────────
  // Post Discovery
  // ─────────────────────────────────────────────────────────────────────────

  findPostElements(root: Element | Document): Element[] {
    const results: Element[] = [];

    // Check if root itself is a tweet
    if (root instanceof Element && root.matches(X_TWEET_SELECTOR)) {
      results.push(root);
      return results;
    }

    // Find all tweet articles
    const tweets = root.querySelectorAll(X_TWEET_SELECTOR);
    tweets.forEach((tweet) => results.push(tweet));

    return results;
  }

  getPostUrl(postElement: Element): NormalizedPostLink | null {
    const tweetLinkEl = postElement.querySelector<HTMLAnchorElement>(
      WITHIN_TWEET.tweetLink
    );
    if (!tweetLinkEl?.href) return null;

    const rawUrl = new URL(tweetLinkEl.href, window.location.origin).href;
    return normalizeXUrl(rawUrl);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Metadata Extraction
  // ─────────────────────────────────────────────────────────────────────────

  extractMetadata(
    postElement: Element,
    link: NormalizedPostLink
  ): Partial<PostMetadata> {
    return extractXMetadata(postElement, link);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Button Injection
  // ─────────────────────────────────────────────────────────────────────────

  injectButton(
    postElement: Element,
    onClick: (postElement: Element, button: HTMLButtonElement) => void
  ): HTMLButtonElement | null {
    return injectXButton(postElement, onClick);
  }

  hasButton(postElement: Element): boolean {
    return hasXButton(postElement);
  }

  removeStaleButtons(): void {
    removeXButtons();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // URL Processing
  // ─────────────────────────────────────────────────────────────────────────

  canonicalizeUrl(rawUrl: string): string | null {
    return canonicalizeXUrl(rawUrl);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Context Detection
  // ─────────────────────────────────────────────────────────────────────────

  detectSourceContext(): SourceContext {
    const path = window.location.pathname;

    if (path === "/" || path === "/home") return "feed";
    if (/\/status\/\d+/.test(path)) return "post-page";
    if (/^\/[^/]+\/?$/.test(path)) return "profile";
    if (/^\/explore/.test(path)) return "explore";

    return "unknown";
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Optional Methods
  // ─────────────────────────────────────────────────────────────────────────

  findPostRoot(button: Element): Element | null {
    return button.closest(X_TWEET_SELECTOR);
  }
}
