/**
 * storage.ts
 * chrome.storage.local üzerinde kaydetme / okuma.
 * Diğer modüllerden bağımsız soyutlama — ileride API katmanına geçilebilir.
 */

import type { SavedInstagramMedia } from "./types";

// ---------------------------------------------------------------------------
// Sabitler
// ---------------------------------------------------------------------------

const ITEM_PREFIX = "instagram:";
const INDEX_KEY = "__magpie_index__";

// ---------------------------------------------------------------------------
// Index yönetimi
// ---------------------------------------------------------------------------

/** Kaydedilmiş tüm shortcode'ların listesini döndürür. */
async function getIndex(): Promise<string[]> {
  const result = await chrome.storage.local.get(INDEX_KEY);
  const index: unknown = result[INDEX_KEY];
  return Array.isArray(index) ? (index as string[]) : [];
}

/** Index'e shortcode ekler (eğer yoksa). */
async function addToIndex(shortcode: string): Promise<void> {
  const index = await getIndex();
  if (!index.includes(shortcode)) {
    await chrome.storage.local.set({ [INDEX_KEY]: [...index, shortcode] });
  }
}

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

/**
 * Bir Instagram media öğesini kaydeder.
 * Aynı shortcode daha önce kaydedilmişse duplicate olarak işaretler.
 *
 * @returns "saved" | "duplicate"
 */
export async function saveItem(
  item: SavedInstagramMedia,
): Promise<"saved" | "duplicate"> {
  const storageKey = `${ITEM_PREFIX}${item.shortcode}`;
  const existing = await chrome.storage.local.get(storageKey);

  if (existing[storageKey]) {
    return "duplicate";
  }

  await chrome.storage.local.set({ [storageKey]: item });
  await addToIndex(item.shortcode);
  return "saved";
}

/**
 * Shortcode'a göre kaydedilmiş öğeyi döndürür.
 * Bulunmazsa null döner.
 */
export async function getItemByShortcode(
  shortcode: string,
): Promise<SavedInstagramMedia | null> {
  const storageKey = `${ITEM_PREFIX}${shortcode}`;
  const result = await chrome.storage.local.get(storageKey);
  const item: unknown = result[storageKey];

  if (!item || typeof item !== "object") return null;
  return item as SavedInstagramMedia;
}

/** Kaydedilen tüm öğeleri döndürür. */
export async function getAllItems(): Promise<SavedInstagramMedia[]> {
  const index = await getIndex();
  if (index.length === 0) return [];

  const keys = index.map((sc) => `${ITEM_PREFIX}${sc}`);
  const result = await chrome.storage.local.get(keys);

  return keys
    .map((k) => result[k])
    .filter((v): v is SavedInstagramMedia => v != null);
}

/**
 * Bir öğeyi siler ve index'ten kaldırır.
 */
export async function removeItem(shortcode: string): Promise<void> {
  const storageKey = `${ITEM_PREFIX}${shortcode}`;
  await chrome.storage.local.remove(storageKey);

  const index = await getIndex();
  const updated = index.filter((sc) => sc !== shortcode);
  await chrome.storage.local.set({ [INDEX_KEY]: updated });
}
