/**
 * Collection Picker Modal — pure state machine
 *
 * Defines all state phases and events for the modal, plus a `transition`
 * function that is a pure function: given a current state and an event it
 * returns the next state without any side-effects.
 *
 * Requirements: 6.1–6.10
 */

import type { Collection, PostMetadata } from "../shared/types/domain";
import type {
  BackgroundResponse,
  CreateCollectionResult,
  OutboundMessage,
  SavePostResult,
} from "../shared/types/messages";

// ── State types ──────────────────────────────────────────────────────────────

export type ModalPhase =
  | { phase: "CLOSED" }
  | { phase: "LOADING"; meta: Partial<PostMetadata>; preselectedId?: string | null }
  | {
      phase: "IDLE";
      meta: Partial<PostMetadata>;
      collections: Collection[];
      selectedId: string | null;
    }
  | {
      phase: "CREATING";
      meta: Partial<PostMetadata>;
      collections: Collection[];
      selectedId: string | null;
      inputValue: string;
    }
  | {
      phase: "VALIDATION_ERROR";
      meta: Partial<PostMetadata>;
      collections: Collection[];
      selectedId: string | null;
      inputValue: string;
      errorMsg: string;
    }
  | {
      phase: "SAVING";
      meta: Partial<PostMetadata>;
      collections: Collection[];
      selectedId: string;
      /**
       * Set when transitioning from CREATING → SAVING.
       * Carries the validated new collection name so `performSave` can issue
       * CREATE_COLLECTION before SAVE_POST.
       */
      newCollectionName?: string;
    }
  | {
      phase: "SAVE_ERROR";
      meta: Partial<PostMetadata>;
      collections: Collection[];
      selectedId: string | null;
      error: string;
    }
  | { phase: "FETCH_ERROR"; meta: Partial<PostMetadata>; error: string };

// ── Event types ──────────────────────────────────────────────────────────────

export type ModalEvent =
  | { type: "OPEN"; meta: Partial<PostMetadata>; preselectedId?: string | null }
  | { type: "COLLECTIONS_LOADED"; collections: Collection[] }
  | { type: "COLLECTIONS_FAILED"; error: string }
  | { type: "SELECT_COLLECTION"; id: string }
  | { type: "CONFIRM_SAVE" }
  | { type: "START_CREATE" }
  | { type: "INPUT_CHANGED"; value: string }
  | { type: "SUBMIT_CREATE" }
  | { type: "CANCEL_CREATE" }
  | { type: "SAVE_SUCCEEDED" }
  | { type: "SAVE_FAILED"; error: string }
  | { type: "DISMISS_ERROR" }
  | { type: "RETRY" }
  | { type: "CLOSE" };

// ── Pure transition function ─────────────────────────────────────────────────

/**
 * Pure state machine transition function.
 *
 * For any (state, event) pair not listed in the transition table the current
 * state is returned unchanged — unknown events are silently ignored so callers
 * never need to guard against impossible combinations.
 *
 * Requirements: 6.1–6.10
 */
