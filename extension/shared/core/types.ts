/**
 * core/types.ts
 * Shared types for the platform-agnostic core.
 */

import type { PostMetadata } from "../types/domain";

/**
 * Default collection stored in chrome.storage.local.
 */
export interface DefaultCollection {
  id: string;
  name: string;
}

/**
 * Storage key for default collection (per platform).
 */
export function getDefaultCollectionKey(platformId: string): string {
  return `magpie_default_collection_${platformId}`;
}

/**
 * Result of a save operation.
 */
export type SaveResult = "success" | "duplicate" | "error";

/**
 * Callback signature for button click handler.
 */
export type ButtonClickHandler = (
  postElement: Element,
  button: HTMLButtonElement
) => void;

/**
 * Options for the core initialization.
 */
export interface CoreOptions {
  /** Debounce delay for MutationObserver (ms) */
  observerDebounceMs?: number;
  /** Delay after route change before re-scanning (ms) */
  routeChangeDelayMs?: number;
}

/**
 * Post metadata with canonical URL attached.
 */
export interface ResolvedPostData {
  postElement: Element;
  canonicalUrl: string;
  postType: string;
  metadata: Partial<PostMetadata>;
}
