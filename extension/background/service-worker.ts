/**
 * Background Service Worker (Manifest V3)
 *
 * Responsibilities:
 *  - Store and refresh the Supabase JWT in chrome.storage.sync
 *  - Route messages from Content Scripts and the Popup to Supabase Edge Functions
 *  - Be the sole caller of save-post and manage-collection Edge Functions
 *
 * Requirements: 2.1–2.8, 10.1–10.6
 */

import { createClient } from "@supabase/supabase-js";
import type {
  StoredSession,
  SavePostRequest,
  SavePostResponse,
  ManageCollectionRequest,
  ManageCollectionResponse,
} from "../shared/types/domain";
import type {
  OutboundMessage,
  BackgroundResponse,
  ErrorCode,
} from "../shared/types/messages";

// ── Supabase configuration ────────────────────────────────────────────────────
// Values are injected at build time from the .env file via esbuild define.
// Copy extension/.env.example to extension/.env and fill in your credentials.
// Never commit the .env file to source control.
const SUPABASE_URL: string = process.env.SUPABASE_URL ?? "https://your-project-ref.supabase.co";
const SUPABASE_ANON_KEY: string = process.env.SUPABASE_ANON_KEY ?? "your-anon-key-here";

/** Storage key used in both chrome.storage.sync and chrome.storage.local */
const SESSION_KEY = "magpie_session";

// ── JWT Persistence Layer ─────────────────────────────────────────────────────

/**
 * Persists a session in chrome.storage.sync, falling back to
 * chrome.storage.local if sync is unavailable (Requirement 2.2, 2.6).
 *
 * On fallback, a SYNC_UNAVAILABLE console warning is emitted so that callers
 * and the popup can surface the "session sync across devices is disabled"
 * message (Requirement 2.6).
 *
 * After storing, schedules a proactive jwt-refresh alarm 5 minutes before
 * expiry so the session is refreshed silently before it lapses
 * (Requirements 1.3, 2.4).
 */
export async function storeSession(session: StoredSession): Promise<void> {
  // Always write to local storage for reliability
  await chrome.storage.local.set({ [SESSION_KEY]: session });
  console.log("[Magpie] Session stored to local. user_id:", session.user_id, "expiry:", new Date(session.expiry * 1000).toISOString());
  // Also try sync (best-effort, failure is ok)
  try {
    await chrome.storage.sync.set({ [SESSION_KEY]: session });
    console.log("[Magpie] Session also stored to sync.");
  } catch {
    console.log("[Magpie] Sync storage unavailable, local only.");
  }

  // Schedule a proactive refresh alarm 5 minutes (300 s) before the JWT
  // expires. This gives refreshSession() time to obtain a new token while
  // the current one is still valid (Requirement 1.3, 2.4).
  chrome.alarms.create("jwt-refresh", {
    when: (session.expiry - 300) * 1000,
  });
}

/**
 * Retrieves the stored session, reading from chrome.storage.sync first.
 * Falls back to chrome.storage.local if sync is unavailable or returns no
 * session (Requirement 2.4, 2.6).
 *
 * Returns null when no session is found in either store.
 */
export async function getStoredSession(): Promise<StoredSession | null> {
  // Attempt chrome.storage.sync first.
  try {
    const result = await chrome.storage.sync.get(SESSION_KEY);
    const session = result[SESSION_KEY] as StoredSession | undefined;
    if (session) {
      console.log("[Magpie] getStoredSession: found in sync, expiry:", session.expiry, "now:", Math.floor(Date.now()/1000));
      return session;
    }
    console.log("[Magpie] getStoredSession: not in sync");
  } catch (e) {
    console.warn("[Magpie] getStoredSession: sync read failed:", e);
  }

  // Fall back to chrome.storage.local.
  try {
    const result = await chrome.storage.local.get(SESSION_KEY);
    const session = result[SESSION_KEY] as StoredSession | undefined;
    if (session) {
      console.log("[Magpie] getStoredSession: found in local, expiry:", session.expiry, "now:", Math.floor(Date.now()/1000));
    } else {
      console.log("[Magpie] getStoredSession: not found anywhere");
    }
    return session ?? null;
  } catch {
    return null;
  }
}

