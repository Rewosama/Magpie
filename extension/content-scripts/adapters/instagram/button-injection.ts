/**
 * adapters/instagram/button-injection.ts
 * Instagram-specific button injection logic.
 *
 * Handles multiple layouts:
 *  1. Feed (/) → section action bar, after Share button
 *  2. Post modal/dialog → section action bar, after Share button
 *  3. /p/ direct page → section action bar, after Share button
 *  4. /reels/, /reel/ → vertical action bar (before "More")
 */

import {
  BUTTON_ATTR,
  BUTTON_SELECTOR,
  getButtonIcon,
  type ButtonState,
} from "../../../shared/platform";
import {
  LIKE_LABELS,
  COMMENT_LABELS,
  SHARE_LABELS,
  LIKE_SEL,
  SAVE_SEL,
  MORE_SEL,
} from "./selectors";

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const LAYOUT_ATTR = "data-magpie-layout";
const PATH_ATTR = "data-magpie-path";

const DEBUG_INJECT = false;

function dbg(...args: unknown[]): void {
  if (DEBUG_INJECT) console.debug("[Magpie]", ...args);
}

// ─────────────────────────────────────────────────────────────────────────────
// Button Creation
// ─────────────────────────────────────────────────────────────────────────────

export function setButtonState(
  btn: HTMLButtonElement,
  state: ButtonState,
): void {
  btn.innerHTML = getButtonIcon(state);
  btn.disabled = state === "loading";
  btn.setAttribute("data-state", state);
}

function createSaveButton(
  layout: "section" | "vertical",
  onClick: (e: MouseEvent) => void,
): HTMLButtonElement {
  const btn = document.createElement("button");
  btn.setAttribute(BUTTON_ATTR, "true");
  btn.setAttribute(LAYOUT_ATTR, layout);
  btn.setAttribute(PATH_ATTR, window.location.pathname);
  btn.setAttribute("aria-label", "Save to Magpie");
  btn.setAttribute("type", "button");
  btn.style.cssText = [
    "background:none",
    "border:none",
    "cursor:pointer",
    "padding:8px",
    "display:inline-flex",
    "align-items:center",
    "justify-content:center",
    "color:var(--ig-primary-text,#262626)",
    "opacity:0.85",
    "transition:opacity .2s",
    "vertical-align:middle",
    "flex-shrink:0",
    "line-height:0",
  ].join(";");
  btn.innerHTML = getButtonIcon("idle");

  // Prevent event bubbling
  for (const type of ["mouseover", "pointerdown", "mousedown"]) {
    btn.addEventListener(type, (e) => {
      e.stopPropagation();
      e.stopImmediatePropagation();
    });
  }

  btn.addEventListener("mouseenter", (e) => {
    e.stopPropagation();
    e.stopImmediatePropagation();
    btn.style.opacity = "1";
  });

  btn.addEventListener("mouseleave", () => {
    btn.style.opacity = layout === "vertical" ? "0.9" : "0.85";
  });

  btn.addEventListener("click", onClick);

  return btn;
}

// ─────────────────────────────────────────────────────────────────────────────
// Vertical Bar (Reels)
// ─────────────────────────────────────────────────────────────────────────────

interface VerticalSlot {
  bar: HTMLElement;
  moreItem: Element;
  moreSvg: Element;
}

function findVerticalSlot(scope: Element): VerticalSlot | null {
  const moreSvg = scope.querySelector(MORE_SEL);
  const saveSvg = scope.querySelector(SAVE_SEL);
  if (!moreSvg || !saveSvg) return null;

  let bar: Element | null = moreSvg.parentElement;
  while (bar && !bar.contains(saveSvg)) bar = bar.parentElement;
  if (!bar) return null;
  if (bar.querySelector("video")) return null;

  let moreItem: Element = moreSvg;
  while (moreItem.parentElement && moreItem.parentElement !== bar) {
    moreItem = moreItem.parentElement;
  }
  if (moreItem.parentElement !== bar) return null;

  return { bar: bar as HTMLElement, moreItem, moreSvg };
}

function applyVerticalStyle(btn: HTMLButtonElement, refSvg: Element): void {
  let color = "white";
  try {
    const cs = getComputedStyle(refSvg);
    if (cs.fill && cs.fill !== "none") color = cs.fill;
    else if (cs.color) color = cs.color;
  } catch {
    /* default white */
  }
  btn.style.display = "flex";
  btn.style.color = color;
  btn.style.opacity = "0.9";
}

