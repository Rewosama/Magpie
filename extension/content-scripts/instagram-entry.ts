/**
 * content-scripts/instagram-entry.ts
 * Entry point for Instagram content script.
 *
 * This file imports the Instagram adapter and starts the platform core.
 * It should be bundled as dist/content-scripts/instagram.js
 */

import { InstagramAdapter } from "./adapters/instagram/adapter";
import { startPlatformCore } from "../shared/core";

// Initialize on document ready
function initialize(): void {
  const adapter = new InstagramAdapter();
  startPlatformCore(adapter);
}

// Handle document ready state
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initialize, { once: true });
} else {
  initialize();
}