/**
 * Removes the session from both chrome.storage.sync and chrome.storage.local
 * so that no stale token lingers in either store (Requirement 2.7, 2.8).
 *
 * Errors from individual stores are swallowed — a best-effort clear is
 * acceptable here since the logout path already transitions the UI to the
 * unauthenticated state.
 */
export async function clearSession(): Promise<void> {
  await Promise.allSettled([
    chrome.storage.sync.remove(SESSION_KEY),
    chrome.storage.local.remove(SESSION_KEY),
  ]);
}

// ── JWT Validity and Proactive Refresh ────────────────────────────────────────

/**
 * Returns the stored session if it is valid, attempting a silent refresh when
 * the token is within 5 minutes of expiry (Requirements 1.3, 1.4, 2.4, 2.7).
 *
 * Return semantics:
 *  - null (AUTH_REQUIRED)  → no session exists in storage
 *  - null (JWT_EXPIRED)    → token has passed its expiry; storage is cleared
 *  - StoredSession         → token is valid (and freshly refreshed if it was
 *                            close to expiry)
 */
export async function getValidSession(): Promise<StoredSession | null> {
  const session = await getStoredSession();

  if (!session) {
    // No session stored — caller must trigger a new login flow.
    return null; // AUTH_REQUIRED
  }

  const nowSecs = Date.now() / 1000;

  if (nowSecs >= session.expiry) {
    if (session.refresh_token) {
      // Access token expired but we have a refresh_token — try to renew silently.
      console.log("[Magpie] Access token expired — attempting silent refresh.");
      await refreshSession();
      return getStoredSession(); // null if refresh failed, new session if succeeded
    }
    // No refresh token — clear and require re-login.
    await clearSession();
    return null; // JWT_EXPIRED
  }

  if (session.expiry - nowSecs < 300) {
    // Token is within the 5-minute refresh window — attempt a silent refresh
    // so callers always receive a token with meaningful remaining lifetime
    // (Requirement 2.4).
    await refreshSession();
    return getStoredSession();
  }

  return session;
}

/**
 * Attempts a silent Supabase token refresh.
 *
 * On success, the new access token and expiry are written back to storage via
 * storeSession(), which also reschedules the jwt-refresh alarm.
 *
 * On failure (network error, invalid refresh token, etc.) the stored session
 * is cleared so the user is prompted to re-authenticate (Requirements 1.4, 2.7).
 *
 * NOTE: The StoredSession type currently stores the access JWT only. To perform
 * a full server-side token refresh, a `refresh_token` field must be added to
 * StoredSession so it can be passed to refreshSession(). Until then, this
 * function relies on the Supabase client's internally cached session.
 */
export async function refreshSession(): Promise<void> {
  const stored = await getStoredSession();
  if (!stored?.refresh_token) {
    // No refresh token available — cannot silently renew; user must re-login.
    console.warn("[Magpie] refreshSession: no refresh_token stored — clearing.");
    await clearSession();
    return;
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });

  // Seed the client's in-memory session so it has the refresh_token to use.
  await supabase.auth.setSession({
    access_token: stored.jwt,
    refresh_token: stored.refresh_token,
  });

  const { data, error } = await supabase.auth.refreshSession();

  if (error || !data.session) {
    console.warn("[Magpie] Token refresh failed — clearing session.", error);
    await clearSession();
    return;
  }

  const { access_token, refresh_token, expires_at, user } = data.session;

  await storeSession({
    jwt: access_token,
    expiry: expires_at ?? Math.floor(Date.now() / 1000) + 3600,
    user_id: user.id,
    refresh_token: refresh_token ?? undefined,
  });
}

// ── Alarm Listener ────────────────────────────────────────────────────────────

/**
 * Listens for the jwt-refresh alarm and triggers a proactive token refresh.
 * The alarm is created by storeSession() and fires 5 minutes before expiry
 * (Requirements 1.3, 2.4).
 */
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "jwt-refresh") {
    refreshSession();
  }
});

// ── Edge Function Callers ─────────────────────────────────────────────────────

/** Base URL for all Edge Function endpoints — falls back to deriving from SUPABASE_URL */
const EDGE_FUNCTION_BASE: string = `${SUPABASE_URL}/functions/v1`;

