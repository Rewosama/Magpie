/**
 * Extension Popup
 *
 * Responsibilities:
 *  - Show a Google OAuth login button when no valid session exists (Req 12.1)
 *  - Transition to the authenticated collection management view on login (Req 12.3)
 *  - Route all requests through the Background Service Worker via chrome.runtime.sendMessage
 *
 * Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 13.1–13.12
 */

import type {
  BackgroundResponse,
  OutboundMessage,
} from "../shared/types/messages";
import type { Collection, StoredSession } from "../shared/types/domain";
// Helper: extract Collection[] from ManageCollectionResponse (list operation)
function extractCollections(data: unknown): Collection[] {
  if (!data) return [];
  const d = data as Record<string, unknown>;
  if (Array.isArray(d["collections"])) return d["collections"] as Collection[];
  if (Array.isArray(data)) return data as Collection[];
  return [];
}



// Build-time injected by esbuild from .env
/** chrome.storage.local key for cached collections */
const COLLECTIONS_CACHE_KEY = "magpie_collections_cache";
const THEME_CACHE_KEY = "magpie_popup_theme";

function applyTheme(dark: boolean): void {
  document.documentElement.classList.toggle("dark", dark);
  const btn = document.getElementById("theme-btn");
  if (btn) btn.innerHTML = dark ? sunIconSvg() : moonIconSvg();
}

async function toggleTheme(): Promise<void> {
  const isDark = document.documentElement.classList.contains("dark");
  const next = !isDark;
  applyTheme(next);
  chrome.storage.local.set({ [THEME_CACHE_KEY]: next ? "dark" : "light" }).catch(() => {});
}

function moonIconSvg(): string {
  return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`;
}

function sunIconSvg(): string {
  return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>`;
}

const WEB_VIEWER_URL: string = process.env.WEB_VIEWER_URL ?? "http://localhost:3001";

// ── Module state ──────────────────────────────────────────────────────────────

/**
 * Local mirror of the currently displayed collection list.
 * Mutated by handleCreate/Rename/DeleteCollection; always kept in sync with
 * whatever is rendered in the DOM.
 */
let collections: Collection[] = [];

// ── DOM helpers ───────────────────────────────────────────────────────────────

function getApp(): HTMLElement {
  const app = document.getElementById("app");
  if (!app) throw new Error("[Magpie] Missing #app element");
  return app;
}

/** Finds a rendered collection item element by its collection id. */
function getCollectionItemEl(id: string): HTMLElement | null {
  return (
    Array.from(document.querySelectorAll<HTMLElement>(".collection-item")).find(
      (el) => el.dataset["id"] === id,
    ) ?? null
  );
}

// ── Validation ────────────────────────────────────────────────────────────────

/**
 * Validates a collection name string.
 * Returns an error message if invalid, or null if the name is acceptable.
 * Requirement 13.11
 */
export function validateCollectionName(name: string): string | null {
  if (!name.trim()) return "Name cannot be empty or whitespace only";
  if (name.length > 100) return "Name must be 100 characters or fewer";
  return null;
}

// ── Security helper ───────────────────────────────────────────────────────────

/** Escapes user-supplied strings before inserting them into innerHTML. */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// ── Render: loading ───────────────────────────────────────────────────────────

function renderLoadingState(): void {
  getApp().innerHTML = `
    <div class="loading-container">
      <div class="loading-spinner" aria-label="Loading…" role="status"></div>
    </div>
  `;
}

// ── Render: login view ────────────────────────────────────────────────────────

/**
 * Renders the unauthenticated state with a "Continue with Google" button.
 * An optional error message is displayed when auth fails (Req 12.4).
 * No error is displayed on OAuth cancellation (Req 12.5).
 *
 * Requirement 12.1
 */
function renderLoginView(errorMsg?: string): void {
  const isDark = document.documentElement.classList.contains("dark");
  getApp().innerHTML = `
    <div class="login-container">
      <button id="theme-btn-login" class="btn btn--icon login-theme-btn" type="button" title="Temayı değiştir">
        ${isDark ? sunIconSvg() : moonIconSvg()}
      </button>
      <div class="login-header">
        <div class="login-logo" aria-hidden="true">
          <img src="../../icons/icon128.png" alt="Magpie" width="72" height="72"
               style="border-radius:18px;display:block;" />
        </div>
        <h1 class="login-title">Magpie</h1>
        <p class="login-subtitle">Save posts from Instagram and X to your private archive</p>
      </div>

      ${errorMsg ? `<div class="error-message" role="alert">${escapeHtml(errorMsg)}</div>` : ""}

      <button id="login-btn" class="btn btn--google" type="button">
        <svg class="btn__icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"
             width="18" height="18" aria-hidden="true">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26
            1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23
            1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43
            8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1
            12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
        </svg>
        Continue with Google
      </button>
    </div>
  `;

  document.getElementById("login-btn")?.addEventListener("click", () => {
    void handleLogin();
  });
  document.getElementById("theme-btn-login")?.addEventListener("click", () => {
    void toggleTheme().then(() => renderLoginView(errorMsg));
  });
}

