/**
 * core/observer.ts
 * Platform-agnostic MutationObserver for detecting DOM changes.
 *
 * Monitors the document for added nodes (infinite scroll, lazy load, SPA updates)
 * and invokes a callback with the added elements.
 */

import { BUTTON_ATTR } from "../platform";

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_DEBOUNCE_MS = 150;

/**
 * Attributes to ignore when filtering mutations.
 * Prevents infinite loops from our own button state changes.
 */
const IGNORE_ATTRS = new Set([BUTTON_ATTR, "data-state"]);

// ─────────────────────────────────────────────────────────────────────────────
// Debounce Utility
// ─────────────────────────────────────────────────────────────────────────────

function debounce<A extends unknown[]>(
  fn: (...args: A) => void,
  ms: number
): (...args: A) => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return (...args: A) => {
    if (timer !== null) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      fn(...args);
    }, ms);
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Observer State
// ─────────────────────────────────────────────────────────────────────────────

let observer: MutationObserver | null = null;

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

export type MutationCallback = (addedNodes: Node[]) => void;

/**
 * Starts the MutationObserver with the given callback.
 * Idempotent: calling multiple times has no effect.
 *
 * @param onMutation - Callback invoked with added nodes
 * @param debounceMs - Debounce delay in milliseconds
 */
export function startObserver(
  onMutation: MutationCallback,
  debounceMs: number = DEFAULT_DEBOUNCE_MS
): void {
  if (observer !== null) return;

  const processMutations = (mutations: MutationRecord[]): void => {
    const addedNodes: Node[] = [];

    for (const mutation of mutations) {
      // Skip our own attribute changes
      if (
        mutation.type === "attributes" &&
        IGNORE_ATTRS.has(mutation.attributeName ?? "")
      ) {
        continue;
      }

      for (const node of Array.from(mutation.addedNodes)) {
        addedNodes.push(node);
      }
    }

    if (addedNodes.length === 0) return;

    try {
      onMutation(addedNodes);
    } catch (err) {
      console.warn("[Magpie] Observer callback error:", err);
    }
  };

  const debouncedProcess = debounce(processMutations, debounceMs);

  observer = new MutationObserver((mutations) => {
    // Stop if extension context is invalidated
    if (typeof chrome === "undefined" || !chrome.runtime?.id) {
      observer?.disconnect();
      observer = null;
      return;
    }
    debouncedProcess(mutations);
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
  });
}

/**
 * Stops the MutationObserver.
 * Safe to call even if not started.
 */
export function stopObserver(): void {
  observer?.disconnect();
  observer = null;
}