export function transition(state: ModalPhase, event: ModalEvent): ModalPhase {
  switch (state.phase) {
    // ── CLOSED ──────────────────────────────────────────────────────────────
    case "CLOSED":
      // Requirement 6.1: CLOSED + OPEN → LOADING
      if (event.type === "OPEN") {
        return { phase: "LOADING", meta: event.meta, preselectedId: event.preselectedId ?? null };
      }
      return state;

    // ── LOADING ─────────────────────────────────────────────────────────────
    case "LOADING":
      // Requirement 6.2: LOADING + COLLECTIONS_LOADED → IDLE (selectedId: null)
      if (event.type === "COLLECTIONS_LOADED") {
        return {
          phase: "IDLE",
          meta: state.meta,
          collections: event.collections,
          // Pre-select the collection that was saved to (e.g. current default)
          selectedId: state.preselectedId ?? null,
        };
      }
      // Requirement 6.3: LOADING + COLLECTIONS_FAILED → FETCH_ERROR
      if (event.type === "COLLECTIONS_FAILED") {
        return { phase: "FETCH_ERROR", meta: state.meta, error: event.error };
      }
      return state;

    // ── IDLE ─────────────────────────────────────────────────────────────────
    case "IDLE":
      // Requirement 6.4: IDLE + SELECT_COLLECTION → IDLE (update selectedId)
      if (event.type === "SELECT_COLLECTION") {
        return { ...state, selectedId: event.id };
      }
      // Requirement 6.5: IDLE + CONFIRM_SAVE (selectedId !== null) → SAVING
      if (event.type === "CONFIRM_SAVE") {
        if (state.selectedId !== null) {
          return {
            phase: "SAVING",
            meta: state.meta,
            collections: state.collections,
            selectedId: state.selectedId,
          };
        }
        // Requirement 6.6: IDLE + CONFIRM_SAVE (selectedId === null) → IDLE unchanged
        return state;
      }
      // Requirement 6.7: IDLE + START_CREATE → CREATING (inputValue: '')
      if (event.type === "START_CREATE") {
        return {
          phase: "CREATING",
          meta: state.meta,
          collections: state.collections,
          selectedId: state.selectedId,
          inputValue: "",
        };
      }
      // Requirement 6.8: IDLE + CLOSE → CLOSED
      if (event.type === "CLOSE") {
        return { phase: "CLOSED" };
      }
      return state;

    // ── CREATING ─────────────────────────────────────────────────────────────
    case "CREATING":
      // Requirement 6.9: CREATING + INPUT_CHANGED → CREATING (update inputValue)
      if (event.type === "INPUT_CHANGED") {
        return { ...state, inputValue: event.value };
      }
      // Requirement 6.9: CREATING + CANCEL_CREATE → IDLE
      if (event.type === "CANCEL_CREATE") {
        return {
          phase: "IDLE",
          meta: state.meta,
          collections: state.collections,
          selectedId: state.selectedId,
        };
      }
      // Requirement 6.10: CREATING + SUBMIT_CREATE → VALIDATION_ERROR or SAVING
      if (event.type === "SUBMIT_CREATE") {
        const trimmed = state.inputValue.trim();
        // Reject empty or whitespace-only input
        if (!trimmed) {
          return {
            phase: "VALIDATION_ERROR",
            meta: state.meta,
            collections: state.collections,
            selectedId: state.selectedId,
            inputValue: state.inputValue,
            errorMsg: "Collection name cannot be empty",
          };
        }
        // Reject names longer than 100 characters
        if (state.inputValue.length > 100) {
          return {
            phase: "VALIDATION_ERROR",
            meta: state.meta,
            collections: state.collections,
            selectedId: state.selectedId,
            inputValue: state.inputValue,
            errorMsg: "Name must be 100 characters or fewer",
          };
        }
        // Valid name — BSW will create the collection then save the post
        return {
          phase: "SAVING",
          meta: state.meta,
          collections: state.collections,
          selectedId: "__new__",
          newCollectionName: trimmed,
        };
      }
      return state;

    // ── VALIDATION_ERROR ─────────────────────────────────────────────────────
    case "VALIDATION_ERROR":
      // Requirement 6.10: VALIDATION_ERROR + INPUT_CHANGED → CREATING
      if (event.type === "INPUT_CHANGED") {
        return {
          phase: "CREATING",
          meta: state.meta,
          collections: state.collections,
          selectedId: state.selectedId,
          inputValue: event.value,
        };
      }
      return state;

    // ── SAVING ───────────────────────────────────────────────────────────────
    case "SAVING":
      // Requirement 6.1: SAVING + SAVE_SUCCEEDED → CLOSED
      if (event.type === "SAVE_SUCCEEDED") {
        return { phase: "CLOSED" };
      }
      // Requirement 6.1: SAVING + SAVE_FAILED → SAVE_ERROR
      if (event.type === "SAVE_FAILED") {
        return {
          phase: "SAVE_ERROR",
          meta: state.meta,
          collections: state.collections,
          selectedId: state.selectedId,
          error: event.error,
        };
      }
      return state;

    // ── SAVE_ERROR ───────────────────────────────────────────────────────────
    case "SAVE_ERROR":
      // Requirement 6.1: SAVE_ERROR + DISMISS_ERROR → IDLE
      if (event.type === "DISMISS_ERROR") {
        return {
          phase: "IDLE",
          meta: state.meta,
          collections: state.collections,
          selectedId: state.selectedId,
        };
      }
      return state;

    // ── FETCH_ERROR ──────────────────────────────────────────────────────────
    case "FETCH_ERROR":
      // Requirement 6.1: FETCH_ERROR + RETRY → LOADING
      if (event.type === "RETRY") {
        return { phase: "LOADING", meta: state.meta };
      }
      // Requirement 6.1: FETCH_ERROR + CLOSE → CLOSED
      if (event.type === "CLOSE") {
        return { phase: "CLOSED" };
      }
      return state;

    default: {
      // TypeScript exhaustiveness check — unreachable at runtime
      const _exhaustive: never = state;
      return _exhaustive;
    }
  }
}

// ── Modal CSS ─────────────────────────────────────────────────────────────────

/**
 * Inline styles for the Collection Picker Modal.
 * Injected into the Shadow DOM root so styles are completely isolated from
 * the host page — host-page rules cannot bleed in, and these rules cannot
 * leak out.
 */