// ── Render helpers: collection view ───────────────────────────────────────────

/**
 * Returns the inner HTML for a collection item in its normal (non-editing) state.
 * Used both for initial render and for restoring after a cancelled edit.
 */
function collectionItemViewHtml(c: Collection): string {
  const safeName = escapeHtml(c.name);
  return `
    <span class="collection-name">${safeName}</span>
    <div class="collection-actions">
      <button class="btn btn--text btn--small" data-action="rename" type="button"
              aria-label="Rename ${safeName}">Rename</button>
      <button class="btn btn--text btn--small btn--danger" data-action="delete" type="button"
              aria-label="Delete ${safeName}">Delete</button>
    </div>
  `;
}

/** Returns the full outer `<div class="collection-item">` HTML for a collection. */
function collectionItemHtml(c: Collection): string {
  return `<div class="collection-item" data-id="${escapeHtml(c.id)}">${collectionItemViewHtml(c)}</div>`;
}

/**
 * Returns the inner HTML for a collection item in rename mode.
 * Preserves `currentValue` so the user's input survives a validation error.
 */
function renameFormInnerHtml(currentValue: string, errorMsg?: string): string {
  return `
    <div class="rename-form">
      <input class="input" type="text" value="${escapeHtml(currentValue)}"
             maxlength="100" aria-label="New collection name" />
      <div class="collection-actions">
        <button class="btn btn--primary btn--small" data-action="rename-save"
                type="button">Save</button>
        <button class="btn btn--text btn--small" data-action="rename-cancel"
                type="button">Cancel</button>
      </div>
    </div>
    ${errorMsg ? `<p class="error-inline" role="alert">${escapeHtml(errorMsg)}</p>` : ""}
  `;
}

/**
 * Returns the HTML for the "add new collection" section at the bottom of the list.
 * When `expanded` is true, shows the inline input form (Req 13.3).
 */
function addSectionHtml(
  expanded = false,
  inputValue = "",
  errorMsg?: string,
): string {
  if (!expanded) {
    return `
      <div id="add-collection-section">
        <button class="btn btn--text btn--small collection-add-toggle"
                data-action="add-toggle" type="button">+ Add new collection</button>
      </div>
    `;
  }
  return `
    <div id="add-collection-section">
      ${errorMsg ? `<p class="error-inline" role="alert">${escapeHtml(errorMsg)}</p>` : ""}
      <div class="rename-form">
        <input class="input" id="add-collection-input" type="text"
               value="${escapeHtml(inputValue)}" placeholder="Collection name"
               maxlength="100" aria-label="New collection name" />
        <div class="collection-actions">
          <button class="btn btn--primary btn--small" data-action="add-save"
                  type="button">Add</button>
          <button class="btn btn--text btn--small" data-action="add-cancel"
                  type="button">Cancel</button>
        </div>
      </div>
    </div>
  `;
}

// ── Error display helper ──────────────────────────────────────────────────────

/**
 * Prepends a dismissible error banner to the collections list area.
 * Replaces any existing banner so at most one is visible at a time.
 *
 * Used for failures that can't be shown inline (e.g. delete failures where
 * the item is still in normal view mode).
 * Requirement 13.12
 */
function showCollectionViewError(msg: string): void {
  const list = document.getElementById("collections-list");
  if (!list) return;

  list.querySelector(".collection-error-banner")?.remove();

  const banner = document.createElement("div");
  banner.className = "error-message collection-error-banner";
  banner.setAttribute("role", "alert");
  banner.textContent = msg;
  list.insertAdjacentElement("afterbegin", banner);
}

// ── Render: collection view ───────────────────────────────────────────────────

