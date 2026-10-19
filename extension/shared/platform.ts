/**
 * platform.ts
 * Platform-agnostic adapter interface for Magpie extension.
 *
 * Each social media platform implements this interface to provide
 * platform-specific DOM selectors, metadata extraction, and button injection.
 * The core logic (observer, route listener, save flow) remains shared.
 */

import type { PostMetadata } from "./types/domain";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Normalized post link returned by the adapter.
 * Used for deduplication and canonical URL storage.
 */
export interface NormalizedPostLink {
  /** Platform-specific identifier (shortcode, tweet ID, etc.) */
  id: string;
  /** Canonical URL for deduplication */
  canonicalUrl: string;
  /** Post type as defined by the platform */
  postType: string;
}

/**
 * Button states shared across all platforms.
 */
export type ButtonState = "idle" | "loading" | "saved" | "error" | "duplicate";

/**
 * Source context describing where the user is on the platform.
 * Helps with fallback strategies and context-aware extraction.
 */
export type SourceContext =
  | "feed"
  | "post-page"
  | "reel-page"
  | "profile"
  | "explore"
  | "modal"
  | "unknown";

// ─────────────────────────────────────────────────────────────────────────────
// Platform Adapter Interface
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Platform-specific adapter interface.
 * Each platform (Instagram, X, Threads, etc.) implements this interface.
 */
export interface PlatformAdapter {
  // ───────────────────────────────────────────────────────────────────────────
  // Identity
  // ───────────────────────────────────────────────────────────────────────────

  /** Platform identifier: "instagram" | "x" | "threads" | ... */
  readonly id: string;

  /** URL patterns for manifest.json content_scripts matches */
  readonly hostMatches: readonly string[];

  // ───────────────────────────────────────────────────────────────────────────
  // Post Discovery
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Finds all post elements within the given root.
   * Called during initial scan and after DOM mutations.
   *
   * @param root - Element or Document to search within
   * @returns Array of post container elements
   */
  findPostElements(root: Element | Document): Element[];

  /**
   * Extracts the canonical URL from a post element.
   * Returns null if the URL cannot be determined.
   *
   * @param postElement - Post container element
   * @returns Normalized link or null if not found
   */
  getPostUrl(postElement: Element): NormalizedPostLink | null;

  // ───────────────────────────────────────────────────────────────────────────
  // Metadata Extraction
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Extracts metadata from a post element.
   * All fields are optional; the core handles missing data gracefully.
   *
   * @param postElement - Post container element
   * @param link - Normalized link for context (e.g., verifying og:meta freshness)
   * @returns Partial metadata object
   */
  extractMetadata(
    postElement: Element,
    link: NormalizedPostLink,
  ): Partial<PostMetadata>;

  // ───────────────────────────────────────────────────────────────────────────
  // Button Injection
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Injects the save button into a post element.
   * Should handle platform-specific positioning and styling.
   *
   * @param postElement - Post container element
   * @param onClick - Callback when button is clicked
   * @returns The injected button element, or null if injection failed
   */
  injectButton(
    postElement: Element,
    onClick: (postElement: Element, button: HTMLButtonElement) => void,
  ): HTMLButtonElement | null;

  /**
   * Checks if a save button is already present in the post element.
   *
   * @param postElement - Post container element
   * @returns true if button exists
   */
  hasButton(postElement: Element): boolean;

  /**
   * Removes stale buttons from the document.
   * Called on extension reload to clean up orphaned buttons.
   */
  removeStaleButtons(): void;

  // ───────────────────────────────────────────────────────────────────────────
  // URL Processing
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Converts a raw URL to canonical form for deduplication.
   * Strips tracking parameters, normalizes host, etc.
   *
   * @param rawUrl - Raw URL string
   * @returns Canonical URL or null if not a valid post URL
   */
  canonicalizeUrl(rawUrl: string): string | null;

  // ───────────────────────────────────────────────────────────────────────────
  // Context Detection
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Detects the current source context based on URL/DOM.
   * Used for context-aware extraction and fallback strategies.
   *
   * @returns Current source context
   */
  detectSourceContext(): SourceContext;

  // ───────────────────────────────────────────────────────────────────────────
  // Optional: Platform-Specific Behaviors
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Finds the post root element from a button element.
   * Used for button→post mapping during save flow.
   * Default implementation uses closest ancestor search.
   *
   * @param button - Button element
   * @returns Post container element or null
   */
  findPostRoot?(button: Element): Element | null;

  /**
   * Warms up video thumbnail cache for a post element.
   * Called when a video post is detected to pre-capture frames.
   *
   * @param postElement - Post container element
   */
  warmUpVideoThumbnail?(postElement: Element): Promise<void>;

  /**
   * Platform-specific initialization logic.
   * Called once when the adapter is activated.
   */
  initialize?(): void;

  /**
   * Platform-specific route change handler.
   * Called after SPA navigation is detected.
   */
  onRouteChange?(): void;

  /**
   * Called after standard scan completes.
   * Allows platform-specific additional scanning (e.g., Instagram global action bars).
   */
  afterScan?(): void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Button Utilities (Shared)
// ─────────────────────────────────────────────────────────────────────────────

/** Data attribute used to mark injected buttons */
export const BUTTON_ATTR = "data-magpie-save-button";
export const BUTTON_SELECTOR = `[${BUTTON_ATTR}]`;

/**
 * Returns the SVG icon for a given button state.
 * Archive-box icon, visually distinct from platform-native icons.
 */
export function getButtonIcon(state: ButtonState): string {
  if (state === "loading") {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
      <circle cx="12" cy="12" r="10" opacity=".25"/>
      <path d="M12 2a10 10 0 0 1 10 10" stroke-width="2.5">
        <animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur=".75s" repeatCount="indefinite"/>
      </path></svg>`;
  }
  const dim = state === "saved" || state === "duplicate" ? 'opacity=".5"' : "";
  const color = state === "duplicate" ? "color:#0095f6;" : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="currentColor" aria-hidden="true" style="${color}"><path d="M20 3H4a1 1 0 0 0-1 1v3a1 1 0 0 0 1 1v11a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V8a1 1 0 0 0 1-1V4a1 1 0 0 0-1-1zm-1 15H5V8h14v10zM5 6V5h14v1H5zm7 4H9v2h3v2h2v-2h3v-2h-3V8h-2v2z" ${dim}/></svg>`;
}

/**
 * Sets the visual state of a button.
 */
export function setButtonState(
  btn: HTMLButtonElement,
  state: ButtonState,
): void {
  btn.innerHTML = getButtonIcon(state);
  btn.disabled = state === "loading";
  btn.setAttribute("data-state", state);
}

/**
 * Flashes an error state on a button, then resets to idle.
 */
export function flashError(btn: HTMLButtonElement): void {
  setButtonState(btn, "error");
  window.setTimeout(() => {
    if (btn.getAttribute("data-state") === "error") {
      setButtonState(btn, "idle");
    }
  }, 2500);
}