const MODAL_CSS = `
/* === Scoped reset =========================================================
   Only affects elements inside the shadow root.                           */
*, *::before, *::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

/* === Modal root container =================================================
   position:fixed covers the viewport; pointer-events:none lets clicks
   through to the host page except where .magpie-overlay / .magpie-card
   explicitly restore pointer-events:auto.                                 */
#magpie-modal-root {
  position: fixed;
  inset: 0;
  z-index: 2147483640;
  pointer-events: none;
}

/* === Dimmed backdrop ====================================================== */
.magpie-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.65);
  pointer-events: auto;
}

/* === White card =========================================================== */
.magpie-card {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 1;                    /* card above overlay within root stacking ctx */
  pointer-events: auto;
  width: 400px;
  max-width: calc(100vw - 32px);
  max-height: calc(100vh - 64px);
  background: #ffffff;
  border-radius: 12px;
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.25);
  display: flex;
  flex-direction: column;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
  font-size: 14px;
  color: #262626;
  overflow: hidden;
}

/* === Header =============================================================== */
.magpie-header {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 14px 48px;
  border-bottom: 1px solid #efefef;
  position: relative;
  flex-shrink: 0;
}

.magpie-title {
  font-size: 16px;
  font-weight: 600;
  line-height: 1.3;
  color: #262626;
  font-family: inherit;
}

.magpie-close-btn {
  position: absolute;
  right: 12px;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  cursor: pointer;
  padding: 0;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #262626;
  font-size: 18px;
  line-height: 1;
}
.magpie-close-btn:hover { background: rgba(0, 0, 0, 0.06); }
.magpie-close-btn:focus-visible { outline: 2px solid #0095f6; outline-offset: 2px; }

/* === Scrollable body ====================================================== */
.magpie-body {
  flex: 1;
  overflow-y: auto;
  min-height: 80px;
  max-height: 320px;
}

/* === Footer =============================================================== */
.magpie-footer {
  padding: 12px 16px;
  border-top: 1px solid #efefef;
  flex-shrink: 0;
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

/* === Collection list ====================================================== */
.magpie-collection-list {
  list-style: none;
  padding: 0;
}

.magpie-collection-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 16px;
  cursor: pointer;
  border-bottom: 1px solid #f9f9f9;
  background: none;
  outline: none;
}
.magpie-collection-item:hover { background: #fafafa; }
.magpie-collection-item:last-child { border-bottom: none; }
.magpie-collection-item:focus-visible { outline: 2px solid #0095f6; outline-offset: -2px; }

.magpie-collection-name {
  flex: 1;
  font-size: 14px;
  font-family: inherit;
  color: #262626;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Circular checkmark indicator */
.magpie-check {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  border: 2px solid #dbdbdb;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.12s, border-color 0.12s;
}
.magpie-check svg { display: none; }
.magpie-check--selected {
  background: #0095f6;
  border-color: #0095f6;
}
.magpie-check--selected svg { display: block; }

/* "No collections yet" placeholder */
.magpie-empty {
  padding: 32px 16px;
  text-align: center;
  color: #8e8e8e;
  font-size: 14px;
  font-family: inherit;
}

/* "Create new collection" row */
.magpie-create-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 16px;
  width: 100%;
  background: none;
  border: none;
  border-top: 1px solid #efefef;
  cursor: pointer;
  color: #0095f6;
  font-size: 14px;
  font-weight: 600;
  font-family: inherit;
  text-align: left;
  outline: none;
}
.magpie-create-row:hover { background: #fafafa; }
.magpie-create-row:focus-visible { outline: 2px solid #0095f6; outline-offset: -2px; }

/* === Inline input area for new collection ================================= */
.magpie-input-area {
  padding: 12px 16px;
  border-top: 1px solid #efefef;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.magpie-input {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #dbdbdb;
  border-radius: 6px;
  font-size: 14px;
  font-family: inherit;
  color: #262626;
  background: #fafafa;
  outline: none;
}
.magpie-input:focus { border-color: #a8a8a8; background: #ffffff; }
.magpie-input--error { border-color: #ed4956; }
.magpie-input--error:focus { border-color: #ed4956; }

.magpie-validation-error {
  font-size: 12px;
  color: #ed4956;
  font-weight: 500;
  font-family: inherit;
}

.magpie-input-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}

/* === Buttons ============================================================== */
.magpie-btn {
  padding: 7px 16px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  line-height: 1.4;
  white-space: nowrap;
  outline: none;
}
.magpie-btn--primary {
  background: #0095f6;
  color: #ffffff;
  border: 1px solid #0095f6;
}
.magpie-btn--primary:hover:not(:disabled) { background: #1877f2; border-color: #1877f2; }
.magpie-btn--primary:disabled {
  background: #b2dffc;
  border-color: #b2dffc;
  cursor: not-allowed;
  opacity: 0.7;
}
.magpie-btn--secondary {
  background: transparent;
  color: #262626;
  border: 1px solid #dbdbdb;
}
.magpie-btn--secondary:hover { background: #fafafa; }
.magpie-btn:focus-visible { outline: 2px solid #0095f6; outline-offset: 2px; }

/* === Loading spinner ====================================================== */
.magpie-spinner-wrap {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px 16px;
}

.magpie-spinner {
  width: 32px;
  height: 32px;
  border: 3px solid #efefef;
  border-top-color: #0095f6;
  border-radius: 50%;
  animation: magpie-spin 0.75s linear infinite;
}

@keyframes magpie-spin {
  to { transform: rotate(360deg); }
}

/* === Saving overlay (spinner on top of dimmed list) ======================= */
.magpie-saving-wrap {
  position: relative;
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.magpie-saving-overlay {
  position: absolute;
  inset: 0;
  background: rgba(255, 255, 255, 0.85);
  display: flex;
  align-items: center;
  justify-content: center;
}

/* === Error state ========================================================== */
.magpie-error-body {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 28px 24px;
  text-align: center;
}

.magpie-error-icon {
  font-size: 28px;
  line-height: 1;
}

.magpie-error-message {
  font-size: 14px;
  color: #262626;
  line-height: 1.5;
  font-family: inherit;
  word-break: break-word;
}

.magpie-error-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: center;
}
`;

// ── Shadow DOM ────────────────────────────────────────────────────────────────

/** Module-level reference to the closed ShadowRoot — retained across re-renders. */
let shadowRoot: ShadowRoot | null = null;

