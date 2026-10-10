/**
 * button-injector.ts
 * Medya container'larına "Kaydet" butonu ekler.
 *
 * Yerleşimler:
 *   1. Feed (/)               → section içindeki sol action group
 *   2. Post modal / dialog    → section içinde Beğen'in yanı
 *   3. /p/ direct             → section içindeki sol action group
 *   4. /reels/, /reel/ ve reel dialog → DİKEY action bar ("Daha fazla"dan önce)
 *
 * Tıklamada permalink: /p/, /reel/, /reels/ sayfalarında URL'den alınır
 * (Instagram bu sayfalarda URL'yi görünen gönderiye göre günceller);
 * feed'de container içindeki anchor'dan.
 */

import type { ButtonState, SourceContext } from "./types";
import { findAllMediaRoots, findMediaRoot } from "./media-root";
import {
  findNormalizedLinkInRoot,
  normalizeInstagramMediaUrl,
} from "./permalink";
import { extractMetadata, warmUpVideoThumbnail } from "./metadata-extractor";
import { fillMissingFields } from "./page-fallback";
import { detectSourceContext } from "./route-listener";
import type { PostMetadata } from "../../shared/types/domain";
import { openModal, setOnSaveSuccessCallback } from "../modal";
import { showToast } from "../toast";
import { sendMessage } from "../../shared/sendMessage";

// ---------------------------------------------------------------------------
// Sabitler
// ---------------------------------------------------------------------------

const BUTTON_ATTR = "data-magpie-save-button";
const BUTTON_SELECTOR = `[${BUTTON_ATTR}]`;
const LAYOUT_ATTR = "data-magpie-layout"; // "section" | "vertical"
const PATH_ATTR = "data-magpie-path"; // buton hangi URL için hazırlandı
const DEFAULT_COL_KEY = "magpie_default_collection";

/**
 * "before" = Beğen'in soluna, "after" = Beğen'in sağına,
 * "end" = Paylaş butonunun sağına (Beğen, Yorum, Paylaş, [Magpie]).
 */
const INSERT_POSITION: "before" | "after" | "end" = "end";

const SHARE_LABELS = ["Gönderi Paylaş", "Paylaş", "Share", "Share Post"];

/** true yaparsan konsolda [Magpie] debug logları görürsün. */
const DEBUG_INJECT = false;

// Instagram arayüz dili farklıysa buraya etiket ekle.
const LIKE_LABELS = [
  "Beğen",
  "Beğenmekten vazgeç",
  "Beğeniyi geri al",
  "Like",
  "Unlike",
];
const COMMENT_LABELS = ["Yorum Yap", "Comment"];

const LIKE_SEL =
  'svg[aria-label="Beğen"], svg[aria-label="Like"], svg[aria-label="Beğeniyi geri al"], svg[aria-label="Beğenmekten vazgeç"], svg[aria-label="Unlike"]';
// Kaydedilmiş gönderide etiket "Kaldır"/"Remove" olur — hepsi dahil.
const SAVE_SEL =
  'svg[aria-label="Kaydet"], svg[aria-label="Save"], svg[aria-label="Kaldır"], svg[aria-label="Remove"]';
const MORE_SEL = 'svg[aria-label="Daha fazla"], svg[aria-label="More"]';

function dbg(...args: unknown[]): void {
  if (DEBUG_INJECT) console.debug("[Magpie]", ...args);
}

// ---------------------------------------------------------------------------
// Buton oluşturma
// ---------------------------------------------------------------------------

