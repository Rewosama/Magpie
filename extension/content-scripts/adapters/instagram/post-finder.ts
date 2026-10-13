/**
 * adapters/instagram/post-finder.ts
 * Instagram post element discovery.
 */

import { findNormalizedLinkInRoot } from "./url-utils";
import {
  MIN_CONTAINER_HEIGHT,
  MAX_WALK_DEPTH,
  SAVE_SEL,
  MORE_SEL,
} from "./selectors";
import type { SourceContext } from "../../../shared/platform";

// ─────────────────────────────────────────────────────────────────────────────
// Stop Conditions
// ─────────────────────────────────────────────────────────────────────────────

const STOP_CONDITIONS: ReadonlyArray<(el: Element) => boolean> = [
  (el) => el.tagName === "ARTICLE",
  (el) => el.getAttribute("role") === "dialog",
  (el) => el.tagName === "MAIN" || el.getAttribute("role") === "main",
];

// ─────────────────────────────────────────────────────────────────────────────
// Context Detection
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Detects the current source context based on URL.
 */
export function detectInstagramContext(): SourceContext {
  const path = window.location.pathname;

  if (path === "/" || path === "") return "feed";
  if (/^\/p\/[^/]+\/?$/.test(path)) return "post-page";
  if (/^\/reel\/[^/]+\/?$/.test(path)) return "reel-page";
  if (/^\/reels\/[^/]+\/?$/.test(path)) return "reel-page";
  if (/^\/explore/.test(path)) return "explore";
  if (/^\/[^/]+\/?$/.test(path)) return "profile";

  return "unknown";
}

// ─────────────────────────────────────────────────────────────────────────────
// Post Root Finding
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Checks if an element is a valid media root container.
 */
function isValidMediaRoot(el: Element): boolean {
  const matchesStop = STOP_CONDITIONS.some((fn) => fn(el));
  if (!matchesStop) return false;

  // MAIN container doesn't need size check
  const isMain = el.tagName === "MAIN" || el.getAttribute("role") === "main";
  if (!isMain) {
    const rect = el.getBoundingClientRect();
    if (rect.height < MIN_CONTAINER_HEIGHT) return false;
  }

  // On /p/ direct pages, MAIN is the post root but may not contain a permalink
  // (the URL itself is the permalink). Accept MAIN on post pages.
  if (isMain && detectInstagramContext() === "post-page") {
    return true;
  }

  // Must contain a valid permalink
  return findNormalizedLinkInRoot(el) !== null;
}

/**
 * Finds the media root container from a button element.
 */
export function findMediaRoot(startEl: Element): Element | null {
  let current: Element | null = startEl;
  let steps = 0;

  while (
    current &&
    current !== document.documentElement &&
    steps < MAX_WALK_DEPTH
  ) {
    if (isValidMediaRoot(current)) return current;
    current = current.parentElement;
    steps++;
  }

  return null;
}

/**
 * Finds the reel item root from a button (for vertical bar layout).
 */
export function findReelItemRoot(from: Element): Element | null {
  let best: Element | null = null;
  let el: Element | null = from.parentElement;

  while (el && el !== document.body && el !== document.documentElement) {
    const videos = el.querySelectorAll("video").length;
    if (videos > 1) break;
    if (videos === 1) best = el;
    if (el.tagName === "MAIN") break;
    el = el.parentElement;
  }

  return best;
}

// ─────────────────────────────────────────────────────────────────────────────
// Post Discovery
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Finds all post elements within a scope.
 */
export function findAllMediaRoots(
  scope: Element | Document = document,
): Element[] {
  const roots: Element[] = [];
  const seen = new WeakSet<Element>();

  // Scan articles first
  scope.querySelectorAll<Element>("article").forEach((el) => {
    if (!seen.has(el) && findNormalizedLinkInRoot(el)) {
      roots.push(el);
      seen.add(el);
    }
  });

  // Scan dialogs (modal posts/reels)
  scope.querySelectorAll<Element>('[role="dialog"]').forEach((el) => {
    if (!seen.has(el) && findNormalizedLinkInRoot(el)) {
      roots.push(el);
      seen.add(el);
    }
  });

  // On /p/ direct pages, there's no article - use MAIN as root
  if (
    roots.length === 0 &&
    scope === document &&
    detectInstagramContext() === "post-page"
  ) {
    const main = document.querySelector("main, [role='main']");
    if (main && !seen.has(main)) {
      roots.push(main);
      seen.add(main);
    }
  }

  return roots;
}

/**
 * Finds post elements for reels page specifically.
 */
export function findReelsPagePosts(): Element[] {
  const vh = window.innerHeight;
  const visibleHeight = (el: Element): number => {
    const r = el.getBoundingClientRect();
    return Math.max(0, Math.min(r.bottom, vh) - Math.max(r.top, 0));
  };

  const videos = Array.from(
    document.querySelectorAll<HTMLVideoElement>("video"),
  ).sort((a, b) => visibleHeight(b) - visibleHeight(a));

  if (videos.length === 0) return [];

  // Find the scope containing Save and More buttons
  let reelScope: Element | null = videos[0];
  while (reelScope && reelScope !== document.documentElement) {
    if (reelScope.querySelector(SAVE_SEL) && reelScope.querySelector(MORE_SEL))
      break;
    reelScope = reelScope.parentElement;
  }

  if (!reelScope || reelScope === document.documentElement) return [];

  return [reelScope];
}
