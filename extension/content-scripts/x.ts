/**
 * X / Twitter Content Script (Phase 2)
 *
 * Responsibilities:
 *  - Detect tweet, media tweet, and retweet elements in the DOM on x.com
 *  - Inject a save button using capture-phase click isolation to prevent
 *    native X interactions (like, bookmark, retweet, reply) — Requirement 5.6
 *  - Observe DOM mutations with MutationObserver to handle infinite-scroll
 *    feed updates and SPA navigation
 *  - Extract tweet metadata and route save requests through the
 *    Collection Picker Modal → Background Service Worker
 *
 * Requirements: 5.1–5.6, 7.1–7.13
 */

import type { PostMetadata } from "../shared/types/domain";
import { canonicalizeUrl } from "../shared/canonicalizeUrl";
import { openModal } from "./modal";
import { showToast } from "./toast";
import { sendMessage } from "../shared/sendMessage";

// ── Utilities ──────────────────────────────────────────────────────────────

/**
 * Returns a debounced version of `fn` that fires at most once per `ms`
 * milliseconds (trailing-edge). Subsequent calls within the window reset
 * the timer.
 */
function debounce<A extends unknown[]>(
  fn: (...args: A) => void,
  ms: number,
): (...args: A) => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return function (...args: A): void {
    if (timer !== null) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      fn(...args);
    }, ms);
  };
}

// ── DOM Selectors ──────────────────────────────────────────────────────────

/**
 * Top-level CSS selector that identifies a tweet / media tweet / retweet
 * article element on x.com.  Uses `data-testid` because X's generated class
 * names change with every deploy (Requirements 5.1, 5.2).
 */
const X_TWEET_SELECTOR = 'article[data-testid="tweet"]';

/**
 * Selectors scoped to the interior of a single tweet article element.
 * All are based on `data-testid` attributes or structural HTML semantics so
 * they survive X's frequent deploy-time class name churn
 * (Requirements 5.1, 7.2).
 */
const WITHIN_TWEET = {
  authorName: '[data-testid="User-Name"]',
  authorAvatar: '[data-testid="Tweet-User-Avatar"] img',
  tweetText: '[data-testid="tweetText"]',
  tweetLink: 'a[href*="/status/"]',
  timestamp: "time[datetime]",
  photo: '[data-testid="tweetPhoto"] img',
  video: "video source",
  /** X action bar: contains reply, retweet, like, bookmark, share buttons. */
  actionBar: 'div[role="group"]',
} as const;

// ── Metadata Extraction ────────────────────────────────────────────────────

/**
 * Extracts tweet metadata from a tweet article element using the
 * `WITHIN_TWEET` selector map.
 *
 * Returns `null` if a tweet URL (a[href*="/status/"]) cannot be located —
 * this signals the caller to abort the save (Requirement 7.13).
 *
 * All fields other than `post_url` are set to their zero/null value when the
 * corresponding DOM element is absent — this function never throws
 * (Requirement 7.12).
 *
 * Requirements: 5.5, 7.1–7.13
 */
