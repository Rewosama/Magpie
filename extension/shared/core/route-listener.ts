/**
 * core/route-listener.ts
 * Platform-agnostic SPA route change detection.
 *
 * Patches history.pushState/replaceState and listens to popstate events
 * to detect client-side navigation without full page reloads.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

export const ROUTE_CHANGE_EVENT = "magpie:route-change";

/** Default delay after route change before invoking callback (ms) */
const DEFAULT_ROUTE_CHANGE_DELAY_MS = 350;

// ─────────────────────────────────────────────────────────────────────────────
// State
// ─────────────────────────────────────────────────────────────────────────────

let initialized = false;
let routeChangeDelayMs = DEFAULT_ROUTE_CHANGE_DELAY_MS;

// ─────────────────────────────────────────────────────────────────────────────
// History Patching
// ─────────────────────────────────────────────────────────────────────────────

type HistoryMethod = "pushState" | "replaceState";

function patchHistoryMethod(method: HistoryMethod): void {
  const original = history[method].bind(history);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (history[method] as any) = function (
    data: unknown,
    unused: string,
    url?: string | URL | null
  ) {
    original(data, unused, url);
    dispatchRouteChange();
  };
}

function dispatchRouteChange(): void {
  setTimeout(() => {
    window.dispatchEvent(new CustomEvent(ROUTE_CHANGE_EVENT));
  }, routeChangeDelayMs);
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Sets up the SPA route listener.
 * Idempotent: calling multiple times has no effect.
 *
 * @param onRouteChange - Callback invoked after route changes
 * @param delayMs - Delay before invoking callback (default: 350ms)
 */
export function setupRouteListener(
  onRouteChange: () => void,
  delayMs: number = DEFAULT_ROUTE_CHANGE_DELAY_MS
): void {
  if (initialized) return;
  initialized = true;
  routeChangeDelayMs = delayMs;

  // Patch history methods
  patchHistoryMethod("pushState");
  patchHistoryMethod("replaceState");

  // Listen to back/forward navigation
  window.addEventListener("popstate", dispatchRouteChange);

  // Custom event listener
  window.addEventListener(ROUTE_CHANGE_EVENT, onRouteChange);
}

/**
 * Resets the route listener state (for testing).
 */
export function resetRouteListener(): void {
  initialized = false;
}