/**
 * Renders the authenticated collection management view.
 * Completely re-renders #app and re-wires all event listeners.
 *
 * Calling this with an updated `collections` array is the canonical way to
 * apply create / delete changes to the UI.  Rename updates the DOM in-place
 * (handleRenameCollection) to avoid losing focus on the input.
 *
 * Requirements: 13.1, 13.2, 13.3, 13.9
 */
export function renderCollectionView(cols: Collection[] | unknown = [], showSpinner = false): void {
  // Defensive: handle non-array input gracefully
  const safeArray: Collection[] = Array.isArray(cols) ? (cols as Collection[]) : [];
  console.log("[Magpie] renderCollectionView called with", safeArray.length, "items");
  collections = [...safeArray];

  const isDark = document.documentElement.classList.contains("dark");
  const listItemsHtml =
    showSpinner
      ? '<div class="collections-loading"><div class="loading-spinner" aria-label="Yükleniyor…" role="status"></div></div>'
      : safeArray.length === 0
        ? '<p class="empty-message">No collections yet</p>'
        : safeArray.map(collectionItemHtml).join("");

  getApp().innerHTML = `
    <div class="collections-container">
      <div class="collections-header">
        <h1 class="collections-title">My Collections</h1>
        <div class="header-actions">
          <button id="theme-btn" class="btn btn--icon" type="button" title="Temayı değiştir">
            ${isDark ? sunIconSvg() : moonIconSvg()}
          </button>
          <button id="logout-btn" class="btn btn--logout" type="button" title="Çıkış yap">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
          </button>
        </div>
      </div>
      <div class="collections-list" id="collections-list">
        ${listItemsHtml}
        ${showSpinner ? "" : addSectionHtml()}
      </div>
      <div class="collections-footer">
        <button id="open-web-btn" class="web-archive-btn" type="button">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
          <span>Web Arşivini Aç</span>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="arrow" aria-hidden="true"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
        </button>
      </div>
    </div>
  `;

  // Theme toggle
  document.getElementById("theme-btn")?.addEventListener("click", () => {
    void toggleTheme();
  });

  // Logout wiring (Req 13.9, 13.10)
  document.getElementById("logout-btn")?.addEventListener("click", () => {
    void handleLogout();
  });

  // Open web viewer
  document.getElementById("open-web-btn")?.addEventListener("click", (e) => {
    e.preventDefault();
    chrome.tabs.create({ url: WEB_VIEWER_URL }).catch(() => {});
  });

  // Single delegated listener handles all collection list interactions
  const list = document.getElementById("collections-list");
  list?.addEventListener("click", (e) => {
    void handleCollectionListClick(e);
  });
  list?.addEventListener("keydown", (e) => {
    void handleCollectionListKeydown(e as KeyboardEvent);
  });
}

// ── Event delegation ──────────────────────────────────────────────────────────

/**
 * Click delegation handler for the collections list.
 * Routes button activations by their `data-action` attribute.
 *
 * Actions handled:
 *  rename        → enter inline rename mode for the item (Req 13.5)
 *  rename-save   → submit rename (Req 13.6)
 *  rename-cancel → restore normal item view
 *  delete        → confirm + delete collection (Req 13.7, 13.8)
 *  add-toggle    → expand the "add new collection" form (Req 13.3)
 *  add-save      → submit new collection (Req 13.4)
 *  add-cancel    → collapse the add form
 */
async function handleCollectionListClick(e: Event): Promise<void> {
  const target = e.target as HTMLElement;
  const actionEl = target.closest<HTMLElement>("[data-action]");
  if (!actionEl) return;

  const action = actionEl.dataset["action"];
  const item = actionEl.closest<HTMLElement>(".collection-item");
  const id = item?.dataset["id"] ?? "";

  switch (action) {
    // ── Rename ───────────────────────────────────────────────────────────────
    case "rename": {
      if (!item || !id) return;
      const col = collections.find((c) => c.id === id);
      if (!col) return;
      item.innerHTML = renameFormInnerHtml(col.name);
      item.classList.add("collection-item--editing");
      const inp = item.querySelector<HTMLInputElement>("input");
      inp?.focus();
      inp?.select();
      break;
    }

    case "rename-save": {
      if (!item || !id) return;
      const input = item.querySelector<HTMLInputElement>("input");
      if (!input) return;
      await handleRenameCollection(id, input.value);
      break;
    }

    case "rename-cancel": {
      if (!item || !id) return;
      const col = collections.find((c) => c.id === id);
      if (!col) return;
      item.innerHTML = collectionItemViewHtml(col);
      item.classList.remove("collection-item--editing");
      break;
    }

    // ── Delete ───────────────────────────────────────────────────────────────
    case "delete": {
      if (!id) return;
      await handleDeleteCollection(id);
      break;
    }

    // ── Add new collection ────────────────────────────────────────────────────
    case "add-toggle": {
      const section = document.getElementById("add-collection-section");
      if (!section) return;
      section.outerHTML = addSectionHtml(true);
      document.getElementById("add-collection-input")?.focus();
      break;
    }

    case "add-save": {
      const input = document.getElementById(
        "add-collection-input",
      ) as HTMLInputElement | null;
      if (!input) return;
      await handleCreateCollection(input.value);
      break;
    }

    case "add-cancel": {
      const section = document.getElementById("add-collection-section");
      if (!section) return;
      section.outerHTML = addSectionHtml(false);
      break;
    }
  }
}

