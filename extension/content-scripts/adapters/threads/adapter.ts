/**
 * adapters/threads/adapter.ts
 * Threads platform adapter implementing PlatformAdapter interface.
 *
 * This is a working example adapter for the Threads platform.
 * Note: Selectors may need adjustment as Threads UI evolves.
 */

import type { PlatformAdapter, NormalizedPostLink, SourceContext } from "../../../shared/platform";
import type { PostMetadata } from "../../../shared/types/domain";
import { normalizeThreadsUrl, canonicalizeThreadsUrl } from "./url-utils";
import { extractThreadsMetadata } from "./metadata";
import {
  injectThreadsButton,
  hasThreadsButton,
  removeThreadsButtons,
} from "./button-injection";
import {
  THREADS_POST_SELECTOR,
  THREADS_ARTICLE_SELECTOR,
  WITHIN_THREAD,
} from "./selectors";

// ─────────────────────────────────────────────────────────────────────────────
// Threads Adapter
// ─────────────────────────────────────────────────────────────────────────────

export class ThreadsAdapter implements PlatformAdapter {
  readonly id = "threads";

  readonly hostMatches = [
    "https://www.threads.net/*",
    "https://threads.net/*",
  ] as const;

  // ─────────────────────────────────────────────────────────────────────────
  // Post Discovery
  // ─────────────────────────────────────────────────────────────────────────

  findPostElements(root: Element | Document): Element[] {
    const results: Element[] = [];
    const seen = new WeakSet<Element>();

    // Try primary selector
    const posts = root.querySelectorAll(THREADS_POST_SELECTOR);
    posts.forEach((post) => {
      // Must contain a post link to be a valid thread
      if (post.querySelector(WITHIN_THREAD.postLink) && !seen.has(post)) {
        results.push(post);
        seen.add(post);
      }
    });

    // Fallback to article elements
    if (results.length === 0) {
      const articles = root.querySelectorAll(THREADS_ARTICLE_SELECTOR);
      articles.forEach((article) => {
        if (article.querySelector(WITHIN_THREAD.postLink) && !seen.has(article)) {
          results.push(article);
          seen.add(article);
        }
      });
    }

    return results;
  }

  getPostUrl(postElement: Element): NormalizedPostLink | null {
    // Try to find post link within element
    const postLink = postElement.querySelector<HTMLAnchorElement>(
      WITHIN_THREAD.postLink
    );
    if (postLink?.href) {
      return normalizeThreadsUrl(postLink.href);
    }

    // Fallback: try current page URL on post detail pages
    if (this.detectSourceContext() === "post-page") {
      return normalizeThreadsUrl(window.location.href);
    }

    return null;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Metadata Extraction
  // ─────────────────────────────────────────────────────────────────────────

  extractMetadata(
    postElement: Element,
    link: NormalizedPostLink
  ): Partial<PostMetadata> {
    return extractThreadsMetadata(postElement, link);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Button Injection
  // ─────────────────────────────────────────────────────────────────────────

  injectButton(
    postElement: Element,
    onClick: (postElement: Element, button: HTMLButtonElement) => void
  ): HTMLButtonElement | null {
    return injectThreadsButton(postElement, onClick);
  }

  hasButton(postElement: Element): boolean {
    return hasThreadsButton(postElement);
  }

  removeStaleButtons(): void {
    removeThreadsButtons();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // URL Processing
  // ─────────────────────────────────────────────────────────────────────────

  canonicalizeUrl(rawUrl: string): string | null {
    return canonicalizeThreadsUrl(rawUrl);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Context Detection
  // ─────────────────────────────────────────────────────────────────────────

  detectSourceContext(): SourceContext {
    const path = window.location.pathname;

    // Home feed
    if (path === "/" || path === "") return "feed";

    // Post detail: /@username/post/{id} or /t/{id}
    if (/\/@[^/]+\/post\//.test(path) || /^\/t\//.test(path)) return "post-page";

    // Profile: /@username
    if (/^\/@[^/]+\/?$/.test(path)) return "profile";

    // Search/explore
    if (/^\/search/.test(path)) return "explore";

    return "unknown";
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Optional Methods
  // ─────────────────────────────────────────────────────────────────────────

  findPostRoot(button: Element): Element | null {
    // Walk up to find the post container
    let current: Element | null = button.parentElement;
    while (current && current !== document.body) {
      if (current.matches(THREADS_POST_SELECTOR) || current.matches(THREADS_ARTICLE_SELECTOR)) {
        return current;
      }
      current = current.parentElement;
    }
    return null;
  }
}