/**
 * Returns the existing Shadow DOM root or creates a new one attached to
 * `<div id="magpie-modal-host">` (which is appended to `document.body` if
 * missing). The root uses `mode: "closed"` so host-page scripts cannot reach
 * the modal's internal DOM via `element.shadowRoot`.
 */
function getOrCreateShadowRoot(): ShadowRoot {
  let host = document.getElementById("magpie-modal-host");
  if (!host) {
    host = document.createElement("div");
    host.id = "magpie-modal-host";
    document.body.appendChild(host);
  }
  if (!shadowRoot) {
    shadowRoot = host.attachShadow({ mode: "closed" });
    // Inject modal styles — once, when the shadow root is first created
    const style = document.createElement("style");
    style.textContent = MODAL_CSS;
    shadowRoot.appendChild(style);
  }
  return shadowRoot;
}

// ── DOM helper functions ──────────────────────────────────────────────────────

/**
 * Builds the modal header element (centred title + optional close button).
 */
function buildHeader(title: string, onClose?: () => void): HTMLElement {
  const header = document.createElement("div");
  header.className = "magpie-header";

  const h2 = document.createElement("h2");
  h2.className = "magpie-title";
  h2.textContent = title;
  header.appendChild(h2);

  if (onClose) {
    const closeBtn = document.createElement("button");
    closeBtn.className = "magpie-close-btn";
    closeBtn.type = "button";
    closeBtn.setAttribute("aria-label", "Close");
    closeBtn.textContent = "\u2715"; // ✕
    closeBtn.addEventListener("click", onClose);
    header.appendChild(closeBtn);
  }

  return header;
}

/**
 * Builds the collection list element.
 *
 * - Renders a "No collections yet" message when the array is empty.
 * - Each item shows the collection name and a circular checkmark indicator.
 * - When `interactive` is `false` click handlers are omitted (used in SAVING).
 *
 * `textContent` is used for user-supplied strings to prevent XSS.
 *
 * Requirements: 6.2, 6.3
 */
function buildCollectionList(
  collections: Collection[],
  selectedId: string | null,
  interactive: boolean,
): HTMLElement {
  if (collections.length === 0) {
    const empty = document.createElement("p");
    empty.className = "magpie-empty";
    empty.textContent = "No collections yet";
    return empty;
  }

  const ul = document.createElement("ul");
  ul.className = "magpie-collection-list";
  ul.setAttribute("role", "listbox");
  ul.setAttribute("aria-label", "Your collections");

  for (const col of collections) {
    const li = document.createElement("li");
    li.className = "magpie-collection-item";
    li.setAttribute("role", "option");
    const isSelected = selectedId === col.id;
    li.setAttribute("aria-selected", String(isSelected));

    if (interactive) {
      li.setAttribute("tabindex", "0");
      const select = (): void =>
        dispatch({ type: "SELECT_COLLECTION", id: col.id });
      li.addEventListener("click", select);
      li.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          select();
        }
      });
    }

    // Collection name — textContent keeps user data out of innerHTML
    const nameSpan = document.createElement("span");
    nameSpan.className = "magpie-collection-name";
    nameSpan.textContent = col.name;

    // Checkmark circle
    const check = document.createElement("span");
    check.className = `magpie-check${isSelected ? " magpie-check--selected" : ""}`;
    check.setAttribute("aria-hidden", "true");
    // SVG shown only when .magpie-check--selected is present (via CSS display toggle)
    check.innerHTML =
      `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" ` +
      `fill="none" stroke="#fff" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round">` +
      `<polyline points="20 6 9 17 4 12"/></svg>`;

    li.appendChild(nameSpan);
    li.appendChild(check);
    ul.appendChild(li);
  }

  return ul;
}

/**
 * Builds a centred loading spinner wrapped in a status landmark.
 */
function buildSpinner(): HTMLElement {
  const wrap = document.createElement("div");
  wrap.className = "magpie-spinner-wrap";
  wrap.setAttribute("role", "status");
  wrap.setAttribute("aria-label", "Loading");
  const spinner = document.createElement("div");
  spinner.className = "magpie-spinner";
  wrap.appendChild(spinner);
  return wrap;
}

/**
 * Builds the inline input area used in CREATING and VALIDATION_ERROR phases.
 *
 * @param inputValue  Current value to pre-fill the input.
 * @param errorMsg    When non-null, the input is decorated with an error border
 *                    and this message is rendered beneath it.
 */