/**
 * Keydown delegation — Enter submits the focused form; Escape cancels it.
 * Provides a keyboard-accessible alternative to the Save / Cancel buttons.
 */
async function handleCollectionListKeydown(e: KeyboardEvent): Promise<void> {
  if (e.key !== "Enter" && e.key !== "Escape") return;

  const target = e.target as HTMLElement;
  if (target.tagName !== "INPUT") return;
  const inputEl = target as HTMLInputElement;

  // Determine which form context the input belongs to
  const item = inputEl.closest<HTMLElement>(".collection-item");
  const isAddInput = inputEl.id === "add-collection-input";

  if (e.key === "Enter") {
    if (item) {
      await handleRenameCollection(item.dataset["id"] ?? "", inputEl.value);
    } else if (isAddInput) {
      await handleCreateCollection(inputEl.value);
    }
  } else {
    // Escape — cancel the active form
    if (item) {
      const col = collections.find((c) => c.id === item.dataset["id"]);
      if (col) {
        item.innerHTML = collectionItemViewHtml(col);
        item.classList.remove("collection-item--editing");
      }
    } else if (isAddInput) {
      const section = document.getElementById("add-collection-section");
      if (section) section.outerHTML = addSectionHtml(false);
    }
  }
}

// ── Action: create collection ─────────────────────────────────────────────────

/**
 * Validates the name, sends CREATE_COLLECTION to the BSW, and on success adds
 * the new collection to the list and re-renders.  On failure, shows an inline
 * error inside the add form and preserves the user's input.
 *
 * Requirements: 13.3, 13.4, 13.11, 13.12
 */
async function handleCreateCollection(name: string): Promise<void> {
  const validationError = validateCollectionName(name);
  if (validationError) {
    replaceAddSection(addSectionHtml(true, name, validationError));
    return;
  }

  const trimmedName = name.trim();

  try {
    const response = await chrome.runtime.sendMessage<
      OutboundMessage,
      BackgroundResponse<Collection>
    >({ type: "CREATE_COLLECTION", payload: { name: trimmedName } });

    if (!response) {
      // Service worker restarted and response was lost — retry once
      console.warn("[Magpie] CREATE_COLLECTION: no response, retrying...");
      const retry = await chrome.runtime.sendMessage<
        OutboundMessage,
        BackgroundResponse<Collection>
      >({ type: "CREATE_COLLECTION", payload: { name: trimmedName } });
      if (retry?.success) {
        collections = [...collections, retry.data];
        renderCollectionView(collections);
        return;
      }
      replaceAddSection(addSectionHtml(true, name, retry?.error ?? "Failed to create collection. Please try again."));
      return;
    }

    if (response.success) {
      // response.data is ManageCollectionResponse: { operation: "create", collection: Collection }
      // Extract the nested Collection object
      const responseData = response.data as unknown as { collection?: Collection };
      const newCollection: Collection = responseData?.collection ?? (response.data as unknown as Collection);
      if (newCollection?.id && newCollection?.name) {
        collections = [...collections, newCollection];
      }
      renderCollectionView(collections);
    } else {
      console.warn("[Magpie] CREATE_COLLECTION error:", response.error, response.code);
      replaceAddSection(addSectionHtml(true, name, response.error));
    }
  } catch (err) {
    console.error("[Magpie] CREATE_COLLECTION exception:", err);
    replaceAddSection(
      addSectionHtml(
        true,
        name,
        "Failed to create collection. Please try again.",
      ),
    );
  }
}

// ── Action: rename collection ─────────────────────────────────────────────────