function extractXMetadata(el: Element): Partial<PostMetadata> | null {
  // 1. Locate tweet link — abort if missing (Requirement 7.13)
  const tweetLinkEl = el.querySelector<HTMLAnchorElement>(
    WITHIN_TWEET.tweetLink,
  );
  if (!tweetLinkEl?.href) return null;

  const rawUrl   = new URL(tweetLinkEl.href, window.location.origin).href;
  const canonical = canonicalizeUrl(rawUrl, "x");
  // Use canonical form as post_url so UNIQUE(user_id, canonical_url) in
  // the DB resolves correctly even when the edge function also sets canonical_url.
  const post_url = canonical ?? rawUrl;

  // 2. Author name/handle
  //    X renders the User-Name container with two spans:
  //      • spans[0]  →  Display Name  (e.g. "Elon Musk")
  //      • spans[1]  →  @handle       (e.g. "@elonmusk")
  const authorNameEl = el.querySelector(WITHIN_TWEET.authorName);
  const spans = authorNameEl?.querySelectorAll("span");
  const author_display_name = spans?.[0]?.textContent?.trim() ?? null;
  const author_username =
    spans?.[1]?.textContent?.replace("@", "").trim() ?? null;

  // 3. Avatar URL (excluded from media_urls)
  const avatarEl = el.querySelector<HTMLImageElement>(
    WITHIN_TWEET.authorAvatar,
  );
  const author_avatar_url = avatarEl?.src ?? null;

  // 4. Tweet text
  const textEl = el.querySelector(WITHIN_TWEET.tweetText);
  const content_text = textEl?.textContent?.trim() ?? null;

  // 5. Timestamp (ISO 8601 from the datetime attribute)
  const timeEl = el.querySelector<HTMLTimeElement>(WITHIN_TWEET.timestamp);
  const post_timestamp = timeEl?.getAttribute("datetime") ?? null;

  // 6. Media — tweet photos + video poster thumbnails (X uses blob src, poster is the real URL)
  const photoEls = Array.from(
    el.querySelectorAll<HTMLImageElement>(WITHIN_TWEET.photo),
  );
  const videoPosterEls = Array.from(
    el.querySelectorAll<HTMLVideoElement>("video[poster]"),
  );
  const media_urls: string[] = [
    ...photoEls.map((i) => i.src).filter((s) => s && s !== author_avatar_url),
    ...videoPosterEls.map((v) => v.getAttribute("poster") ?? "").filter(Boolean),
  ];

  // 7. Quoted tweet — extract text + media from div[tabindex="0"][role="link"]
  let quoted_suffix = "";
  const quotedContainers = Array.from(
    el.querySelectorAll<HTMLElement>('div[tabindex="0"][role="link"]'),
  );
  for (const container of quotedContainers) {
    const quotedTextEl = container.querySelector<HTMLElement>(
      '[data-testid="tweetText"]',
    );
    if (!quotedTextEl) continue; // not a tweet quote

    // Author handle of quoted tweet
    const quotedAuthorEl = container.querySelector(WITHIN_TWEET.authorName);
    const quotedSpans = quotedAuthorEl?.querySelectorAll("span");
    const quotedHandle = quotedSpans?.[1]?.textContent?.replace("@", "").trim() ?? "";
    const quotedBody = quotedTextEl.textContent?.trim() ?? "";

    if (quotedBody || quotedHandle) {
      quoted_suffix = `\n\n↩ @${quotedHandle}: ${quotedBody}`;
    }

    // Quoted tweet media (photos + video posters)
    const qPhotos = Array.from(
      container.querySelectorAll<HTMLImageElement>('[data-testid="tweetPhoto"] img'),
    );
    const qPosters = Array.from(
      container.querySelectorAll<HTMLVideoElement>("video[poster]"),
    );
    media_urls.push(
      ...qPhotos.map((i) => i.src).filter((s) => s),
      ...qPosters.map((v) => v.getAttribute("poster") ?? "").filter(Boolean),
    );

    break; // only the first quoted tweet
  }

  const final_content = content_text
    ? content_text + quoted_suffix
    : quoted_suffix || null;

  return {
    post_url,
    post_type: "tweet",
    platform: "x",
    author_username,
    author_display_name,
    author_avatar_url,
    content_text: final_content,
    media_urls,
    post_timestamp,
    raw_metadata: {
      page_url: window.location.href,
      extracted_at: new Date().toISOString(),
    },
  };
}


// ── Default Collection (X) ─────────────────────────────────────────────────

const X_DEFAULT_COL_KEY = "magpie_default_collection";

interface XDefaultCollection {
  id: string;
  name: string;
}

async function getXDefaultCollection(): Promise<XDefaultCollection | undefined> {
  try {
    const stored = await chrome.storage.local.get(X_DEFAULT_COL_KEY);
    return stored[X_DEFAULT_COL_KEY] as XDefaultCollection | undefined;
  } catch {
    return undefined;
  }
}

async function resolveXDefaultFromServer(): Promise<XDefaultCollection | undefined> {
  return new Promise((resolve) => {
    if (!chrome.runtime?.id) { resolve(undefined); return; }
    chrome.runtime.sendMessage(
      { type: "GET_COLLECTIONS" },
      (response: { success: boolean; data?: unknown }) => {
        if (chrome.runtime.lastError || !response?.success) {
          resolve(undefined);
          return;
        }
        const d = response.data as {
          collections?: Array<{ id: string; name: string; is_default?: boolean }>;
        };
        const cols = Array.isArray(d?.collections) ? d.collections : [];
        if (cols.length === 0) { resolve(undefined); return; }
        const chosen = cols.find((c) => c.is_default) ?? cols[0];
        chrome.storage.local
          .set({ [X_DEFAULT_COL_KEY]: { id: chosen.id, name: chosen.name } })
          .catch(() => {});
        resolve({ id: chosen.id, name: chosen.name });
      },
    );
  });
}

