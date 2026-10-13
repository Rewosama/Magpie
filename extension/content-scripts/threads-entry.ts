/**
 * content-scripts/threads-entry.ts
 * Entry point for Threads content script.
 *
 * This file imports the Threads adapter and starts the platform core.
 * It should be bundled as dist/content-scripts/threads.js
 */

import { ThreadsAdapter } from "./adapters/threads/adapter";
import { startPlatformCore } from "../shared/core";

// Initialize on document ready
function initialize(): void {
  const adapter = new ThreadsAdapter();
  startPlatformCore(adapter);
}

// Handle document ready state
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initialize, { once: true });
} else {
  initialize();
}