/**
 * Validates the new name, sends RENAME_COLLECTION to the BSW, and on success
 * updates the item's name in-place (without a full re-render so any other open
 * forms are preserved).  On failure, shows an inline error in the rename form.
 *
 * Requirements: 13.5, 13.6, 13.11, 13.12
 */
async function handleRenameCollection(
  id: string,
  newName: string,
): Promise<void> {
  const itemEl = getCollectionItemEl(id);

  const validationError = validateCollectionName(newName);
  if (validationError) {
    if (itemEl) {
      itemEl.innerHTML = renameFormInnerHtml(newName, validationError);
      itemEl.classList.add("collection-item--editing");
      itemEl.querySelector<HTMLInputElement>("input")?.focus();
    }
    return;
  }

  const trimmedName = newName.trim();

  try {
    const response = await chrome.runtime.sendMessage<
      OutboundMessage,
      BackgroundResponse<Collection>
    >({
      type: "RENAME_COLLECTION",
      payload: { collection_id: id, name: trimmedName },
    });

    if (response.success) {
      // Update local state and DOM without a full re-render (Req 13.6)
      const idx = collections.findIndex((c) => c.id === id);
      if (idx !== -1) {
        const updated: Collection = { ...collections[idx], name: trimmedName };
        collections = [
          ...collections.slice(0, idx),
          updated,
          ...collections.slice(idx + 1),
        ];
        if (itemEl) {
          itemEl.innerHTML = collectionItemViewHtml(updated);
          itemEl.classList.remove("collection-item--editing");
        }
      }
    } else {
      if (itemEl) {
        itemEl.innerHTML = renameFormInnerHtml(newName, response.error);
        itemEl.classList.add("collection-item--editing");
        itemEl.querySelector<HTMLInputElement>("input")?.focus();
      }
    }
  } catch {
    if (itemEl) {
      itemEl.innerHTML = renameFormInnerHtml(
        newName,
        "Failed to rename collection. Please try again.",
      );
      itemEl.classList.add("collection-item--editing");
      itemEl.querySelector<HTMLInputElement>("input")?.focus();
    }
  }
}

// ── Action: delete collection ─────────────────────────────────────────────────

/**
 * Shows a native confirm dialog, then sends DELETE_COLLECTION to the BSW.
 * On success, removes the collection from the list and re-renders.
 * On failure, shows an error banner and leaves the list unchanged.
 *
 * Requirements: 13.7, 13.8, 13.12
 */
async function handleDeleteCollection(id: string): Promise<void> {
  const col = collections.find((c) => c.id === id);
  if (!col) return;

  // Requirement 13.7: always confirm before sending the delete request
  if (
    !window.confirm(
      `Delete "${col.name}"?\n\nSaved posts will keep their content but lose their collection assignment.`,
    )
  ) {
    return;
  }

  try {
    const response = await chrome.runtime.sendMessage<
      OutboundMessage,
      BackgroundResponse<unknown>
    >({ type: "DELETE_COLLECTION", payload: { collection_id: id } });

    if (response.success) {
      // Remove from local state and re-render (Req 13.8)
      collections = collections.filter((c) => c.id !== id);
      renderCollectionView(collections);
    } else {
      // Preserve list, display error banner (Req 13.12)
      showCollectionViewError(
        (response as BackgroundResponse<unknown> & { success: false }).error,
      );
    }
  } catch {
    showCollectionViewError("Failed to delete collection. Please try again.");
  }
}

// ── Private DOM utility ───────────────────────────────────────────────────────

/**
 * Replaces the add-collection-section element with new HTML, then focuses
 * the input if the expanded form was injected.
 */
function replaceAddSection(html: string): void {
  const section = document.getElementById("add-collection-section");
  if (!section) return;
  section.outerHTML = html;
  document.getElementById("add-collection-input")?.focus();
}

// ── Action: login ─────────────────────────────────────────────────────────────

/**
 * Handles the "Continue with Google" button click.
 *
 * Sends INITIATE_LOGIN to the BSW and:
 *  - On success → fetches collections and transitions to the collection view (Req 12.3)
 *  - On AUTH_REQUIRED / REFRESH_FAILED → re-renders login view with error (Req 12.4)
 *  - On any other failure (including OAuth cancellation) → re-renders login view
 *    silently without an error message (Req 12.5)
 *
 * Requirements: 12.2, 12.3, 12.4, 12.5
 */
