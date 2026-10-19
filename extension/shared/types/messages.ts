/**
 * Chrome Extension message passing protocol types.
 *
 * Defines the typed contract between Content Scripts and the Background
 * Service Worker. Content Scripts MUST NOT call Supabase directly; all
 * requests are routed through the Background Service Worker via these types.
 *
 * Requirements: 10.1, 10.5, 10.6, 18.6
 */

import type {
  SavePostRequest,
  StoredSession,
  Collection,
  SavePostResponse,
} from "./domain";

// ── Outbound messages (Content Script → Background Service Worker) ───────────

/**
 * Discriminated union of every message type a Content Script or Popup may
 * send to the Background Service Worker via `chrome.runtime.sendMessage`.
 *
 * Messages that carry no additional data use `{ type }` alone.
 * Messages that require a payload add a typed `payload` field.
 *
 * Requirement 10.1 — Content Scripts route all requests through message passing.
 */
export type OutboundMessage =
  /** Query the current session state (authenticated / unauthenticated). */
  | { type: "GET_SESSION_STATUS" }

  /** Request that the Background Service Worker start the Google OAuth flow. */
  | { type: "INITIATE_LOGIN" }

  /** Request that the Background Service Worker clear the stored session. */
  | { type: "LOGOUT" }

  /** Fetch the authenticated user's collection list from the Edge Function. */
  | { type: "GET_COLLECTIONS" }

  /** Save a post to the specified collection. */
  | { type: "SAVE_POST"; payload: SavePostRequest }

  /** Create a new collection with the given name. */
  | { type: "CREATE_COLLECTION"; payload: { name: string } }

  /** Rename an existing collection. */
  | {
      type: "RENAME_COLLECTION";
      payload: { collection_id: string; name: string };
    }

  /** Delete an existing collection. */
  | { type: "DELETE_COLLECTION"; payload: { collection_id: string } }

  /**
   * Move a saved post to a different collection.
   * Calls the save-post Edge Function with the updated collection_id.
   *
   * Requirement 10.1, 10.6
   */
  | {
      type: "UPDATE_POST_COLLECTION";
      payload: { post_url: string; collection_id: string };
    }

  /**
   * Designate a collection as the user's default save target.
   * Calls manage-collection with operation: "set_default".
   */
  | {
      type: "SET_DEFAULT_COLLECTION";
      payload: { collection_id: string };
    };

// ── Error codes ──────────────────────────────────────────────────────────────

/**
 * Exhaustive set of error codes returned in a failed `BackgroundResponse`.
 *
 * - `AUTH_REQUIRED`  — No session JWT present; user must log in (Req 10.5).
 * - `JWT_EXPIRED`    — Session JWT has passed its expiry timestamp (Req 1.4).
 * - `REFRESH_FAILED` — Silent token refresh attempt was unsuccessful.
 * - `NETWORK_ERROR`  — Edge Function was unreachable due to a network failure.
 * - `API_ERROR`      — Edge Function returned an unexpected HTTP error (Req 10.6).
 * - `STORAGE_ERROR`  — `chrome.storage` read or write operation failed (Req 2.3).
 * - `RATE_LIMITED`   — Edge Function returned HTTP 429; caller should back off (Req 18.6).
 * - `UNKNOWN_ERROR`  — Catch-all for unclassified errors.
 */
export type ErrorCode =
  | "AUTH_REQUIRED"
  | "JWT_EXPIRED"
  | "REFRESH_FAILED"
  | "NETWORK_ERROR"
  | "API_ERROR"
  | "STORAGE_ERROR"
  | "RATE_LIMITED"
  | "UNKNOWN_ERROR";

// ── Background response wrapper ──────────────────────────────────────────────

/**
 * Generic success/failure envelope returned by the Background Service Worker
 * to the Content Script or Popup that sent an `OutboundMessage`.
 *
 * Callers MUST check `success` before accessing `data`.
 *
 * Requirements: 10.5, 10.6
 */
export type BackgroundResponse<T> =
  | { success: true; data: T }
  | { success: false; error: string; code: ErrorCode };

// ── Concrete response type aliases ───────────────────────────────────────────

/**
 * Response to GET_SESSION_STATUS.
 * `data` is the current stored session, or `null` when unauthenticated.
 */
export type SessionStatusResponse = BackgroundResponse<StoredSession | null>;

/**
 * Response to GET_COLLECTIONS.
 * `data` is the ordered list of the authenticated user's collections.
 */
export type CollectionsResponse = BackgroundResponse<Collection[]>;

/**
 * Response to SAVE_POST and UPDATE_POST_COLLECTION.
 * `data` carries the Edge Function's create/update confirmation.
 */
export type SavePostResult = BackgroundResponse<SavePostResponse>;

/**
 * Response to CREATE_COLLECTION.
 * `data` is the newly created Collection record.
 */
export type CreateCollectionResult = BackgroundResponse<Collection>;