function syncButtonToUrl(btn: HTMLButtonElement): void {
  const path = window.location.pathname;
  if (btn.getAttribute(PATH_ATTR) === path) return;
  btn.setAttribute(PATH_ATTR, path);
  if (btn.getAttribute("data-state") !== "loading") {
    setButtonState(btn, "idle");
  }
}

function injectIntoVerticalBar(
  scope: Element,
  onClick: (e: MouseEvent) => void,
): HTMLButtonElement | null {
  const slot = findVerticalSlot(scope);
  if (!slot) return null;

  let btn = slot.bar.querySelector<HTMLButtonElement>(BUTTON_SELECTOR);
  if (btn) {
    syncButtonToUrl(btn);
    return btn;
  }

  btn = createSaveButton("vertical", onClick);
  applyVerticalStyle(btn, slot.moreSvg);
  slot.bar.style.overflow = "visible";
  slot.bar.insertBefore(btn, slot.moreItem);

  return btn;
}

// ─────────────────────────────────────────────────────────────────────────────
// Horizontal Action Bar
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Checks if element contains a Comment icon.
 */
function hasCommentIcon(el: Element): boolean {
  return COMMENT_LABELS.some((l) => el.querySelector(`svg[aria-label="${l}"]`));
}

/**
 * Finds all horizontal action bars in root and injects buttons.
 * NOT dependent on section / main / media-root:
 *   1. Find 24px Like icon (filters out 12px comment hearts).
 *   2. Walk up to find ancestor with Comment icon = action bar.
 *   3. Place button after Share wrapper (or after Like if no Share).
 * Duplicate injection prevented by BUTTON_SELECTOR check in bar.
 */
function injectIntoActionBar(
  root: ParentNode,
  onClick: (e: MouseEvent) => void,
): HTMLButtonElement | null {
  let injectedBtn: HTMLButtonElement | null = null;

  for (const svg of Array.from(root.querySelectorAll<SVGElement>("svg"))) {
    const lbl = svg.getAttribute("aria-label") ?? "";
    if (!LIKE_LABELS.includes(lbl)) continue;
    if (Number(svg.getAttribute("height") ?? 0) < 20) continue;

    // Walk up to find action bar (ancestor with Comment icon)
    let likeWrap: Element = svg;
    let bar: Element | null = svg.parentElement;
    while (bar && bar !== document.body && !hasCommentIcon(bar)) {
      likeWrap = bar;
      bar = bar.parentElement;
    }
    if (!bar || bar === document.body) {
      dbg("skip: no ancestor with Comment icon");
      continue;
    }

    // Skip vertical bars (reels) - handled separately
    if (bar.querySelector(MORE_SEL) && bar.querySelector(SAVE_SEL)) {
      dbg("skip: vertical bar");
      continue;
    }
    // Skip if walked too far (bar contains video)
    if (bar.querySelector("video")) {
      dbg("skip: bar contains video");
      continue;
    }
    // Already has button
    if (bar.querySelector(BUTTON_SELECTOR)) continue;

    // Find Share wrapper (direct child of bar containing Share icon)
    let shareWrap: Element | null = null;
    const shareSvg = Array.from(bar.querySelectorAll("svg")).find((s) =>
      SHARE_LABELS.includes(s.getAttribute("aria-label") ?? ""),
    );
    if (shareSvg) {
      let el: Element = shareSvg;
      while (el.parentElement && el.parentElement !== bar) {
        el = el.parentElement;
      }
      if (el.parentElement === bar) shareWrap = el;
    }

    dbg("✓ action bar found, injecting button");
    const btn = createSaveButton("section", onClick);

    if (shareWrap) {
      shareWrap.insertAdjacentElement("afterend", btn);
    } else {
      likeWrap.insertAdjacentElement("afterend", btn);
    }

    injectedBtn = btn;
    break; // Only inject one button per call
  }

  return injectedBtn;
}

// ─────────────────────────────────────────────────────────────────────────────
// Action Section Finder (Legacy Fallback)
// ─────────────────────────────────────────────────────────────────────────────

