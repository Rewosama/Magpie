/**
 * core/save-flow.ts
 * Platform-agnostic save flow: default collection, direct save, collection picker.
 *
 * Handles the full save lifecycle:
 *  1. Check for cached default collection
 *  2. If found, save directly and show toast
 *  3. If not found, resolve from server or open collection picker
 */

import type { PostMetadata } from "../types/domain";
import type { PlatformAdapter } from "../platform";
import { setButtonState, flashError } from "../platform";
import {
  openModal,
  setOnSaveSuccessCallback,
} from "../../content-scripts/modal";
import { showToast } from "../../content-scripts/toast";
import { sendMessage } from "../sendMessage";
import type { DefaultCollection, SaveResult, ResolvedPostData } from "./types";
import { getDefaultCollectionKey } from "./types";

// ─────────────────────────────────────────────────────────────────────────────
// Default Collection Management
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Retrieves the cached default collection from chrome.storage.local.
 */
export async function getDefaultCollection(
  platformId: string,
): Promise<DefaultCollection | undefined> {
  try {
    const key = getDefaultCollectionKey(platformId);
    const stored = await chrome.storage.local.get(key);
    return stored[key] as DefaultCollection | undefined;
  } catch {
    return undefined;
  }
}

/**
 * Fetches collections from the server and caches the default.
 */
