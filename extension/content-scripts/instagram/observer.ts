/**
 * observer.ts
 * MutationObserver ile dinamik içerik eklendiğinde buton injection tetikler.
 * Debounce ile çok sık tetiklenmesi önlenir.
 */

import { injectButtonsInScope } from "./button-injector";

// ---------------------------------------------------------------------------
// Sabitler
// ---------------------------------------------------------------------------

const DEBOUNCE_MS = 150;

/**
 * Extension'ın eklediği attribute'lardan gelen mutation'ları filtrele.
 * Bu sayede kendi buton eklememiz döngüye yol açmaz.
 */
const IGNORE_ATTRS = new Set(["data-magpie-save-button", "data-state"]);

// ---------------------------------------------------------------------------
// Debounce
// ---------------------------------------------------------------------------

function debounce<A extends unknown[]>(
  fn: (...args: A) => void,
  ms: number,
): (...args: A) => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return (...args: A) => {
    if (timer !== null) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      fn(...args);
    }, ms);
  };
}

// ---------------------------------------------------------------------------
// Tarama mantığı
// ---------------------------------------------------------------------------

/**
 * Mutation listesini işler.
 * Yalnızca anlamlı (eklenen node içeren veya class değiştiren) mutasyonlara tepki verir.
 */
function processMutations(mutations: MutationRecord[]): void {
  let hasRelevantChange = false;

  for (const mutation of mutations) {
    // Extension'ın kendi attribute değişikliklerini atla
    if (
      mutation.type === "attributes" &&
      IGNORE_ATTRS.has(mutation.attributeName ?? "")
    ) {
      continue;
    }

    if (mutation.addedNodes.length > 0) {
      hasRelevantChange = true;
      break;
    }
  }

  if (!hasRelevantChange) return;

  try {
    injectButtonsInScope(document);
  } catch (err) {
    console.warn("[Magpie] Observer injection hatası:", err);
  }
}

const debouncedProcess = debounce(processMutations, DEBOUNCE_MS);

// ---------------------------------------------------------------------------
// Kurulum
// ---------------------------------------------------------------------------

let observer: MutationObserver | null = null;

/**
 * MutationObserver'ı başlatır.
 * Birden fazla kez çağrılsa da yalnızca bir observer kurulur.
 */
export function startObserver(): void {
  if (observer !== null) return;

  observer = new MutationObserver((mutations) => {
    // Extension context geçersizleştiyse observer'ı durdur
    if (typeof chrome === "undefined" || !chrome.runtime?.id) {
      observer?.disconnect();
      observer = null;
      return;
    }
    debouncedProcess(mutations);
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
  });
}

/** Observer'ı durdurur (test veya cleanup için). */
export function stopObserver(): void {
  observer?.disconnect();
  observer = null;
}
