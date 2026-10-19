/**
 * adapters/x/button-injection.ts
 * X/Twitter-specific button injection logic.
 *
 * Uses capture-phase click to prevent X's native interactions.
 */

import {
  BUTTON_ATTR,
  BUTTON_SELECTOR,
  type ButtonState,
} from "../../../shared/platform";
import { WITHIN_TWEET } from "./selectors";

// ─────────────────────────────────────────────────────────────────────────────
// Button Icon
// ─────────────────────────────────────────────────────────────────────────────

function getXButtonIcon(state: ButtonState): string {
  if (state === "loading") {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
      <circle cx="12" cy="12" r="10" opacity=".25"/>
      <path d="M12 2a10 10 0 0 1 10 10" stroke-width="2.5">
        <animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur=".75s" repeatCount="indefinite"/>
      </path></svg>`;
  }
  
  const dim = state === "saved" || state === "duplicate" ? 'opacity=".5"' : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">` +
    `<path d="M20 3H4a1 1 0 0 0-1 1v3a1 1 0 0 0 1 1v11a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V8a1 1 0 0 0 1-1V4a1 1 0 0 0-1-1zm-1 15H5V8h14v10zM5 6V5h14v1H5zm7 4H9v2h3v2h2v-2h3v-2h-3V8h-2v2z" ${dim}/></svg>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Button State
// ─────────────────────────────────────────────────────────────────────────────

export function setXButtonState(btn: HTMLButtonElement, state: ButtonState): void {
  btn.innerHTML = getXButtonIcon(state);
  btn.disabled = state === "loading";
  btn.setAttribute("data-state", state);
}

// ─────────────────────────────────────────────────────────────────────────────
// Button Creation
// ─────────────────────────────────────────────────────────────────────────────

function createXSaveButton(
  onClick: (e: MouseEvent) => void
): HTMLButtonElement {
  const btn = document.createElement("button");
  btn.setAttribute(BUTTON_ATTR, "true");
  btn.setAttribute("aria-label", "Save to Magpie archive");
  btn.setAttribute("type", "button");
  btn.className = "magpie-save-btn magpie-save-btn--x";

  btn.innerHTML = getXButtonIcon("idle");

  // Match X's muted icon color and button spacing
  btn.style.cssText =
    "background:none;border:none;cursor:pointer;padding:0 8px;" +
    "display:inline-flex;align-items:center;justify-content:center;" +
    "opacity:0.7;color:#71767b;transition:opacity 0.15s;";

  // Capture-phase listener prevents X's native handlers
  btn.addEventListener(
    "click",
    (e) => {
      e.stopImmediatePropagation();
      e.preventDefault();
      onClick(e);
    },
    { capture: true }
  );

  return btn;
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Injects a save button into the tweet's action bar.
 */
export function injectXButton(
  tweetElement: Element,
  onClick: (postElement: Element, button: HTMLButtonElement) => void
): HTMLButtonElement | null {
  // Already has button
  if (tweetElement.querySelector(BUTTON_SELECTOR)) return null;

  const actionBar = tweetElement.querySelector<HTMLElement>(WITHIN_TWEET.actionBar);
  if (!actionBar) return null;

  const handleClick = (e: MouseEvent) => {
    const btn = e.currentTarget as HTMLButtonElement;
    onClick(tweetElement, btn);
  };

  const btn = createXSaveButton(handleClick);
  actionBar.appendChild(btn);

  return btn;
}

/**
 * Checks if a save button exists in the tweet element.
 */
export function hasXButton(element: Element): boolean {
  return element.querySelector(BUTTON_SELECTOR) !== null;
}

/**
 * Removes all Magpie buttons from the document.
 */
export function removeXButtons(): void {
  document.querySelectorAll(BUTTON_SELECTOR).forEach((btn) => btn.remove());
}
