/**
 * adapters/instagram/adapter.ts
 * Instagram platform adapter implementing PlatformAdapter interface.
 */

import type {
  PlatformAdapter,
  NormalizedPostLink,
  SourceContext,
} from "../../../shared/platform";
import type { PostMetadata } from "../../../shared/types/domain";
import {
  normalizeInstagramMediaUrl,
  findNormalizedLinkInRoot,
  canonicalizeInstagramUrl,
} from "./url-utils";
import { extractInstagramMetadata, warmUpVideoThumbnail } from "./metadata";
import {
  injectInstagramButton,
  hasInstagramButton,
  removeInstagramButtons,
  injectIntoAllActionBars,
} from "./button-injection";
import {
  findAllMediaRoots,
  findReelsPagePosts,
  findMediaRoot,
  findReelItemRoot,
  detectInstagramContext,
} from "./post-finder";

// ─────────────────────────────────────────────────────────────────────────────
// Instagram Adapter
// ─────────────────────────────────────────────────────────────────────────────

export class InstagramAdapter implements PlatformAdapter {
  readonly id = "instagram";

  readonly hostMatches = ["https://www.instagram.com/*"] as const;

  // Store the click handler for global action bar scanning
  private _globalClickHandler:
    | ((postElement: Element, button: HTMLButtonElement) => void)
    | null = null;

  // ─────────────────────────────────────────────────────────────────────────
  // Post Discovery
  // ─────────────────────────────────────────────────────────────────────────

  findPostElements(root: Element | Document): Element[] {
    const context = this.detectSourceContext();

    // For reels page, use specialized finder
    if (context === "reel-page" && root === document) {
      const reelPosts = findReelsPagePosts();
      if (reelPosts.length > 0) return reelPosts;
    }

    // Standard discovery
    return findAllMediaRoots(root);
  }

  getPostUrl(postElement: Element): NormalizedPostLink | null {
    const context = this.detectSourceContext();

    // On dedicated pages, URL is most reliable source
    if (context === "post-page" || context === "reel-page") {
      const fromUrl = normalizeInstagramMediaUrl(window.location.href);
      if (fromUrl) return fromUrl;
    }

    // Otherwise search within the element
    return findNormalizedLinkInRoot(postElement);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Metadata Extraction
  // ─────────────────────────────────────────────────────────────────────────

  extractMetadata(
    postElement: Element,
    link: NormalizedPostLink,
  ): Partial<PostMetadata> {
    return extractInstagramMetadata(postElement, link);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Button Injection
  // ─────────────────────────────────────────────────────────────────────────

  // Store click handler for global scanning
  private _clickHandler:
    | ((postElement: Element, button: HTMLButtonElement) => void)
    | null = null;

  injectButton(
    postElement: Element,
    onClick: (postElement: Element, button: HTMLButtonElement) => void,
  ): HTMLButtonElement | null {
    this._clickHandler = onClick;
    return injectInstagramButton(postElement, onClick);
  }

  hasButton(postElement: Element): boolean {
    return hasInstagramButton(postElement);
  }

  removeStaleButtons(): void {
    removeInstagramButtons();
  }

  /**
   * Instagram-specific: Called after standard injection to catch action bars
   * outside article elements (e.g., /p/ direct pages).
   */
  afterScan(): void {
    if (this._clickHandler) {
      injectIntoAllActionBars(this._clickHandler, (button) =>
        this.findPostRoot(button),
      );
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // URL Processing
  // ─────────────────────────────────────────────────────────────────────────

  canonicalizeUrl(rawUrl: string): string | null {
    return canonicalizeInstagramUrl(rawUrl);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Context Detection
  // ─────────────────────────────────────────────────────────────────────────

  detectSourceContext(): SourceContext {
    return detectInstagramContext();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Optional Methods
  // ─────────────────────────────────────────────────────────────────────────

  findPostRoot(button: Element): Element | null {
    // Check layout type
    const layout = button.getAttribute("data-magpie-layout");
    if (layout === "vertical") {
      return findReelItemRoot(button);
    }
    return findMediaRoot(button);
  }

  async warmUpVideoThumbnail(postElement: Element): Promise<void> {
    return warmUpVideoThumbnail(postElement);
  }
}
