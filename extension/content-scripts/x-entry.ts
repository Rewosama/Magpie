/**
 * content-scripts/x-entry.ts
 * Entry point for X/Twitter content script.
 *
 * This file imports the X adapter and starts the platform core.
 * It should be bundled as dist/content-scripts/x.js
 */

import { XAdapter } from "./adapters/x/adapter";
import { startPlatformCore } from "../shared/core";

// Initialize on document ready
function initialize(): void {
  const adapter = new XAdapter();
  startPlatformCore(adapter);
}

// Handle document ready state
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initialize, { once: true });
} else {
  initialize();
}
