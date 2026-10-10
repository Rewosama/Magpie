/**
 * route-listener.ts
 * Instagram SPA route değişimlerini dinler ve custom event yayar.
 * history.pushState / replaceState patch'lenir, popstate dinlenir.
 */

import type { SourceContext } from "./types";

// ---------------------------------------------------------------------------
// Sabitler
// ---------------------------------------------------------------------------

export const ROUTE_CHANGE_EVENT = "magpie:route-change";

/** Route değişiminden sonra injection öncesi bekleme süresi (ms).
 *  React render'ının tamamlanması için küçük bir gecikme gerekir. */
const ROUTE_CHANGE_DELAY_MS = 350;

// ---------------------------------------------------------------------------
// Sayfa bağlamı tespiti
// ---------------------------------------------------------------------------

/**
 * Mevcut URL'ye göre kaynak bağlamı tespit eder.
 * Buton injection ve fallback kararlarında kullanılır.
 */
export function detectSourceContext(): SourceContext {
  const path = window.location.pathname;

  if (path === "/" || path === "") return "feed";
  if (/^\/p\/[^/]+\/?$/.test(path)) return "post-page";
  if (/^\/reel\/[^/]+\/?$/.test(path)) return "reel-page";
  if (/^\/reels\/[^/]+\/?$/.test(path)) return "reel-page";
  if (/^\/explore/.test(path)) return "explore";
  if (/^\/[^/]+\/?$/.test(path)) return "profile"; // "/username/"

  return "unknown";
}

// ---------------------------------------------------------------------------
// History patch
// ---------------------------------------------------------------------------

type HistoryMethod = "pushState" | "replaceState";

function patchHistoryMethod(method: HistoryMethod): void {
  const original = history[method].bind(history);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (history[method] as any) = function (
    data: unknown,
    unused: string,
    url?: string | URL | null,
  ) {
    original(data, unused, url);
    dispatchRouteChange();
  };
}

function dispatchRouteChange(): void {
  setTimeout(() => {
    window.dispatchEvent(new CustomEvent(ROUTE_CHANGE_EVENT));
  }, ROUTE_CHANGE_DELAY_MS);
}

// ---------------------------------------------------------------------------
// Kurulum
// ---------------------------------------------------------------------------

/**
 * SPA route listener'larını kurar.
 * Birden fazla kez çağrılsa da patch yalnızca bir kez uygulanır.
 */
let initialized = false;

export function setupRouteListener(onRouteChange: () => void): void {
  if (initialized) return;
  initialized = true;

  // history.pushState / replaceState patch
  patchHistoryMethod("pushState");
  patchHistoryMethod("replaceState");

  // popstate (geri/ileri navigasyon)
  window.addEventListener("popstate", dispatchRouteChange);

  // Custom event dinleyici
  window.addEventListener(ROUTE_CHANGE_EVENT, onRouteChange);
}