function buildInputArea(
  inputValue: string,
  errorMsg: string | null,
): { container: HTMLElement; inputEl: HTMLInputElement } {
  const container = document.createElement("div");
  container.className = "magpie-input-area";

  const hasError = errorMsg !== null;

  const inputEl = document.createElement("input");
  inputEl.className = `magpie-input${hasError ? " magpie-input--error" : ""}`;
  inputEl.type = "text";
  inputEl.maxLength = 100;
  inputEl.placeholder = "Collection name";
  inputEl.value = inputValue;
  inputEl.setAttribute("aria-label", "New collection name");
  if (hasError) {
    inputEl.setAttribute("aria-invalid", "true");
    inputEl.setAttribute("aria-describedby", "magpie-val-err");
  }
  // Update state on every keystroke; renderModal skips a re-render when the
  // phase stays the same (see dispatch) so the cursor position is preserved.
  inputEl.addEventListener("input", (e) => {
    dispatch({
      type: "INPUT_CHANGED",
      value: (e.target as HTMLInputElement).value,
    });
  });
  inputEl.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      dispatch({ type: "SUBMIT_CREATE" });
    }
    if (e.key === "Escape") {
      e.preventDefault();
      dispatch({ type: "CANCEL_CREATE" });
    }
  });
  container.appendChild(inputEl);

  if (hasError && errorMsg) {
    const errSpan = document.createElement("span");
    errSpan.id = "magpie-val-err";
    errSpan.className = "magpie-validation-error";
    errSpan.setAttribute("role", "alert");
    errSpan.textContent = errorMsg;
    container.appendChild(errSpan);
  }

  const actions = document.createElement("div");
  actions.className = "magpie-input-actions";

  const cancelBtn = document.createElement("button");
  cancelBtn.className = "magpie-btn magpie-btn--secondary";
  cancelBtn.type = "button";
  cancelBtn.textContent = "Cancel";
  cancelBtn.addEventListener("click", () =>
    dispatch({ type: "CANCEL_CREATE" }),
  );

  const addBtn = document.createElement("button");
  addBtn.className = "magpie-btn magpie-btn--primary";
  addBtn.type = "button";
  addBtn.textContent = "Add";
  addBtn.addEventListener("click", () => dispatch({ type: "SUBMIT_CREATE" }));

  actions.appendChild(cancelBtn);
  actions.appendChild(addBtn);
  container.appendChild(actions);

  return { container, inputEl };
}

// ── renderModal ───────────────────────────────────────────────────────────────

/**
 * Re-renders the shadow DOM to match the current `state`.
 *
 * Each call removes the previous render and builds a fresh DOM tree.  When
 * `state.phase === 'CLOSED'` the `#magpie-modal-root` element is removed from
 * the shadow root and no new element is appended — the modal is fully hidden.
 *
 * Overlay click closes the modal in IDLE and FETCH_ERROR phases (the two
 * phases whose transition table includes a CLOSE event).  In all other phases
 * the overlay is inert.
 *
 * Requirements: 6.1–6.10
 */