function getButtonIcon(state: ButtonState): string {
  if (state === "loading") {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
      <circle cx="12" cy="12" r="10" opacity=".25"/>
      <path d="M12 2a10 10 0 0 1 10 10" stroke-width="2.5">
        <animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur=".75s" repeatCount="indefinite"/>
      </path></svg>`;
  }
  const dim = state === "saved" || state === "duplicate" ? 'opacity=".5"' : "";
  const color = state === "duplicate" ? "color:#0095f6;" : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="currentColor" aria-hidden="true" style="${color}"><path d="M20 3H4a1 1 0 0 0-1 1v3a1 1 0 0 0 1 1v11a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V8a1 1 0 0 0 1-1V4a1 1 0 0 0-1-1zm-1 15H5V8h14v10zM5 6V5h14v1H5zm7 4H9v2h3v2h2v-2h3v-2h-3V8h-2v2z" ${dim}/></svg>`;
}

function setButtonState(btn: HTMLButtonElement, state: ButtonState): void {
  btn.innerHTML = getButtonIcon(state);
  btn.disabled = state === "loading";
  btn.setAttribute("data-state", state);
}

function flashError(btn: HTMLButtonElement): void {
  setButtonState(btn, "error");
  window.setTimeout(() => {
    if (btn.getAttribute("data-state") === "error") setButtonState(btn, "idle");
  }, 2500);
}

function createSaveButton(layout: "section" | "vertical"): HTMLButtonElement {
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

  btn.addEventListener("click", (e) => {
    handleSaveClick(btn, e).catch((err) => {
      console.warn("[Magpie] Kaydetme hatası:", err);
      flashError(btn);
    });
  });
  return btn;
}

/** Section tabanlı yerleşim için buton üretir ve verilen ekleme fonksiyonuyla yerleştirir. */
function placeSectionButton(insert: (btn: HTMLButtonElement) => void): void {
  insert(createSaveButton("section"));
}

// ---------------------------------------------------------------------------
// Dikey action bar (Reels / Reel sayfası / reel dialog)
// ---------------------------------------------------------------------------

interface VerticalSlot {
  bar: HTMLElement;
  moreItem: Element;
  moreSvg: Element;
}

/** "Kaydet" ve "Daha fazla" ikonlarının ortak atası (= dikey bar) ve More öğesi. */
function findVerticalSlot(scope: Element): VerticalSlot | null {
  const moreSvg = scope.querySelector(MORE_SEL);
  const saveSvg = scope.querySelector(SAVE_SEL);
  if (!moreSvg || !saveSvg) return null;

  let bar: Element | null = moreSvg.parentElement;
  while (bar && !bar.contains(saveSvg)) bar = bar.parentElement;
  if (!bar) return null;
  if (bar.querySelector("video")) return null; // çok yukarı çıkılmış

  let moreItem: Element = moreSvg;
  while (moreItem.parentElement && moreItem.parentElement !== bar) {
    moreItem = moreItem.parentElement;
  }
  if (moreItem.parentElement !== bar) return null;

  return { bar: bar as HTMLElement, moreItem, moreSvg };
}

/**
 * Dikey bar'daki butondan, TEK bir reel'i kapsayan container'ı bulur
 * (tam olarak 1 video içeren en üst ata; <main>'i geçmez).
 * Böylece caption/yazar/video aynı reel'den okunur.
 */
function findReelItemRoot(from: Element): Element | null {
  let best: Element | null = null;
  let el: Element | null = from.parentElement;
  while (el && el !== document.body && el !== document.documentElement) {
    const videos = el.querySelectorAll("video").length;
    if (videos > 1) break;
    if (videos === 1) best = el;
    if (el.tagName === "MAIN") break;
    el = el.parentElement;
  }
  return best;
}

function applyVerticalStyle(btn: HTMLButtonElement, refSvg: Element): void {
  let color = "white";
  try {
    const cs = getComputedStyle(refSvg);
    if (cs.fill && cs.fill !== "none") color = cs.fill;
    else if (cs.color) color = cs.color;
  } catch {
    /* varsayılan beyaz */
  }
  btn.style.display = "flex";
  btn.style.color = color;
  btn.style.opacity = "0.9";
}

/** Instagram aynı DOM elemanını başka reel için yeniden kullanabilir → durumu sıfırla. */
function syncButtonToUrl(btn: HTMLButtonElement): void {
  const path = window.location.pathname;
  if (btn.getAttribute(PATH_ATTR) === path) return;
  btn.setAttribute(PATH_ATTR, path);
  if (btn.getAttribute("data-state") !== "loading") setButtonState(btn, "idle");
}

function injectIntoVerticalBar(scope: Element): boolean {
  const slot = findVerticalSlot(scope);
  if (!slot) return false;

  let btn = slot.bar.querySelector<HTMLButtonElement>(BUTTON_SELECTOR);
  if (btn) {
    syncButtonToUrl(btn);
  } else {
    btn = createSaveButton("vertical");
    applyVerticalStyle(btn, slot.moreSvg);
    slot.bar.style.overflow = "visible";
    slot.bar.insertBefore(btn, slot.moreItem);
  }

  // Tıklamada kullanılacak root ile AYNI element için video karesini hazırla
  const itemRoot = findReelItemRoot(btn);
  if (itemRoot) warmUpVideoThumbnail(itemRoot).catch(() => {});
  return true;
}

// ---------------------------------------------------------------------------
// Injection konumu (feed / modal)
// ---------------------------------------------------------------------------

/**
 * Gönderinin ASIL action bar'ını bulur: hem "Beğen" hem "Kaydet/Kaldır" ikonunu
 * içeren section. (Yorumlardaki küçük "Beğen" kalpleri section içinde değildir ve
 * DOM'da action bar'dan ÖNCE geldiği için "ilk Beğen svg'si" yaklaşımı yanlış sonuç verir.)
 */
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

// ---------------------------------------------------------------------------
// Sağlam action-bar enjeksiyonu (feed, dialog, modal, /p/, reel sayfası)
// ---------------------------------------------------------------------------

/**
 * Verilen kapsamdaki TÜM yatay aksiyon çubuklarını bulur ve butonu ekler.
 * section / main / media-root'a bağımlı DEĞİLDİR:
 *   1. 24px'lik Beğen ikonunu bul (yorumlardaki 12px kalpler elenir).
 *   2. Yukarı çık; hem Beğen hem Yorum ikonunu içeren ilk ata = aksiyon çubuğu.
 *   3. Butonu, Beğen kapsayıcısının (barın doğrudan çocuğu) yanına ekle.
 * Çift ekleme, bar içindeki BUTTON_SELECTOR kontrolüyle engellenir.
 */
function injectIntoActionBar(root: ParentNode): boolean {
  let injected = false;

  const hasComment = (el: Element): boolean =>
    COMMENT_LABELS.some((l) => el.querySelector(`svg[aria-label="${l}"]`));

  root.querySelectorAll<SVGElement>("svg").forEach((svg) => {
    const lbl = svg.getAttribute("aria-label") ?? "";
    if (!LIKE_LABELS.includes(lbl)) return;
    if (Number(svg.getAttribute("height") ?? 0) < 20) return;

    let likeWrap: Element = svg;
    let bar: Element | null = svg.parentElement;
    while (bar && bar !== document.body && !hasComment(bar)) {
      likeWrap = bar;
      bar = bar.parentElement;
    }
    if (!bar || bar === document.body) {
      dbg("skip: yorum ikonlu ata bulunamadı");
      return;
    }

    // Dikey bar (reels) ayrı yolla ekleniyor; video içeren çok geniş atayı da atla
    if (bar.querySelector(MORE_SEL) && bar.querySelector(SAVE_SEL)) {
      dbg("skip: dikey bar, injectIntoVerticalBar halledecek");
      return;
    }
    if (bar.querySelector("video")) {
      dbg("skip: bar video içeriyor (çok geniş ata)");
      return;
    }
    if (bar.querySelector(BUTTON_SELECTOR)) return; // zaten ekli

    // Paylaş butonunun bardaki doğrudan çocuk kapsayıcısını bul
    let shareWrap: Element | null = null;
    if (INSERT_POSITION === "end") {
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
      if (!shareWrap) dbg("Paylaş ikonu bulunamadı, Beğen'in sağına eklenecek");
    }

    dbg("✓ aksiyon çubuğu bulundu, buton ekleniyor:", INSERT_POSITION);
    placeSectionButton((btn) => {
      if (shareWrap) {
        shareWrap.insertAdjacentElement("afterend", btn);
      } else {
        likeWrap.insertAdjacentElement(
          INSERT_POSITION === "before" ? "beforebegin" : "afterend",
          btn,
        );
      }
    });
    injected = true;
  });

  if (!injected) dbg("injectIntoActionBar: yeni buton eklenmedi");
  return injected;
}

function injectButtonIntoRoot(root: Element): void {
  if (root.querySelector(BUTTON_SELECTOR)) return;

  // Birincil: Beğen + Yorum ikonlu yatay bar
  if (injectIntoActionBar(root)) return;

  // Dikey bar (feed/dialog içindeki reel'ler)
  if (injectIntoVerticalBar(root)) return;

  // Eski fallback'ler (güvenlik için duruyor)
  const context = detectSourceContext();
  if (context === "feed") {
    const actionSection = findActionSection(root);
    const leftGroup = actionSection?.querySelector(":scope > div");
    if (leftGroup) {
      placeSectionButton((b) => leftGroup.appendChild(b));
      return;
    }
  }
  const bookmarkSvg = root.querySelector(SAVE_SEL);
  if (bookmarkSvg) {
    const rightGroup =
      bookmarkSvg.closest('[role="button"]')?.parentElement?.parentElement;
    if (rightGroup?.parentElement?.tagName === "SECTION") {
      placeSectionButton((b) =>
        rightGroup.insertAdjacentElement("beforebegin", b),
      );
      return;
    }
    const section = bookmarkSvg.closest("section");
    const last = section?.lastElementChild;
    if (section && last) {
      placeSectionButton((b) => section.insertBefore(b, last));
      return;
    }
  }
}

// ---------------------------------------------------------------------------
// Metadata → PostMetadata dönüşümü
// ---------------------------------------------------------------------------

function buildPostMetadata(
  canonicalUrl: string,
  extracted: ReturnType<typeof extractMetadata>,
): Partial<PostMetadata> {
  const media_urls: string[] = [];
  if (extracted.thumbnailUrl) media_urls.push(extracted.thumbnailUrl);
  if (extracted.mediaUrl && extracted.mediaUrl !== extracted.thumbnailUrl) {
    media_urls.push(extracted.mediaUrl);
  }

  const path = new URL(canonicalUrl).pathname;
  const postType: PostMetadata["post_type"] =
    path.includes("/reel/") || path.includes("/reels/") || path.includes("/tv/")
      ? "reel"
      : "post";

  return {
    post_url: canonicalUrl,
    post_type: postType,
    platform: "instagram",
    author_username: extracted.authorUsername ?? null,
    author_display_name: null,
    author_avatar_url: null,
    content_text: extracted.caption ?? null,
    media_urls,
    post_timestamp: extracted.publishedAt ?? null,
    raw_metadata: {
      page_url: window.location.href,
      extracted_at: new Date().toISOString(),
    },
  };
}

// ---------------------------------------------------------------------------
// Default collection akışı
// ---------------------------------------------------------------------------

interface DefaultCollection {
  id: string;
  name: string;
}

async function getDefaultCollection(): Promise<DefaultCollection | undefined> {
  try {
    const stored = await chrome.storage.local.get(DEFAULT_COL_KEY);
    return stored[DEFAULT_COL_KEY] as DefaultCollection | undefined;
  } catch {
    return undefined;
  }
}

async function resolveDefaultFromServer(): Promise<
  DefaultCollection | undefined
> {
  return new Promise((resolve) => {
    if (!chrome.runtime?.id) {
      resolve(undefined);
      return;
    }
    chrome.runtime.sendMessage(
      { type: "GET_COLLECTIONS" },
      (response: { success: boolean; data?: unknown }) => {
        if (chrome.runtime.lastError || !response?.success) {
          resolve(undefined);
          return;
        }
        const d = response.data as {
          collections?: Array<{
            id: string;
            name: string;
            is_default?: boolean;
          }>;
        };
        const cols = Array.isArray(d?.collections) ? d.collections : [];
        if (cols.length === 0) {
          resolve(undefined);
          return;
        }
        const chosen = cols.find((c) => c.is_default) ?? cols[0];
        chrome.storage.local
          .set({ [DEFAULT_COL_KEY]: { id: chosen.id, name: chosen.name } })
          .catch(() => {});
        resolve({ id: chosen.id, name: chosen.name });
      },
    );
  });
}

/** Başarılıysa true, başarısızsa false. */
async function saveDirectToCollection(
  metadata: Partial<PostMetadata>,
  col: DefaultCollection,
  postEl: Element,
): Promise<boolean> {
  if (!metadata.post_url) return false;
  try {
    const response = (await sendMessage<{
      success: boolean;
      error?: string;
      data?: { status?: string } | null;
    }>({
      type: "SAVE_POST",
      payload: {
        post_url: metadata.post_url,
        collection_id: col.id,
        post_type: metadata.post_type ?? "post",
        platform: metadata.platform ?? "instagram",
        author_username: metadata.author_username ?? null,
        author_display_name: metadata.author_display_name ?? null,
        author_avatar_url: metadata.author_avatar_url ?? null,
        content_text: metadata.content_text ?? null,
        media_urls: metadata.media_urls ?? null,
        post_timestamp: metadata.post_timestamp ?? null,
        raw_metadata: metadata.raw_metadata ?? null,
      },
    })) as { success: boolean; error?: string };

    if (response?.success) {
      showToast({
        message: `Saved to ${col.name} \u2713`,
        platform: "instagram",
        onChangeCollection: () =>
          void openCollectionPickerFlow(postEl, metadata, true),
      });
      return true;
    }
    await chrome.storage.local.remove(DEFAULT_COL_KEY).catch(() => {});
    showToast({
      message: "Kaydetme başarısız — koleksiyon seçin.",
      platform: "instagram",
    });
    return false;
  } catch {
    showToast({
      message: "Kaydetme başarısız. Tekrar deneyin.",
      platform: "instagram",
    });
    return false;
  }
}

async function openCollectionPickerFlow(
  postEl: Element,
  metadata: Partial<PostMetadata>,
  isUpdate = false,
): Promise<void> {
  setOnSaveSuccessCallback(
    (collectionId: string, collectionName: string | null) => {
      // isUpdate=true → "Değiştir" toast'ından tek seferlik override.
      // Varsayılan yalnızca ilk koleksiyon seçiminde kalıcı yazılır.
      if (!isUpdate) {
        chrome.storage.local
          .set({
            [DEFAULT_COL_KEY]: {
              id: collectionId,
              name: collectionName ?? "Magpie",
            },
          })
          .catch(() => {});
        chrome.runtime
          .sendMessage({
            type: "SET_DEFAULT_COLLECTION",
            payload: { collection_id: collectionId },
          })
          .catch(() => {});
      }
      showToast({
        message: isUpdate
          ? "Collection updated ✓"
          : `Saved to ${collectionName ?? "Magpie"} ✓`,
        platform: "instagram",
        onChangeCollection: () =>
          void openCollectionPickerFlow(postEl, metadata, true),
      });
    },
  );
  openModal(metadata);
}

// ---------------------------------------------------------------------------
// Root + permalink çözümleme
// ---------------------------------------------------------------------------

function resolveRootAndLink(btn: HTMLButtonElement) {
  const ctx = detectSourceContext();
  const vertical = btn.getAttribute(LAYOUT_ATTR) === "vertical";

  // Root
  let root: Element | null = vertical
    ? findReelItemRoot(btn)
    : findMediaRoot(btn);
  if (!root) root = findReelItemRoot(btn);
  if (!root) root = btn.closest("article, [role='dialog'], main");
  if (!root) return null;

  // Link: tekil sayfalarda URL en güvenilir kaynak (root içinde başka gönderilerin
  // linkleri olabilir; /reels/'te hiç permalink anchor'u olmayabilir).
  const fromUrl =
    ctx === "post-page" || ctx === "reel-page"
      ? normalizeInstagramMediaUrl(window.location.href)
      : null;
  const link = fromUrl ?? findNormalizedLinkInRoot(root);
  return link ? { root, link } : null;
}

// ---------------------------------------------------------------------------
// Ana tıklama handler
// ---------------------------------------------------------------------------

async function handleSaveClick(
  btn: HTMLButtonElement,
  event: MouseEvent,
): Promise<void> {
  event.stopPropagation();
  event.preventDefault();

  if (typeof chrome === "undefined" || !chrome.runtime?.id) {
    showToast({
      message: "Magpie yenilenmesi gerekiyor — F5 basın.",
      platform: "instagram",
    });
    flashError(btn);
    return;
  }

  const resolved = resolveRootAndLink(btn);
  if (!resolved) {
    console.warn("[Magpie] Medya container veya post URL'si bulunamadı.");
    showToast({ message: "Post URL'si bulunamadı.", platform: "instagram" });
    flashError(btn);
    return;
  }
  const { root, link } = resolved;

  setButtonState(btn, "loading");

  const context: SourceContext = detectSourceContext();
  const domMetadata = extractMetadata(root, link);
  const metadata = fillMissingFields(domMetadata, context);
  const postMeta = buildPostMetadata(link.canonicalUrl, metadata);

  let defaultCol = await getDefaultCollection();
  if (!defaultCol) {
    defaultCol = await resolveDefaultFromServer();
  }

  if (defaultCol) {
    const ok = await saveDirectToCollection(postMeta, defaultCol, root);
    if (ok) setButtonState(btn, "saved");
    else {
      // Edge function'dan 200 = zaten var (aynı canonical_url)
      setButtonState(btn, "duplicate");
    }
  } else {
    setButtonState(btn, "idle");
    await openCollectionPickerFlow(root, postMeta, false);
  }
}

// ---------------------------------------------------------------------------
// Sayfa türüne özel enjeksiyonlar
// ---------------------------------------------------------------------------

/** /reels/ ve /reel/<kod>/ — en görünür video'nun reel'ini bulur, dikey bar'a ekler. */
function injectForReelsPage(): void {
  const vh = window.innerHeight;
  const visibleHeight = (el: Element): number => {
    const r = el.getBoundingClientRect();
    return Math.max(0, Math.min(r.bottom, vh) - Math.max(r.top, 0));
  };
  const videos = Array.from(
    document.querySelectorAll<HTMLVideoElement>("video"),
  ).sort((a, b) => visibleHeight(b) - visibleHeight(a));
  if (videos.length === 0) return;

  let reelScope: Element | null = videos[0];
  while (reelScope && reelScope !== document.documentElement) {
    if (reelScope.querySelector(SAVE_SEL) && reelScope.querySelector(MORE_SEL))
      break;
    reelScope = reelScope.parentElement;
  }
  if (!reelScope || reelScope === document.documentElement) return;

  if (!injectIntoVerticalBar(reelScope)) {
    dbg("injectForReelsPage: dikey bar yok, yatay bar deneniyor");
    injectIntoActionBar(reelScope);
  }
}

/** /p/ doğrudan sayfa (article/dialog bulunamadığında). */
function injectForDirectPage(): void {
  const main = document.body;
  if (main.querySelector(BUTTON_SELECTOR)) return;

  if (injectIntoActionBar(main)) {
    if (main.querySelector("video")) warmUpVideoThumbnail(main).catch(() => {});
    return;
  }
  if (injectIntoVerticalBar(main)) return;

  const actionSection = findActionSection(main);
  const leftGroup = actionSection?.querySelector(":scope > div");
  if (leftGroup) {
    placeSectionButton((b) => leftGroup.appendChild(b));
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function injectButtonsInScope(
  scope: Element | Document = document,
): void {
  const context = detectSourceContext();

  // 1) Roots/main'e bağımlı olmayan, doküman geneli yatay bar taraması.
  //    Zaten butonu olan barlar atlanır, bu yüzden her çağrıda güvenle çalışır.
  injectIntoActionBar(document.body);

  if (context === "reel-page") {
    injectForReelsPage();
    return;
  }

  const roots = findAllMediaRoots(scope);

  if (roots.length === 0 && context === "post-page") {
    injectForDirectPage();
    return;
  }

  for (const root of roots) {
    if (root.querySelector(BUTTON_SELECTOR)) continue;

    injectButtonIntoRoot(root);

    if (root.querySelector("video")) {
      warmUpVideoThumbnail(root).catch(() => {});
    }
  }
}

export function removeStaleButtons(): void {
  document.querySelectorAll(BUTTON_SELECTOR).forEach((btn) => btn.remove());
}
