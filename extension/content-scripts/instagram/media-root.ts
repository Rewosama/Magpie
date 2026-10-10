/**
 * media-root.ts
 * Tıklanan butondan en yakın Instagram medya container'ını bulur.
 *
 * Öncelik sırası (en spesifikten en genele):
 *   1. En yakın <article>
 *   2. En yakın [role="dialog"]  (post/reel modal)
 *   3. En yakın [role="presentation"] ve yeterince büyükse
 *   4. En yakın <main> (reel sayfası fallback)
 *
 * <body> veya <html> seviyesine çıkılmaz.
 */

import { findNormalizedLinkInRoot } from "./permalink";

// ---------------------------------------------------------------------------
// Sabitler
// ---------------------------------------------------------------------------

/** Geçerli container olarak kabul edilecek min. yükseklik (px) */
const MIN_CONTAINER_HEIGHT = 100;

/** Yukarı tarama maksimum adım sayısı */
const MAX_WALK_DEPTH = 30;

/**
 * Durma koşulları: bu tag/role'lardan birini bulunca dur.
 * Sıra önemli: daha spesifik olanlar önce gelir.
 */
const STOP_CONDITIONS: ReadonlyArray<(el: Element) => boolean> = [
  (el) => el.tagName === "ARTICLE",
  (el) => el.getAttribute("role") === "dialog",
  (el) => el.tagName === "MAIN" || el.getAttribute("role") === "main",
];

// ---------------------------------------------------------------------------
// Ana fonksiyon
// ---------------------------------------------------------------------------

/**
 * Başlangıç element'inden yukarı çıkarak en yakın medya container'ını bulur.
 * Container'ın içinde geçerli bir permalink bulunması zorunludur.
 *
 * @param startEl  Buton element'i veya içindeki herhangi bir element
 * @returns        Medya container elementi ya da bulunamazsa null
 */
export function findMediaRoot(startEl: Element): Element | null {
  let current: Element | null = startEl;
  let steps = 0;

  while (current && current !== document.documentElement && steps < MAX_WALK_DEPTH) {
    if (isValidMediaRoot(current)) return current;
    current = current.parentElement;
    steps++;
  }

  return null;
}

/**
 * Bir element'in geçerli medya container'ı olup olmadığını kontrol eder.
 * Geçerli olması için:
 *  1. Durdurma koşullarından birini sağlamalı
 *  2. Normalize edilebilir bir permalink içermeli
 *  3. Yeterli görsel boyuta sahip olmalı (MAIN hariç)
 */
function isValidMediaRoot(el: Element): boolean {
  const matchesStop = STOP_CONDITIONS.some((fn) => fn(el));
  if (!matchesStop) return false;

  // MAIN container boyut kontrolü gerektirmez (tam sayfa reel görünümü)
  const isMains = el.tagName === "MAIN" || el.getAttribute("role") === "main";
  if (!isMains) {
    const rect = el.getBoundingClientRect();
    if (rect.height < MIN_CONTAINER_HEIGHT) return false;
  }

  // Permalink bulunabilmeli (yanlış container'ı elemek için)
  return findNormalizedLinkInRoot(el) !== null;
}

/**
 * DOM'da tüm geçerli medya container'larını tarar.
 * MutationObserver ve ilk yükleme taramasında kullanılır.
 */
export function findAllMediaRoots(scope: Element | Document = document): Element[] {
  const roots: Element[] = [];
  const seen = new WeakSet<Element>();

  // Önce article'ları tara
  scope.querySelectorAll<Element>("article").forEach((el) => {
    if (!seen.has(el) && findNormalizedLinkInRoot(el)) {
      roots.push(el);
      seen.add(el);
    }
  });

  // Sonra dialog'ları tara (modal post/reel)
  scope.querySelectorAll<Element>('[role="dialog"]').forEach((el) => {
    if (!seen.has(el) && findNormalizedLinkInRoot(el)) {
      roots.push(el);
      seen.add(el);
    }
  });

  return roots;
}