export function renderModal(state: ModalPhase): void {
  const root = getOrCreateShadowRoot();

  // Remove previous render (querySelector is available on ShadowRoot)
  root.querySelector("#magpie-modal-root")?.remove();

  if (state.phase === "CLOSED") return;

  // ── Container ─────────────────────────────────────────────────────────────
  const container = document.createElement("div");
  container.id = "magpie-modal-root";

  // ── Overlay backdrop ──────────────────────────────────────────────────────
  const overlay = document.createElement("div");
  overlay.className = "magpie-overlay";
  // Allow backdrop-click to close only in phases that handle the CLOSE event
  if (state.phase === "IDLE" || state.phase === "FETCH_ERROR") {
    overlay.addEventListener("click", () => dispatch({ type: "CLOSE" }));
  }
  container.appendChild(overlay);

  // ── Modal card ────────────────────────────────────────────────────────────
  const card = document.createElement("div");
  card.className = "magpie-card";
  card.setAttribute("role", "dialog");
  card.setAttribute("aria-modal", "true");
  card.setAttribute("aria-label", "Save to collection");

  switch (state.phase) {
    // ── LOADING: spinner only ────────────────────────────────────────────────
    case "LOADING": {
      card.appendChild(buildHeader("Save to collection"));
      const body = document.createElement("div");
      body.className = "magpie-body";
      body.appendChild(buildSpinner());
      card.appendChild(body);
      break;
    }

    // ── IDLE: collection list + confirm button ───────────────────────────────
    case "IDLE": {
      card.appendChild(
        buildHeader("Save to collection", () => dispatch({ type: "CLOSE" })),
      );

      const body = document.createElement("div");
      body.className = "magpie-body";
      body.appendChild(
        buildCollectionList(state.collections, state.selectedId, true),
      );

      const createBtn = document.createElement("button");
      createBtn.className = "magpie-create-row";
      createBtn.type = "button";
      // Static SVG + label — no user data in innerHTML
      createBtn.innerHTML =
        `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" ` +
        `fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" ` +
        `stroke-linejoin="round" aria-hidden="true">` +
        `<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>` +
        `<span>Create new collection</span>`;
      createBtn.addEventListener("click", () =>
        dispatch({ type: "START_CREATE" }),
      );
      body.appendChild(createBtn);
      card.appendChild(body);

      const footer = document.createElement("div");
      footer.className = "magpie-footer";
      const saveBtn = document.createElement("button");
      saveBtn.className = "magpie-btn magpie-btn--primary";
      saveBtn.type = "button";
      saveBtn.textContent = "Save";
      saveBtn.disabled = state.selectedId === null;
      saveBtn.addEventListener("click", () =>
        dispatch({ type: "CONFIRM_SAVE" }),
      );
      footer.appendChild(saveBtn);
      card.appendChild(footer);
      break;
    }

    // ── CREATING: list + text input ──────────────────────────────────────────
    case "CREATING": {
      card.appendChild(buildHeader("Save to collection"));

      const body = document.createElement("div");
      body.className = "magpie-body";
      body.appendChild(
        buildCollectionList(state.collections, state.selectedId, true),
      );

      const { container: inputArea, inputEl } = buildInputArea(
        state.inputValue,
        null,
      );
      body.appendChild(inputArea);
      card.appendChild(body);

      // Auto-focus on next frame so the element is mounted before focus()
      requestAnimationFrame(() => inputEl.focus());
      break;
    }

    // ── VALIDATION_ERROR: list + input + error message ───────────────────────
    case "VALIDATION_ERROR": {
      card.appendChild(buildHeader("Save to collection"));

      const body = document.createElement("div");
      body.className = "magpie-body";
      body.appendChild(
        buildCollectionList(state.collections, state.selectedId, true),
      );

      const { container: inputArea, inputEl } = buildInputArea(
        state.inputValue,
        state.errorMsg,
      );
      body.appendChild(inputArea);
      card.appendChild(body);

      // Restore focus to the input so keyboard users land in the right place
      requestAnimationFrame(() => inputEl.focus());
      break;
    }

    // ── SAVING: dimmed list + spinner overlay ────────────────────────────────
    case "SAVING": {
      card.appendChild(buildHeader("Save to collection"));

      const savingWrap = document.createElement("div");
      savingWrap.className = "magpie-saving-wrap";

      const body = document.createElement("div");
      body.className = "magpie-body";
      // Show the selected collection (treat '__new__' as nothing selected)
      const displaySelectedId =
        state.selectedId === "__new__" ? null : state.selectedId;
      body.appendChild(
        buildCollectionList(
          state.collections,
          displaySelectedId,
          false /* non-interactive */,
        ),
      );
      savingWrap.appendChild(body);

      const savingOverlay = document.createElement("div");
      savingOverlay.className = "magpie-saving-overlay";
      savingOverlay.setAttribute("role", "status");
      savingOverlay.setAttribute("aria-label", "Saving…");
      savingOverlay.appendChild(buildSpinner());
      savingWrap.appendChild(savingOverlay);

      card.appendChild(savingWrap);
      break;
    }

    // ── SAVE_ERROR: error message + dismiss ──────────────────────────────────
    case "SAVE_ERROR": {
      card.appendChild(buildHeader("Save to collection"));

      const body = document.createElement("div");
      body.className = "magpie-body";

      const errorDiv = document.createElement("div");
      errorDiv.className = "magpie-error-body";
      errorDiv.setAttribute("role", "alert");

      const icon = document.createElement("div");
      icon.className = "magpie-error-icon";
      icon.setAttribute("aria-hidden", "true");
      icon.textContent = "⚠";

      const msg = document.createElement("p");
      msg.className = "magpie-error-message";
      msg.textContent = `Save failed: ${state.error}`;

      const actionsDiv = document.createElement("div");
      actionsDiv.className = "magpie-error-actions";

      const dismissBtn = document.createElement("button");
      dismissBtn.className = "magpie-btn magpie-btn--secondary";
      dismissBtn.type = "button";
      dismissBtn.textContent = "Dismiss";
      dismissBtn.addEventListener("click", () =>
        dispatch({ type: "DISMISS_ERROR" }),
      );
      actionsDiv.appendChild(dismissBtn);

      errorDiv.appendChild(icon);
      errorDiv.appendChild(msg);
      errorDiv.appendChild(actionsDiv);
      body.appendChild(errorDiv);
      card.appendChild(body);
      break;
    }

    // ── FETCH_ERROR: error message + retry + cancel ──────────────────────────
    case "FETCH_ERROR": {
      card.appendChild(
        buildHeader("Save to collection", () => dispatch({ type: "CLOSE" })),
      );

      const body = document.createElement("div");
      body.className = "magpie-body";

      const errorDiv = document.createElement("div");
      errorDiv.className = "magpie-error-body";
      errorDiv.setAttribute("role", "alert");

      const icon = document.createElement("div");
      icon.className = "magpie-error-icon";
      icon.setAttribute("aria-hidden", "true");
      icon.textContent = "⚠";

      const msg = document.createElement("p");
      msg.className = "magpie-error-message";
      msg.textContent = `Could not load collections: ${state.error}`;

      const actionsDiv = document.createElement("div");
      actionsDiv.className = "magpie-error-actions";

      const retryBtn = document.createElement("button");
      retryBtn.className = "magpie-btn magpie-btn--primary";
      retryBtn.type = "button";
      retryBtn.textContent = "Retry";
      retryBtn.addEventListener("click", () => {
        dispatch({ type: "RETRY" }); // → LOADING
        fetchCollections(); // kick off BSW request again
      });

      const cancelBtn = document.createElement("button");
      cancelBtn.className = "magpie-btn magpie-btn--secondary";
      cancelBtn.type = "button";
      cancelBtn.textContent = "Cancel";
      cancelBtn.addEventListener("click", () => dispatch({ type: "CLOSE" }));

      actionsDiv.appendChild(retryBtn);
      actionsDiv.appendChild(cancelBtn);
      errorDiv.appendChild(icon);
      errorDiv.appendChild(msg);
      errorDiv.appendChild(actionsDiv);
      body.appendChild(errorDiv);
      card.appendChild(body);
      break;
    }
  }

  container.appendChild(card);
  root.appendChild(container);
}

// ── BSW communication ─────────────────────────────────────────────────────────

/**
 * Sends GET_COLLECTIONS to the Background Service Worker and dispatches the
 * result as COLLECTIONS_LOADED or COLLECTIONS_FAILED.
 *
 * Extracted as a reusable helper so both `openModal` (initial open) and the
 * Retry button (after FETCH_ERROR) can share the same logic.
 *
 * Requirements: 6.2, 6.9
 */