async function xSaveToDefault(
  meta: Partial<PostMetadata>,
  col: XDefaultCollection,
): Promise<boolean | "duplicate"> {
  if (!meta.post_url || !chrome.runtime?.id) return false;
  try {
    const response = (await sendMessage<{ success: boolean; error?: string; data?: { status?: string } | null }>({
      type: "SAVE_POST",
      payload: {
        post_url: meta.post_url,
        collection_id: col.id,
        post_type: meta.post_type ?? "",
        platform: meta.platform ?? "",
        author_username: meta.author_username ?? null,
        author_display_name: meta.author_display_name ?? null,
        author_avatar_url: meta.author_avatar_url ?? null,
        content_text: meta.content_text ?? null,
        media_urls: meta.media_urls ?? null,
        post_timestamp: meta.post_timestamp ?? null,
        raw_metadata: meta.raw_metadata ?? null,
      },
    }));
    if (!response?.success) return false;
    const data = response.data as { status?: string } | null;
    return data?.status === "updated" ? "duplicate" : true;
  } catch {
    return false;
  }
}

// ── Collection Picker ──────────────────────────────────────────────────────

/**
 * Opens the Collection Picker Modal for the given tweet element.
 *
 * Extracts metadata first; if `extractXMetadata` returns `null` (no
 * tweet URL found) the save is aborted per Requirement 7.13.
 *
 * On a successful save the modal's internal dispatch automatically shows a
 * platform-matched Toast_Notification (X dark theme) with a "Change
 * collection" option that re-opens the modal for the same metadata
 * (Requirements 11.1, 11.2, 11.3).
 *
 * Requirements: 5.6, 7.12, 7.13, 11.1–11.3
 */
async function openXCollectionPicker(tweetEl: Element): Promise<void> {
  const meta = extractXMetadata(tweetEl);
  if (!meta) {
    console.warn(
      "[Magpie] Could not determine the tweet URL. " +
        "Try navigating directly to the tweet page.",
    );
    return;
  }

  if (!chrome.runtime?.id) {
    showToast({ message: "Magpie yenilenmesi gerekiyor — F5 basın.", platform: "x" });
    return;
  }

  // Try default collection (same pattern as Instagram)
  let defaultCol = await getXDefaultCollection();
  if (!defaultCol) {
    defaultCol = await resolveXDefaultFromServer();
  }

  if (defaultCol) {
    const ok = await xSaveToDefault(meta, defaultCol);
    if (ok === true) {
      showToast({
        message: `Saved to ${defaultCol.name} ✓`,
        platform: "x",
        onChangeCollection: () => {
          void openCollectionPickerX(meta);
        },
      });
    } else if (ok === "duplicate") {
      showToast({
        message: `Zaten kayıtlı (${defaultCol.name})`,
        platform: "x",
        onChangeCollection: () => {
          void openCollectionPickerX(meta);
        },
      });
    } else {
      await openCollectionPickerX(meta);
    }
  } else {
    // No default configured — open picker directly
    await openCollectionPickerX(meta);
  }
}

async function openCollectionPickerX(meta: Partial<PostMetadata>): Promise<void> {
  openModal(meta);
}

// ── Button Injection ───────────────────────────────────────────────────────

/**
 * Injects a Magpie save button into the action bar of a tweet element.
 * Idempotent: skips immediately if a button with `data-saver-injected`
 * is already present (Requirement 5.1).
 *
 * The click listener is attached with `{ capture: true }` so it fires in the
 * capture phase — before any of X's own bubble-phase handlers on the same
 * element.  `e.stopImmediatePropagation()` then prevents those handlers from
 * running, ensuring that clicking Save never triggers X's native like,
 * bookmark, retweet, or reply actions (Requirement 5.6).
 *
 * Requirements: 5.1, 5.4, 5.6
 */
