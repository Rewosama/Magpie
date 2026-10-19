/**
 * core/index.ts
 * Platform-agnostic core that orchestrates the Magpie extension.
 *
 * Usage:
 *   import { startPlatformCore } from "../shared/core";
 *   import { MyPlatformAdapter } from "./adapters/my-platform/adapter";
 *
 *   startPlatformCore(new MyPlatformAdapter());
 */

import type { PlatformAdapter } from "../platform";
import { startObserver, stopObserver } from "./observer";
import { setupRouteListener } from "./route-listener";
import { handleSaveFlow } from "./save-flow";
import type { CoreOptions } from "./types";

// ─────────────────────────────────────────────────────────────────────────────
// Defaults
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_OPTIONS: Required<CoreOptions> = {
  observerDebounceMs: 150,
  routeChangeDelayMs: 350,
};

// ─────────────────────────────────────────────────────────────────────────────
// Core Initialization
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Starts the Magpie core with the given platform adapter.
 *
 * This function:
 *  1. Removes any stale buttons from previous sessions
 *  2. Scans the current DOM for posts and injects buttons
 *  3. Sets up SPA route change detection
 *  4. Starts the MutationObserver for dynamic content
 *
 * @param adapter - Platform-specific adapter implementing PlatformAdapter
 * @param options - Optional configuration overrides
 */
export function startPlatformCore(
  adapter: PlatformAdapter,
  options: CoreOptions = {},
): void {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  // Button click handler - wired to the save flow
  const onButtonClick = (
    postElement: Element,
    button: HTMLButtonElement,
  ): void => {
    void handleSaveFlow(adapter, postElement, button);
  };

  // Scan and inject into a root element
  const scanAndInject = (root: Element | Document): void => {
    const posts = adapter.findPostElements(root);
    for (const post of posts) {
      if (adapter.hasButton(post)) continue;

      const button = adapter.injectButton(post, onButtonClick);

      // Warm up video thumbnail if applicable
      if (button && adapter.warmUpVideoThumbnail) {
        const hasVideo = post.querySelector("video") !== null;
        if (hasVideo) {
          adapter.warmUpVideoThumbnail(post).catch(() => {});
        }
      }
    }

    // Platform-specific additional scanning (e.g., Instagram global action bars)
    if (adapter.afterScan) {
      adapter.afterScan();
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Initialization Steps
  // ─────────────────────────────────────────────────────────────────────────

  // 1. Platform-specific initialization
  if (adapter.initialize) {
    adapter.initialize();
  }

  // 2. Remove stale buttons from previous extension loads
  adapter.removeStaleButtons();

  // 3. Initial DOM scan
  scanAndInject(document);

  // 4. Set up SPA route change listener
  setupRouteListener(() => {
    // Platform-specific route change handling
    if (adapter.onRouteChange) {
      adapter.onRouteChange();
    }
    // Re-scan after route change (with small delay for React render)
    setTimeout(() => scanAndInject(document), 200);
  }, opts.routeChangeDelayMs);

  // 5. Start MutationObserver for dynamic content
  startObserver((addedNodes) => {
    for (const node of addedNodes) {
      if (node.nodeType !== Node.ELEMENT_NODE) continue;

      const element = node as Element;

      // Check if the added node itself is a post
      if (
        adapter.findPostElements(element).length > 0 ||
        element.matches?.("article, [role='dialog']")
      ) {
        scanAndInject(element);
      }

      // Also check children
      scanAndInject(element);
    }

    // Full document rescan to catch buttons removed by SPA reconciliation
    scanAndInject(document);
  }, opts.observerDebounceMs);
}

/**
 * Stops the Magpie core (for cleanup/testing).
 */
export function stopPlatformCore(): void {
  stopObserver();
}

// Re-export types and utilities
export * from "./types";
export * from "./save-flow";
export * from "./observer";
export * from "./route-listener";