/** Returns true if the extension context is still valid. */
function isExtensionContextValid(): boolean {
  try {
    return typeof chrome !== "undefined" && !!chrome.runtime?.id;
  } catch {
    return false;
  }
}

function fetchCollections(): void {
  if (!isExtensionContextValid()) {
    dispatch({ type: "COLLECTIONS_FAILED", error: "Extension reloaded — please refresh the page." });
    return;
  }
  chrome.runtime.sendMessage(
    { type: "GET_COLLECTIONS" },
    (response: BackgroundResponse<Collection[]>) => {
      if (chrome.runtime.lastError) {
        dispatch({
          type: "COLLECTIONS_FAILED",
          error:
            chrome.runtime.lastError.message ??
            "Failed to reach background service",
        });
        return;
      }
      if (response.success) {
        // response.data is ManageCollectionResponse: { operation:"list", collections:[] }
        const respData = response.data as unknown as { collections?: Collection[] };
        const cols: Collection[] = Array.isArray(respData?.collections)
          ? respData.collections
          : Array.isArray(response.data)
          ? (response.data as unknown as Collection[])
          : [];

        // Sync the server-side default to local storage so the extension can
        // save directly without opening the modal. Runs on every modal open,
        // picking up any changes made from the web viewer.
        // Fallback: if no collection is marked is_default yet (e.g. existing
        // users before migration), treat the first collection as the default
        // and persist that choice to the server so it won't happen again.
        const serverDefault = cols.find((c) => c.is_default) ?? cols[0] ?? null;
        if (serverDefault) {
          chrome.storage.local
            .set({ magpie_default_collection: { id: serverDefault.id, name: serverDefault.name } })
            .catch(() => {});

          // If nothing was flagged is_default on the server, persist the
          // auto-selected first collection so web viewer shows it correctly.
          if (!cols.find((c) => c.is_default) && isExtensionContextValid()) {
            chrome.runtime.sendMessage({
              type: "SET_DEFAULT_COLLECTION",
              payload: { collection_id: serverDefault.id },
            }).catch(() => {});
          }
        }

        dispatch({ type: "COLLECTIONS_LOADED", collections: cols });
      } else {
        dispatch({ type: "COLLECTIONS_FAILED", error: response.error });
      }
    },
  );
}

// ── Global state & public API ─────────────────────────────────────────────────

/** Module-level state — starts as CLOSED. */
let currentState: ModalPhase = { phase: "CLOSED" };

/**
 * Optional callback invoked by `performSave` after a post is saved
 * successfully.  Receives the `collection_id` that was actually used
 * (including freshly-created collections) so callers can supply a
 * "Change collection" shortcut in the toast.
 *
 * Register with `setOnSaveSuccessCallback`.
 *
 * Requirements: 6.4, 6.6
 */
let onSaveSuccessCallback: ((collectionId: string, collectionName: string | null) => void) | null = null;

/**
 * Registers a callback that fires after a post has been saved successfully.
 *
 * The callback receives the `collection_id` used for the save so the caller
 * (e.g. `instagram.ts`) can show a platform-specific toast with the correct
 * "Change collection" context.
 *
 * Requirements: 6.4, 6.6
 */
export function setOnSaveSuccessCallback(
  cb: (collectionId: string, collectionName: string | null) => void,
): void {
  onSaveSuccessCallback = cb;
}

/**
 * Transitions the state machine with `event`, updates `currentState`, and
 * re-renders the modal DOM.
 *
 * Special case: INPUT_CHANGED events that leave the phase unchanged (i.e.
 * CREATING → CREATING) skip the re-render so the text input retains cursor
 * position and focus. The state is still updated, so SUBMIT_CREATE reads the
 * correct `inputValue`.
 *
 * After a successful save (SAVING → CLOSED via SAVE_SUCCEEDED), the modal is
 * removed immediately. The platform-specific content script (instagram.ts /
 * x.ts) is responsible for showing the confirmation toast — it registers a
 * callback via `setOnSaveSuccessCallback` and `performSave` invokes that
 * callback after this dispatch call returns (Requirements 6.1, 11.3–11.5,
 * 11.7).
 *
 * When the state first enters SAVING, `performSave` is called asynchronously
 * to route the BSW message calls.
 */
export function dispatch(event: ModalEvent): void {
  const prevState = currentState;
  const prevPhase = currentState.phase;
  currentState = transition(currentState, event);

  // After SAVING → CLOSED: remove the modal. The confirmation toast is shown
  // by the content script through the onSaveSuccessCallback registered with
  // setOnSaveSuccessCallback (Requirements 11.1–11.5, 11.7, 11.8).
  if (event.type === "SAVE_SUCCEEDED" && prevState.phase === "SAVING") {
    renderModal(currentState); // renders CLOSED (removes the modal)
    return;
  }

  // Skip re-render for in-place typing to preserve cursor position
  if (event.type === "INPUT_CHANGED" && currentState.phase === prevPhase)
    return;
  renderModal(currentState);

  // When we first enter the SAVING phase, kick off the async BSW operations.
  // Guard against re-entry: only fire when prevPhase was NOT already SAVING
  // (dispatch(SAVE_FAILED) would otherwise re-trigger performSave in error
  // recovery paths).
  if (currentState.phase === "SAVING" && prevPhase !== "SAVING") {
    performSave(currentState as ModalPhase & { phase: "SAVING" }).catch(
      (err: unknown) => {
        dispatch({
          type: "SAVE_FAILED",
          error:
            err instanceof Error ? err.message : "Unexpected error during save",
        });
      },
    );
  }
}