function injectXSaveButton(tweetEl: Element): void {
  if (tweetEl.querySelector('[data-saver-injected="true"]')) return; // Req 5.1

  const actionBar = tweetEl.querySelector<HTMLElement>(WITHIN_TWEET.actionBar);
  if (!actionBar) return; // skip if action bar not yet rendered

  const btn = document.createElement("button");
  btn.setAttribute("data-saver-injected", "true"); // sentinel (Req 5.1)
  btn.setAttribute("aria-label", "Save to Magpie archive");
  btn.setAttribute("type", "button");
  btn.className = "magpie-save-btn magpie-save-btn--x";

  // Archive-box SVG — visually distinct from any native X icon (Req 5.4)
  btn.innerHTML =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" ` +
    `width="18" height="18" fill="currentColor" aria-hidden="true">` +
    `<path d="M20 3H4a1 1 0 0 0-1 1v3a1 1 0 0 0 1 1v11a1 1 0 0 0 1 1h14` +
    `a1 1 0 0 0 1-1V8a1 1 0 0 0 1-1V4a1 1 0 0 0-1-1zm-1 15H5V8h14v10z` +
    `M5 6V5h14v1H5zm7 4H9v2h3v2h2v-2h3v-2h-3V8h-2v2z"/></svg>`;

  // Match X's muted icon colour; preserve native button spacing
  btn.style.cssText =
    "background:none;border:none;cursor:pointer;padding:0 8px;" +
    "display:inline-flex;align-items:center;justify-content:center;" +
    "opacity:0.7;color:#71767b;transition:opacity 0.15s;";

  // Capture-phase listener (Requirement 5.6):
  //  - fires before X's bubble-phase like/bookmark/retweet handlers
  //  - stopImmediatePropagation blocks those handlers on the same element
  btn.addEventListener(
    "click",
    (e) => {
      e.stopImmediatePropagation(); // block X's native event handlers
      e.preventDefault();
      void openXCollectionPicker(tweetEl);
    },
    { capture: true }, // Requirement 5.6
  );

  actionBar.appendChild(btn);
}

// ── DOM Scanning ───────────────────────────────────────────────────────────

/**
 * Queries `root` for all tweet article elements and calls
 * `injectXSaveButton` on each.  Also checks whether `root` itself matches
 * the tweet selector so newly-added top-level tweet nodes are not missed.
 *
 * Requirements: 5.1, 5.2
 */
function scanAndInject(root: Element): void {
  // Check root itself first (handles newly-added top-level tweet articles)
  if (root.matches(X_TWEET_SELECTOR)) {
    injectXSaveButton(root);
    return;
  }

  // Scan all matching descendants
  root
    .querySelectorAll(X_TWEET_SELECTOR)
    .forEach((el) => injectXSaveButton(el));
}

// ── MutationObserver ───────────────────────────────────────────────────────

const DEBOUNCE_MS = 100;

/**
 * Debounced MutationObserver callback.
 *
 * Two-pass strategy on every mutation batch:
 *  1. Scan `addedNodes` from each record for newly inserted tweet elements.
 *  2. Re-check every document-level tweet match so buttons stripped by X's
 *     SPA reconciliation are immediately re-injected (Requirement 5.3).
 *
 * Wrapped in try/catch so a single runtime error cannot halt mutation
 * handling for subsequent DOM changes.
 *
 * Requirements: 5.1, 5.2, 5.3
 */
const observer = new MutationObserver(
  debounce((mutations: MutationRecord[]) => {
    try {
      // Pass 1: inject into newly added nodes
      for (const mutation of mutations) {
        Array.from(mutation.addedNodes).forEach((node) => {
          if (node.nodeType !== Node.ELEMENT_NODE) return;
          scanAndInject(node as Element);
        });
      }

      // Pass 2: re-inject on any tweet whose button was stripped by X's SPA
      // re-render (X may remove and re-add article elements during client-side
      // route transitions without a full page load)
      document.querySelectorAll(X_TWEET_SELECTOR).forEach((el) => {
        if (!el.querySelector('[data-saver-injected="true"]')) {
          injectXSaveButton(el);
        }
      });
    } catch (err) {
      // Swallow errors so future mutations are still handled
      console.error("[Magpie] MutationObserver callback error:", err);
    }
  }, DEBOUNCE_MS),
);

observer.observe(document.body, { childList: true, subtree: true });

// ── Initial Scan ───────────────────────────────────────────────────────────

// Inject buttons on any tweet elements already in the DOM when the
// content script first loads (Requirement 5.1)
scanAndInject(document.body);
