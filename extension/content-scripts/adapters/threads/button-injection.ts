/**
 * adapters/threads/button-injection.ts
 * Threads-specific button injection logic.
 */

import {
  BUTTON_ATTR,
  BUTTON_SELECTOR,
  getButtonIcon,
  type ButtonState,
} from "../../../shared/platform";
import { LIKE_LABELS, REPLY_LABELS, SHARE_LABELS } from "./selectors";

// ─────────────────────────────────────────────────────────────────────────────
// Button State
// ─────────────────────────────────────────────────────────────────────────────

export function setThreadsButtonState(btn: HTMLButtonElement, state: ButtonState): void {
  btn.innerHTML = getButtonIcon(state);
  btn.disabled = state === "loading";
  btn.setAttribute("data-state", state);
}

// ─────────────────────────────────────────────────────────────────────────────
// Button Creation
// ─────────────────────────────────────────────────────────────────────────────

function createThreadsSaveButton(
  onClick: (e: MouseEvent) => void
): HTMLButtonElement {
  const btn = document.createElement("button");
  btn.setAttribute(BUTTON_ATTR, "true");
  btn.setAttribute("aria-label", "Save to Magpie");
  btn.setAttribute("type", "button");

  btn.innerHTML = getButtonIcon("idle");

  // Threads-style button (similar to Instagram)
  btn.style.cssText = [
    "background:none",
    "border:none",
    "cursor:pointer",
    "padding:8px",
    "display:inline-flex",
    "align-items:center",
    "justify-content:center",
    "color:#000",
    "opacity:0.7",
    "transition:opacity .2s",
  ].join(";");

  // Dark mode detection
  const isDark = window.matchMedia?.("(prefers-color-scheme: dark)").matches;
  if (isDark) {
    btn.style.color = "#fff";
  }

  btn.addEventListener("mouseenter", () => {
    btn.style.opacity = "1";
  });

  btn.addEventListener("mouseleave", () => {
    btn.style.opacity = "0.7";
  });

  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    e.preventDefault();
    onClick(e);
  });

  return btn;
}

// ─────────────────────────────────────────────────────────────────────────────
// Action Bar Finding
// ─────────────────────────────────────────────────────────────────────────────

function findActionBar(postElement: Element): Element | null {
  // Find container with Like/Reply/Share buttons
  const allDivs = postElement.querySelectorAll('div[role="group"]');
  
  for (const div of Array.from(allDivs)) {
    const svgs = div.querySelectorAll("svg");
    const labels = Array.from(svgs).map((s) => s.getAttribute("aria-label") ?? "");
    
    const hasLike = labels.some((l) => LIKE_LABELS.includes(l));
    const hasReply = labels.some((l) => REPLY_LABELS.includes(l));
    const hasShare = labels.some((l) => SHARE_LABELS.includes(l));
    
    if (hasLike || hasReply || hasShare) {
      return div;
    }
  }

  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Injects a save button into the Threads post action bar.
 */
export function injectThreadsButton(
  postElement: Element,
  onClick: (postElement: Element, button: HTMLButtonElement) => void
): HTMLButtonElement | null {
  // Already has button
  if (postElement.querySelector(BUTTON_SELECTOR)) return null;

  const actionBar = findActionBar(postElement);
  if (!actionBar) return null;

  const handleClick = (e: MouseEvent) => {
    const btn = e.currentTarget as HTMLButtonElement;
    onClick(postElement, btn);
  };

  const btn = createThreadsSaveButton(handleClick);
  actionBar.appendChild(btn);

  return btn;
}

/**
 * Checks if a save button exists in the post element.
 */
export function hasThreadsButton(element: Element): boolean {
  return element.querySelector(BUTTON_SELECTOR) !== null;
}

/**
 * Removes all Magpie buttons from the document.
 */
export function removeThreadsButtons(): void {
  document.querySelectorAll(BUTTON_SELECTOR).forEach((btn) => btn.remove());
}