/**
 * Opens the Collection Picker Modal for a given post.
 *
 * Dispatches OPEN (transitions CLOSED → LOADING and renders the loading
 * spinner), then immediately sends GET_COLLECTIONS to the Background Service
 * Worker. On success dispatches COLLECTIONS_LOADED (→ IDLE); on failure
 * dispatches COLLECTIONS_FAILED (→ FETCH_ERROR).
 *
 * Requirements: 6.1, 6.2, 6.9
 */
export function openModal(meta: Partial<PostMetadata>, preselectedId?: string | null): void {
  dispatch({ type: "OPEN", meta, preselectedId });
  fetchCollections();
}

// ── BSW save operations ────────────────────────────────────────────────────

/**
 * Performs the async Background Service Worker message calls required when
 * the state machine enters the SAVING phase.
 *
 * Two paths:
 *
 *  1. `selectedId === '__new__'` — sends CREATE_COLLECTION to obtain a real
 *     collection UUID, then sends SAVE_POST with that UUID.
 *     The new collection name is taken from `state.newCollectionName`, which
 *     is always populated by the CREATING → SAVING transition (Requirement 6.6).
 *
 *  2. Any real UUID — sends SAVE_POST directly (Requirement 6.4).
 *
 * On success:
 *  - Dispatches `SAVE_SUCCEEDED` (closes the modal, triggers the toast in
 *    `dispatch`).
 *  - Calls `onSaveSuccessCallback` with the resolved `collection_id`.
 *
 * On failure:
 *  - Dispatches `SAVE_FAILED` with a human-readable error (Requirements 6.7,
 *    6.8 — the modal remains open).
 *
 * Requirements: 6.2, 6.3, 6.4, 6.6, 6.7, 6.8, 6.9
 */
async function performSave(
  state: ModalPhase & { phase: "SAVING" },
): Promise<void> {
  const { meta, selectedId, newCollectionName } = state;

  // Guard: post_url is required to save (Requirement 7.13)
  if (!meta.post_url) {
    dispatch({
      type: "SAVE_FAILED",
      error: "Cannot save: post URL could not be determined.",
    });
    return;
  }

  let collectionId = selectedId;

  // ── Path 1: create new collection first (Requirement 6.6) ─────────────
  if (selectedId === "__new__") {
    if (!newCollectionName) {
      // Defensive guard — the CREATING → SAVING transition always sets this.
      dispatch({
        type: "SAVE_FAILED",
        error: "Internal error: new collection name was not carried to SAVING.",
      });
      return;
    }

    let createResp: CreateCollectionResult;
    try {
      createResp = (await chrome.runtime.sendMessage({
        type: "CREATE_COLLECTION",
        payload: { name: newCollectionName },
      } satisfies OutboundMessage)) as CreateCollectionResult;
    } catch (err) {
      // Requirement 6.8: create-collection failure → show error
      dispatch({
        type: "SAVE_FAILED",
        error:
          err instanceof Error
            ? err.message
            : "Failed to reach background service",
      });
      return;
    }

    if (!createResp.success) {
      // Requirement 6.8: create-collection failure → show error
      dispatch({ type: "SAVE_FAILED", error: createResp.error });
      return;
    }

    collectionId = createResp.data.id;
  }

  // ── Path 2: save the post (Requirements 6.4, 6.7) ─────────────────────
  let saveResp: SavePostResult;
  try {
    saveResp = (await chrome.runtime.sendMessage({
      type: "SAVE_POST",
      payload: {
        post_url: meta.post_url,
        collection_id: collectionId,
        post_type: meta.post_type ?? "post",
        platform: meta.platform ?? "instagram",
        author_username: meta.author_username ?? null,
        author_display_name: meta.author_display_name ?? null,
        author_avatar_url: meta.author_avatar_url ?? null,
        content_text: meta.content_text ?? null,
        media_urls: meta.media_urls ?? null,
        post_timestamp: meta.post_timestamp ?? null,
        raw_metadata: meta.raw_metadata ?? null,
      },
    } satisfies OutboundMessage)) as SavePostResult;
  } catch (err) {
    // Requirement 6.7: save failure → show error, keep modal open
    dispatch({
      type: "SAVE_FAILED",
      error:
        err instanceof Error
          ? err.message
          : "Failed to reach background service",
    });
    return;
  }

  if (saveResp.success) {
    // Requirement 6.4: close modal on successful save
    dispatch({ type: "SAVE_SUCCEEDED" });
    // Notify the caller with the resolved collection_id so it can show
    // the toast "Change collection" button with the correct context.
    const collectionName = state.collections.find((c) => c.id === collectionId)?.name ?? null;
    onSaveSuccessCallback?.(collectionId, collectionName);
  } else {
    // Requirement 6.7: save failure → show error, keep modal open
    dispatch({ type: "SAVE_FAILED", error: saveResp.error });
  }
}
