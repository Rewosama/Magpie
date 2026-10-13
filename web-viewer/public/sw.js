/**
 * Minimal Service Worker for PWA installability.
 *
 * This SW doesn't implement offline caching — it exists solely to satisfy
 * the PWA install criteria (manifest + registered service worker).
 *
 * The web viewer requires network connectivity to fetch posts from Supabase,
 * so offline support would add complexity without meaningful benefit.
 */

const CACHE_NAME = "magpie-v4";

// Install: skip waiting to activate immediately
self.addEventListener("install", (event) => {
  self.skipWaiting();
});

// Activate: claim all clients
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // Clean up old caches if any
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key)),
      );
      // Take control of all pages immediately
      await self.clients.claim();
    })(),
  );
});

// Fetch: network-only (no caching)
// We pass through all requests to the network
self.addEventListener("fetch", (event) => {
  // Don't interfere with requests, let them go to network
  return;
});