/**
 * Converts a non-OK HTTP Response into a typed BackgroundResponse failure.
 *
 * HTTP 429 is mapped to the `RATE_LIMITED` error code. The user-facing error
 * message is built from the `Retry-After` response header so the caller knows
 * exactly how many seconds to wait before retrying (Requirement 18.6).
 *
 * Other mappings:
 *  - 401 → AUTH_REQUIRED  (JWT rejected server-side)
 *  - other 4xx/5xx → API_ERROR
 *
 * The function intentionally does NOT read the response body — callers that
 * need the body for success responses should read it after this guard returns.
 *
 * Requirements: 10.6, 18.6
 */
export function mapHttpError<T>(response: Response): BackgroundResponse<T> {
  if (response.status === 429) {
    const retryAfter = response.headers.get("Retry-After") ?? "60";
    return {
      success: false,
      error: `Too many requests. Please wait ${retryAfter} seconds before trying again.`,
      code: "RATE_LIMITED",
    };
  }

  if (response.status === 401) {
    return {
      success: false,
      error: "Authentication required. Please log in.",
      code: "AUTH_REQUIRED",
    };
  }

  return {
    success: false,
    error: `API error: HTTP ${response.status}`,
    code: "API_ERROR",
  };
}

/**
 * Calls the save-post Edge Function to create or update a saved post.
 *
 * HTTP error mapping (Requirement 10.6):
 *  - 401 → AUTH_REQUIRED  (JWT rejected server-side)
 *  - 429 → RATE_LIMITED   (rate limit exceeded; Retry-After header read)
 *  - other 4xx/5xx → API_ERROR
 * Network failures produce NETWORK_ERROR (Requirements 10.2, 10.3).
 */
export async function callSavePost(
  payload: SavePostRequest,
  jwt: string,
): Promise<BackgroundResponse<SavePostResponse>> {
  try {
    const response = await fetch(`${EDGE_FUNCTION_BASE}/save-post`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${jwt}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      return mapHttpError<SavePostResponse>(response);
    }

    const body = (await response.json()) as SavePostResponse;
    return { success: true, data: body };
  } catch {
    return {
      success: false,
      error: "Network request to save-post failed",
      code: "NETWORK_ERROR",
    };
  }
}

/**
 * Calls the manage-collection Edge Function to list, create, rename, or
 * delete collections.
 *
 * Error code mapping is identical to callSavePost — including RATE_LIMITED
 * for HTTP 429 with Retry-After header parsing (Requirements 10.2, 10.3, 10.6, 18.6).
 */