export async function resolveDefaultFromServer(
  platformId: string,
): Promise<DefaultCollection | undefined> {
  return new Promise((resolve) => {
    if (!chrome.runtime?.id) {
      resolve(undefined);
      return;
    }

    chrome.runtime.sendMessage(
      { type: "GET_COLLECTIONS" },
      (response: { success: boolean; data?: unknown }) => {
        if (chrome.runtime.lastError || !response?.success) {
          resolve(undefined);
          return;
        }

        const data = response.data as {
          collections?: Array<{
            id: string;
            name: string;
            is_default?: boolean;
          }>;
        };

        const cols = Array.isArray(data?.collections) ? data.collections : [];
        if (cols.length === 0) {
          resolve(undefined);
          return;
        }

        const chosen = cols.find((c) => c.is_default) ?? cols[0];
        const key = getDefaultCollectionKey(platformId);

        chrome.storage.local
          .set({ [key]: { id: chosen.id, name: chosen.name } })
          .catch(() => {});

        resolve({ id: chosen.id, name: chosen.name });
      },
    );
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Direct Save to Collection
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Saves a post directly to the specified collection.
 */
async function saveDirectToCollection(
  metadata: Partial<PostMetadata>,
  collection: DefaultCollection,
): Promise<SaveResult> {
  if (!metadata.post_url) return "error";

  try {
    const response = (await sendMessage<{
      success: boolean;
      error?: string;
      data?: { status?: string } | null;
    }>({
      type: "SAVE_POST",
      payload: {
        post_url: metadata.post_url,
        collection_id: collection.id,
        post_type: metadata.post_type ?? "post",
        platform: metadata.platform ?? "",
        author_username: metadata.author_username ?? null,
        author_display_name: metadata.author_display_name ?? null,
        author_avatar_url: metadata.author_avatar_url ?? null,
        content_text: metadata.content_text ?? null,
        media_urls: metadata.media_urls ?? null,
        post_timestamp: metadata.post_timestamp ?? null,
        raw_metadata: metadata.raw_metadata ?? null,
      },
    })) as {
      success: boolean;
      error?: string;
      data?: { status?: string } | null;
    };

    if (!response?.success) return "error";

    const data = response.data as { status?: string } | null;
    return data?.status === "updated" ? "duplicate" : "success";
  } catch {
    return "error";
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Collection Picker Flow
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Opens the collection picker modal.
 */
async function openCollectionPickerFlow(
  platformId: string,
  postElement: Element,
  metadata: Partial<PostMetadata>,
  isUpdate: boolean = false,
): Promise<void> {
  const key = getDefaultCollectionKey(platformId);

  setOnSaveSuccessCallback(
    (collectionId: string, collectionName: string | null) => {
      // Only persist as default on first selection, not on "Change collection"
      if (!isUpdate) {
        chrome.storage.local
          .set({
            [key]: {
              id: collectionId,
              name: collectionName ?? "Magpie",
            },
          })
          .catch(() => {});

        chrome.runtime
          .sendMessage({
            type: "SET_DEFAULT_COLLECTION",
            payload: { collection_id: collectionId },
          })
          .catch(() => {});
      }

      showToast({
        message: isUpdate
          ? "Collection updated ✓"
          : `Saved to ${collectionName ?? "Magpie"} ✓`,
        platform: platformId as "instagram" | "x" | "threads",
        onChangeCollection: () =>
          void openCollectionPickerFlow(
            platformId,
            postElement,
            metadata,
            true,
          ),
      });
    },
  );

  openModal(metadata);
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Save Handler
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Handles the complete save flow for a post.
 * Called when the user clicks the save button.
 */
export async function handleSaveFlow(
  adapter: PlatformAdapter,
  postElement: Element,
  button: HTMLButtonElement,
): Promise<void> {
  // Validate extension context
  if (typeof chrome === "undefined" || !chrome.runtime?.id) {
    showToast({
      message: "Magpie yenilenmesi gerekiyor — F5 basın.",
      platform: adapter.id as "instagram" | "x" | "threads",
    });
    flashError(button);
    return;
  }

  // Get post URL
  const link = adapter.getPostUrl(postElement);
  if (!link) {
    console.warn("[Magpie] Post URL could not be determined.");
    showToast({
      message: "Post URL'si bulunamadı.",
      platform: adapter.id as "instagram" | "x" | "threads",
    });
    flashError(button);
    return;
  }

  setButtonState(button, "loading");

  // Extract metadata
  const extractedMetadata = adapter.extractMetadata(postElement, link);

  // Build PostMetadata
  const metadata: Partial<PostMetadata> = {
    post_url: link.canonicalUrl,
    post_type: link.postType as PostMetadata["post_type"],
    platform: adapter.id as PostMetadata["platform"],
    author_username: extractedMetadata.author_username ?? null,
    author_display_name: extractedMetadata.author_display_name ?? null,
    author_avatar_url: extractedMetadata.author_avatar_url ?? null,
    content_text: extractedMetadata.content_text ?? null,
    media_urls: extractedMetadata.media_urls ?? [],
    post_timestamp: extractedMetadata.post_timestamp ?? null,
    raw_metadata: {
      page_url: window.location.href,
      extracted_at: new Date().toISOString(),
      ...((extractedMetadata.raw_metadata as object) ?? {}),
    },
  };

  // Try default collection
  let defaultCol = await getDefaultCollection(adapter.id);
  if (!defaultCol) {
    defaultCol = await resolveDefaultFromServer(adapter.id);
  }

  if (defaultCol) {
    const result = await saveDirectToCollection(metadata, defaultCol);

    if (result === "success") {
      setButtonState(button, "saved");
      showToast({
        message: `Saved to ${defaultCol.name} ✓`,
        platform: adapter.id as "instagram" | "x" | "threads",
        onChangeCollection: () =>
          void openCollectionPickerFlow(
            adapter.id,
            postElement,
            metadata,
            true,
          ),
      });
    } else if (result === "duplicate") {
      setButtonState(button, "duplicate");
      showToast({
        message: `Zaten kayıtlı (${defaultCol.name})`,
        platform: adapter.id as "instagram" | "x" | "threads",
        onChangeCollection: () =>
          void openCollectionPickerFlow(
            adapter.id,
            postElement,
            metadata,
            true,
          ),
      });
    } else {
      // Save failed - clear cached default and open picker
      const key = getDefaultCollectionKey(adapter.id);
      await chrome.storage.local.remove(key).catch(() => {});
      setButtonState(button, "idle");
      showToast({
        message: "Kaydetme başarısız — koleksiyon seçin.",
        platform: adapter.id as "instagram" | "x" | "threads",
      });
      await openCollectionPickerFlow(adapter.id, postElement, metadata, false);
    }
  } else {
    // No default - open collection picker
    setButtonState(button, "idle");
    await openCollectionPickerFlow(adapter.id, postElement, metadata, false);
  }
}
