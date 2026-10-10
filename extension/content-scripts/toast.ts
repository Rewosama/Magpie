/**
 * Magpie Toast Notification
 *
 * Renders a brief on-screen notification on the host platform page after a
 * successful save operation. The toast adapts its visual style to match the
 * current platform's UI language (Requirements 11.1, 11.2).
 *
 * Key behaviours:
 *  - Any previous toast is removed before a new one is created (idempotent).
 *  - A "Change collection" button lets the user reopen the collection picker
 *    without searching the Web Viewer (Requirement 11.3).
 *  - Auto-dismisses after `autoDismissMs` (default 4000 ms) if the button
 *    is not clicked first (Requirement 11.6).
 *  - A single <style> tag is injected into the document on first use so the
 *    component is self-contained even when the manifest CSS injection is
 *    unavailable (e.g., during development / unit tests).
 *
 * Requirements: 11.1, 11.2, 11.3, 11.6
 */

// ── Style injection ────────────────────────────────────────────────────────

/** Unique ID used to guard against duplicate <style> injections. */
const STYLE_ELEMENT_ID = "magpie-toast-styles";

/**
 * Inline copy of `styles/toast.css`.
 * Kept in sync with the external file so the component is self-contained.
 */
const TOAST_CSS = `
.magpie-toast {
  position: fixed;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 2147483647;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  max-width: 420px;
  width: max-content;
  font-size: 14px;
  font-weight: 500;
  line-height: 1.4;
  pointer-events: auto;
  box-sizing: border-box;
}

/* Instagram */
.magpie-toast--instagram {
  background: #ffffff;
  color: #262626;
  border-radius: 12px;
  box-shadow: 0 4px 6px -1px rgba(0,0,0,.1), 0 2px 4px -1px rgba(0,0,0,.06);
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
}
.magpie-toast--instagram .magpie-toast__message {
  color: #262626;
  flex: 1;
}
.magpie-toast--instagram .magpie-toast__change {
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 6px;
  color: #5851db;
  font-size: 14px;
  font-weight: 600;
  font-family: inherit;
  white-space: nowrap;
  line-height: 1.4;
  flex-shrink: 0;
}
.magpie-toast--instagram .magpie-toast__change:hover {
  background: rgba(88,81,219,.08);
}
.magpie-toast--instagram .magpie-toast__change:focus-visible {
  outline: 2px solid #5851db;
  outline-offset: 2px;
}

/* X / Twitter */
.magpie-toast--x {
  background: #1d1f23;
  color: #ffffff;
  border-radius: 8px;
  box-shadow: 0 4px 16px rgba(0,0,0,.5);
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
}
.magpie-toast--x .magpie-toast__message {
  color: #e7e9ea;
  flex: 1;
}
.magpie-toast--x .magpie-toast__change {
  background: none;
  border: 1px solid rgba(231,233,234,.35);
  cursor: pointer;
  padding: 4px 12px;
  border-radius: 9999px;
  color: #e7e9ea;
  font-size: 13px;
  font-weight: 700;
  font-family: inherit;
  white-space: nowrap;
  line-height: 1.4;
  flex-shrink: 0;
}
.magpie-toast--x .magpie-toast__change:hover {
  background: rgba(231,233,234,.1);
}
.magpie-toast--x .magpie-toast__change:focus-visible {
  outline: 2px solid #1d9bf0;
  outline-offset: 2px;
}
`;

/**
 * Appends a `<style id="magpie-toast-styles">` tag to `<head>` exactly once.
 * Subsequent calls are no-ops.
 */
function injectToastStyles(): void {
  if (document.getElementById(STYLE_ELEMENT_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ELEMENT_ID;
  style.textContent = TOAST_CSS;
  (document.head ?? document.documentElement).appendChild(style);
}

// ── Public API ─────────────────────────────────────────────────────────────

/** Options accepted by {@link showToast}. */
export interface ToastOptions {
  /** Human-readable confirmation or status message to display. */
  message: string;
  /** Platform the user is currently browsing — determines visual style. */
  platform: "instagram" | "x";
  /**
   * Milliseconds before the toast auto-dismisses.
   * @default 4000  (Requirement 11.6)
   */
  autoDismissMs?: number;
  /**
   * When provided, a "Change collection" button is rendered.
   * Clicking it cancels the auto-dismiss timer, removes the toast, and
   * invokes this callback (Requirement 11.3, 11.4).
   */
  onChangeCollection?: () => void;
}

/**
 * Displays a Magpie toast notification on the current platform page.
 *
 * If a previous `#magpie-toast` element already exists in the DOM it is
 * removed before the new toast is appended, ensuring at most one toast is
 * visible at any time (Requirement 11.1).
 *
 * Requirements: 11.1, 11.2, 11.3, 11.6
 */
export function showToast(options: ToastOptions): void {
  // ── 1. Remove any existing toast ────────────────────────────────────────
  const existing = document.getElementById("magpie-toast");
  if (existing) existing.remove();

  // ── 2. Ensure styles are present ────────────────────────────────────────
  injectToastStyles();

  // ── 3. Build the toast element ──────────────────────────────────────────
  const toast = document.createElement("div");
  toast.id = "magpie-toast";
  toast.className = `magpie-toast magpie-toast--${options.platform}`;
  toast.setAttribute("role", "status");
  toast.setAttribute("aria-live", "polite");

  // Message text
  const messageSpan = document.createElement("span");
  messageSpan.className = "magpie-toast__message";
  messageSpan.textContent = options.message;
  toast.appendChild(messageSpan);

  // "Change collection" button — only rendered when a callback is provided
  let dismissTimer: ReturnType<typeof setTimeout> | null = null;

  if (options.onChangeCollection) {
    const changeBtn = document.createElement("button");
    changeBtn.className = "magpie-toast__change";
    changeBtn.type = "button";
    changeBtn.textContent = "Change collection";

    changeBtn.addEventListener("click", () => {
      if (dismissTimer !== null) {
        clearTimeout(dismissTimer);
        dismissTimer = null;
      }
      toast.remove();
      // Non-null assertion is safe: button is only created when the
      // callback is defined.
      options.onChangeCollection!();
    });

    toast.appendChild(changeBtn);
  }

  // ── 4. Append to document body ──────────────────────────────────────────
  document.body.appendChild(toast);

  // ── 5. Schedule auto-dismiss ────────────────────────────────────────────
  const delay = options.autoDismissMs ?? 4000;
  dismissTimer = setTimeout(() => {
    toast.remove();
  }, delay);
}