export async function callManageCollection(
  request: ManageCollectionRequest,
  jwt: string,
): Promise<BackgroundResponse<ManageCollectionResponse>> {
  try {
    const response = await fetch(`${EDGE_FUNCTION_BASE}/manage-collection`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${jwt}`,
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      return mapHttpError<ManageCollectionResponse>(response);
    }

    const body = (await response.json()) as ManageCollectionResponse;
    return { success: true, data: body };
  } catch {
    return {
      success: false,
      error: "Network request to manage-collection failed",
      code: "NETWORK_ERROR",
    };
  }
}

// ── Google OAuth Login ────────────────────────────────────────────────────────

/**
 * Initiates the Google OAuth flow via `chrome.identity.launchWebAuthFlow`.
 *
 * Flow:
 *  1. Build the Supabase Google OAuth authorize URL, passing the extension's
 *     managed redirect URL as `redirect_to`.
 *  2. Launch the interactive Chrome OAuth popup.
 *  3. Parse `access_token` and `expires_in` from the redirect URL fragment.
 *  4. Validate the token and retrieve the user's `id` via
 *     `supabase.auth.getUser(accessToken)`.
 *  5. Persist the session via `storeSession()`.
 *
 * On user cancellation `{ success: true, data: null }` is returned so the
 * popup silently returns to the login view without displaying an error
 * (Requirement 12.5).
 *
 * Requirements: 1.1, 1.2, 1.6, 2.1, 2.2, 12.2, 12.4, 12.5
 */
// ── Chrome storage adapter for supabase-js ───────────────────────────────────
// supabase-js needs a storage adapter to persist the PKCE code_verifier.
// We back it with chrome.storage.session (with local fallback).

const chromeStorageAdapter = {
  async getItem(key: string): Promise<string | null> {
    try {
      const r = await chrome.storage.session.get(key);
      if (r[key] !== undefined) return r[key] as string;
    } catch { /* session unavailable */ }
    try {
      const r = await chrome.storage.local.get(key);
      return r[key] !== undefined ? (r[key] as string) : null;
    } catch { return null; }
  },
  async setItem(key: string, value: string): Promise<void> {
    try {
      await chrome.storage.session.set({ [key]: value });
    } catch {
      await chrome.storage.local.set({ [key]: value });
    }
  },
  async removeItem(key: string): Promise<void> {
    await Promise.allSettled([
      chrome.storage.session.remove(key).catch(() => {}),
      chrome.storage.local.remove(key),
    ]);
  },
};

// ── Login flow ────────────────────────────────────────────────────────────────

async function initiateLogin(): Promise<
  BackgroundResponse<StoredSession | null>
> {
  const redirectUrl = chrome.identity.getRedirectURL();

  // Build a Supabase client with chrome.storage backend + PKCE flow.
  // supabase-js generates the code_verifier internally and stores it via
  // chromeStorageAdapter so exchangeCodeForSession can retrieve it later.
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      storage: chromeStorageAdapter,
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
      flowType: "pkce",
    },
  });

  try {
    // Let supabase-js build the OAuth URL (it adds code_challenge internally)
    const { data: oauthData, error: oauthError } =
      await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: redirectUrl,
          skipBrowserRedirect: true, // we'll open the URL ourselves
        },
      });

    if (oauthError || !oauthData.url) {
      return {
        success: false,
        error: oauthError?.message ?? "Failed to build OAuth URL",
        code: "API_ERROR",
      };
    }

    console.log("[Magpie] Opening OAuth URL:", oauthData.url);

    // Open the Google OAuth popup via chrome.identity
    const responseUrl = await new Promise<string>((resolve, reject) => {
      chrome.identity.launchWebAuthFlow(
        { url: oauthData.url, interactive: true },
        (url) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message ?? "OAuth flow failed"));
          } else if (!url) {
            reject(new Error("No response URL returned from OAuth flow"));
          } else {
            resolve(url);
          }
        },
      );
    });

    console.log("[Magpie] OAuth response URL:", responseUrl);

    // Extract the PKCE code from the redirect URL
    const code = new URL(responseUrl).searchParams.get("code");
    console.log("[Magpie] PKCE code:", code ? "present" : "absent");

    if (!code) {
      // Fallback: try the implicit flow hash fragment
      const hashParams = new URLSearchParams(new URL(responseUrl).hash.substring(1));
      const accessToken = hashParams.get("access_token");
      if (accessToken) {
        const { data: { user }, error: userError } = await supabase.auth.getUser(accessToken);
        if (userError || !user) {
          return { success: false, error: userError?.message ?? "Unable to verify user", code: "API_ERROR" };
        }
        const session: StoredSession = {
          jwt: accessToken,
          expiry: Math.floor(Date.now() / 1000) + 3600,
          user_id: user.id,
          // Implicit flow doesn't yield a refresh_token via this path
        };
        await storeSession(session);
        return { success: true, data: session };
      }
      return { success: false, error: "No authorization code in OAuth response", code: "AUTH_REQUIRED" };
    }

    // Exchange code for session — supabase-js retrieves the stored verifier automatically
    const { data: sessionData, error: exchangeError } =
      await supabase.auth.exchangeCodeForSession(code);

    console.log("[Magpie] Exchange result:", exchangeError ? "error: " + exchangeError.message : "success");

    if (exchangeError || !sessionData.session) {
      return {
        success: false,
        error: exchangeError?.message ?? "Token exchange failed",
        code: "API_ERROR",
      };
    }

    const { access_token, refresh_token, expires_at, user } = sessionData.session;
    const session: StoredSession = {
      jwt: access_token,
      expiry: expires_at ?? Math.floor(Date.now() / 1000) + 3600,
      user_id: user.id,
      refresh_token: refresh_token ?? undefined,
    };
    await storeSession(session);
    return { success: true, data: session };

  } catch (err) {
    const message = err instanceof Error ? err.message : "Authentication flow failed";
    if (
      message.includes("cancelled") ||
      message.includes("canceled") ||
      message.includes("did not approve") ||
      message.includes("user gesture")
    ) {
      return { success: true, data: null };
    }
    return { success: false, error: message, code: "UNKNOWN_ERROR" };
  }
}


// ── Message Router ────────────────────────────────────────────────────────────

/**
 * Routes an `OutboundMessage` from a Content Script or the Popup to the
 * appropriate handler and returns a typed `BackgroundResponse`.
 *
 * Auth-free messages (GET_SESSION_STATUS, INITIATE_LOGIN, LOGOUT) are handled
 * immediately. Every other message type calls `getValidSession()` first and
 * returns `AUTH_REQUIRED` when no valid session is available, ensuring the BSW
 * never calls an Edge Function without a JWT (Requirement 10.5).
 *
 * Requirements: 10.1, 10.4, 10.5, 10.6
 */
export async function handleMessage(
  message: OutboundMessage,
): Promise<BackgroundResponse<unknown>> {
  // ── Auth-free messages ────────────────────────────────────────────────────

  if (message.type === "GET_SESSION_STATUS") {
    // Returns the current session (including null when unauthenticated).
    const session = await getValidSession();
    return { success: true, data: session };
  }

  if (message.type === "INITIATE_LOGIN") {
    return initiateLogin();
  }

  if (message.type === "LOGOUT") {
    await clearSession();
    return { success: true, data: null };
  }

  // ── Auth-required messages ────────────────────────────────────────────────
  // All remaining message types require a valid, non-expired JWT before any
  // Edge Function call is made (Requirement 10.5).

  const session = await getValidSession();

  if (!session) {
    return {
      success: false,
      error: "Authentication required. Please log in to continue.",
      code: "AUTH_REQUIRED",
    };
  }

  const { jwt } = session;

  // Capture the result so we can check for server-side JWT rejection
  // (e.g. account deleted) and auto-clear the stored session.
  let result: BackgroundResponse<unknown>;

  switch (message.type) {
    case "GET_COLLECTIONS":
      result = await callManageCollection({ operation: "list" }, jwt);
      break;

    case "SAVE_POST":
      result = await callSavePost(message.payload, jwt);
      break;

    case "CREATE_COLLECTION":
      result = await callManageCollection(
        { operation: "create", name: message.payload.name },
        jwt,
      );
      break;

    case "RENAME_COLLECTION": {
      const { collection_id, name } = message.payload;
      result = await callManageCollection(
        { operation: "rename", collection_id, name },
        jwt,
      );
      break;
    }

    case "DELETE_COLLECTION": {
      const { collection_id } = message.payload;
      result = await callManageCollection({ operation: "delete", collection_id }, jwt);
      break;
    }

    case "UPDATE_POST_COLLECTION": {
      const { post_url, collection_id } = message.payload;
      result = await callSavePost(
        { post_url, collection_id, post_type: "", platform: "" },
        jwt,
      );
      break;
    }

    case "SET_DEFAULT_COLLECTION": {
      const { collection_id } = message.payload;
      result = await callManageCollection({ operation: "set_default", collection_id }, jwt);
      break;
    }

    default: {
      const _exhaustive: never = message;
      void _exhaustive;
      result = {
        success: false,
        error: "Unknown message type",
        code: "UNKNOWN_ERROR",
      };
    }
  }

  // If the server rejected our JWT (account deleted, token revoked, etc.),
  // clear the stored session so popup shows login on next open.
  if (!result.success && (result as { code?: string }).code === "AUTH_REQUIRED") {
    await clearSession();
  }
  return result;
}

// ── Message Listener Registration ─────────────────────────────────────────────

/**
 * Registers the runtime message listener so Content Scripts and the Extension
 * Popup can communicate with the Background Service Worker.
 *
 * Returning `true` keeps the message channel open while the async
 * `handleMessage` promise resolves — required by the Chrome MV3 message
 * passing contract (Requirement 10.1).
 */
chrome.runtime.onMessage.addListener(
  (
    message: OutboundMessage,
    _sender: chrome.runtime.MessageSender,
    sendResponse: (response: BackgroundResponse<unknown>) => void,
  ) => {
    handleMessage(message as OutboundMessage)
      .then(sendResponse)
      .catch(() =>
        sendResponse({
          success: false,
          error: "Unexpected error in message handler",
          code: "UNKNOWN_ERROR",
        }),
      );
    return true; // Required to keep channel open for async response
  },
);