async function handleLogin(): Promise<void> {
  // Disable the button and show progress while waiting for OAuth
  const loginBtn = document.getElementById(
    "login-btn",
  ) as HTMLButtonElement | null;
  if (loginBtn) {
    loginBtn.disabled = true;
    loginBtn.textContent = "Signing in…";
  }

  try {
    const response = await chrome.runtime.sendMessage<
      OutboundMessage,
      BackgroundResponse<StoredSession>
    >({ type: "INITIATE_LOGIN" });

    if (response.success) {
      // Auth completed — immediately show collection view, then load collections
      renderCollectionView([]);
      // Load collections in the background; failure here should NOT reset to login
      chrome.runtime.sendMessage<OutboundMessage, BackgroundResponse<Collection[]>>(
        { type: "GET_COLLECTIONS" }
      ).then((collectionsResp) => {
        if (collectionsResp?.success && collectionsResp.data) {
          renderCollectionView(extractCollections(collectionsResp.data));
        }
      }).catch(() => { /* keep collection view even if fetch fails */ });
    } else {
      // Distinguish between hard auth errors and user-driven cancellation
      if (
        response.code === "AUTH_REQUIRED" ||
        response.code === "REFRESH_FAILED"
      ) {
        renderLoginView(response.error);
      } else {
        renderLoginView();
      }
    }
  } catch (err) {
    console.error("[Magpie] handleLogin error:", err);
    // BSW unreachable or unexpected runtime error — return to login silently
    renderLoginView();
  }
}

// ── Action: logout ────────────────────────────────────────────────────────────

/**
 * Clears the session via the BSW and returns to the login view.
 * Requirements: 2.8, 13.9, 13.10
 */
async function handleLogout(): Promise<void> {
  try {
    await chrome.runtime.sendMessage<
      OutboundMessage,
      BackgroundResponse<unknown>
    >({ type: "LOGOUT" });
  } catch {
    // Swallow — we always transition to the login view regardless of the result
  }
  renderLoginView();
}

// ── Init ──────────────────────────────────────────────────────────────────────

/**
 * Entry point — called on DOMContentLoaded.
 */
async function init(): Promise<void> {
  renderLoadingState();

  // Step 1: Check session — if this throws, show login
  let hasSession = false;
  try {
    const sessionResp = await chrome.runtime.sendMessage<
      OutboundMessage,
      BackgroundResponse<StoredSession | null>
    >({ type: "GET_SESSION_STATUS" });

    const sessionData = sessionResp?.success ? sessionResp.data : undefined;
    hasSession = !!sessionData;
    console.log("[Magpie] init: hasSession =", hasSession, sessionResp?.success, !!sessionData);
  } catch (e) {
    console.error("[Magpie] init: GET_SESSION_STATUS failed:", e);
    renderLoginView();
    return;
  }

  if (!hasSession) {
    renderLoginView();
    return;
  }

  // Step 2: Apply saved theme before rendering
  try {
    const themeStore = await chrome.storage.local.get(THEME_CACHE_KEY);
    const savedTheme = themeStore[THEME_CACHE_KEY] as string | undefined;
    applyTheme(savedTheme === "dark");
  } catch { /* ignore */ }

  // Step 3: Show cached collections immediately (zero-wait UX)
  try {
    const cached = await chrome.storage.local.get(COLLECTIONS_CACHE_KEY);
    const cachedCols = (cached[COLLECTIONS_CACHE_KEY] as Collection[] | undefined) ?? [];
    // Show spinner only if cache is empty (first ever open or cleared cache)
    renderCollectionView(cachedCols, cachedCols.length === 0);
  } catch {
    renderCollectionView([], true);
  }

  // Step 4: Refresh collections in background — failure here stays on collection view
  try {
    const collectionsResp = await chrome.runtime.sendMessage<
      OutboundMessage,
      BackgroundResponse<Collection[]>
    >({ type: "GET_COLLECTIONS" });

    if (collectionsResp?.success && collectionsResp?.data) {
      const cols = extractCollections(collectionsResp.data);
      renderCollectionView(cols);
      chrome.storage.local.set({ [COLLECTIONS_CACHE_KEY]: cols }).catch(() => {});
    } else if (collectionsResp && !collectionsResp.success && collectionsResp.code === "AUTH_REQUIRED") {
      // Account deleted or JWT revoked — clear session and show login
      await handleLogout();
      return;
    }
  } catch (e) {
    console.warn("[Magpie] init: GET_COLLECTIONS failed (staying on collection view):", e);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  void init();
});