function findActionSection(scope: Element): Element | null {
  const sections = Array.from(scope.querySelectorAll("section"));
  return (
    sections.find(
      (s) => s.querySelector(LIKE_SEL) && s.querySelector(SAVE_SEL),
    ) ??
    sections.find((s) => s.querySelector(LIKE_SEL)) ??
    null
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Injects a save button into the given post element.
 * Returns the button element or null if injection failed.
 */
export function injectInstagramButton(
  postElement: Element,
  onClick: (postElement: Element, button: HTMLButtonElement) => void,
): HTMLButtonElement | null {
  // Create click handler that provides context
  const handleClick = (e: MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const btn = e.currentTarget as HTMLButtonElement;
    onClick(postElement, btn);
  };

  // Try horizontal action bar first
  let btn = injectIntoActionBar(postElement, handleClick);
  if (btn) return btn;

  // Try vertical bar (reels)
  btn = injectIntoVerticalBar(postElement, handleClick);
  if (btn) return btn;

  // Legacy fallbacks
  const actionSection = findActionSection(postElement);
  if (actionSection) {
    const leftGroup = actionSection.querySelector(":scope > div");
    if (leftGroup) {
      btn = createSaveButton("section", handleClick);
      leftGroup.appendChild(btn);
      return btn;
    }
  }

  // Bookmark SVG fallback
  const bookmarkSvg = postElement.querySelector(SAVE_SEL);
  if (bookmarkSvg) {
    const rightGroup =
      bookmarkSvg.closest('[role="button"]')?.parentElement?.parentElement;
    if (rightGroup?.parentElement?.tagName === "SECTION") {
      btn = createSaveButton("section", handleClick);
      rightGroup.insertAdjacentElement("beforebegin", btn);
      return btn;
    }

    const section = bookmarkSvg.closest("section");
    const last = section?.lastElementChild;
    if (section && last) {
      btn = createSaveButton("section", handleClick);
      section.insertBefore(btn, last);
      return btn;
    }
  }

  return null;
}

/**
 * Scans the entire document body for action bars and injects buttons.
 * This catches cases where the action bar is outside any <article> element
 * (e.g. the /p/ direct-page layout, which has no <article>).
 */
export function injectIntoAllActionBars(
  onClick: (postElement: Element, button: HTMLButtonElement) => void,
  resolvePostElement: (button: Element) => Element | null,
): void {
  for (const svg of Array.from(
    document.body.querySelectorAll<SVGElement>("svg"),
  )) {
    const lbl = svg.getAttribute("aria-label") ?? "";
    if (!LIKE_LABELS.includes(lbl)) continue;
    if (Number(svg.getAttribute("height") ?? 0) < 20) continue;

    // Walk up to find action bar
    let likeWrap: Element = svg;
    let bar: Element | null = svg.parentElement;
    while (bar && bar !== document.body && !hasCommentIcon(bar)) {
      likeWrap = bar;
      bar = bar.parentElement;
    }
    if (!bar || bar === document.body) continue;

    // Skip vertical bars
    if (bar.querySelector(MORE_SEL) && bar.querySelector(SAVE_SEL)) continue;
    if (bar.querySelector("video")) continue;
    if (bar.querySelector(BUTTON_SELECTOR)) continue;

    // Find Share wrapper
    let shareWrap: Element | null = null;
    const shareSvg = Array.from(bar.querySelectorAll("svg")).find((s) =>
      SHARE_LABELS.includes(s.getAttribute("aria-label") ?? ""),
    );
    if (shareSvg) {
      let el: Element = shareSvg;
      while (el.parentElement && el.parentElement !== bar) {
        el = el.parentElement;
      }
      if (el.parentElement === bar) shareWrap = el;
    }

    dbg("✓ global scan: action bar found, injecting");
    const btn = createSaveButton("section", (e: MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      const button = e.currentTarget as HTMLButtonElement;
      const postEl = resolvePostElement(button);
      if (postEl) {
        onClick(postEl, button);
      } else {
        dbg("click: could not resolve post element");
      }
    });

    if (shareWrap) {
      shareWrap.insertAdjacentElement("afterend", btn);
    } else {
      likeWrap.insertAdjacentElement("afterend", btn);
    }
  }
}

/**
 * Checks if a save button exists in the element.
 */
export function hasInstagramButton(element: Element): boolean {
  return element.querySelector(BUTTON_SELECTOR) !== null;
}

/**
 * Removes all Magpie buttons from the document.
 */
export function removeInstagramButtons(): void {
  document.querySelectorAll(BUTTON_SELECTOR).forEach((btn) => btn.remove());
}
