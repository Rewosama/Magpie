/**
 * metadata-extractor.ts
 * Media root container'ından metadata çıkarır. Yalnızca render edilmiş DOM üzerinde çalışır.
 *
 * Önemli kurallar:
 *  - Caption: önce DOM (h1 → feed span → reels div), og:* yalnızca sayfa bu gönderiye aitse (SPA'da meta bayat kalır).
 *  - root TEK bir gönderinin kapsayıcısı olmalı (reels görüntüleyicide görünen video'nun kapsayıcısı).
 *  - Frame cache DOM elemanına değil, video kaynağına (blob URL) göre doğrulanır; Instagram elemanları geri dönüştürür.
 */

import type { ExtractedMetadata, NormalizedMediaLink } from "./types";

// ---------------------------------------------------------------------------
// Sabitler / yardımcılar
// ---------------------------------------------------------------------------

/** Kullanıcı adı olmayan rezerve Instagram path segment'leri. */
const RESERVED = new Set([
  "p",
  "reel",
  "reels",
  "tv",
  "explore",
  "stories",
  "direct",
  "accounts",
  "tags",
  "locations",
]);

/** /reels/ görüntüleyicide yazar linki /username/reels/ biçimindedir. */
const REELS_USER_RE = /^\/([^/]+)\/reels\/$/;

const MIN_IMG_PX = 200;

const sleep = (ms: number): Promise<void> =>
  new Promise((r) => setTimeout(r, ms));

/** Tek bir alan hata verirse tüm metadata kaybolmasın. */
function safe<T>(fn: () => T, fallback: T): T {
  try {
    return fn();
  } catch (err) {
    console.warn("[Magpie] Alan çıkarılamadı:", err);
    return fallback;
  }
}

function meta(property: string): string | null {
  return (
    document
      .querySelector<HTMLMetaElement>(`meta[property="${property}"]`)
      ?.content?.trim() || null
  );
}

function shortcodeFromPath(path: string): string | null {
  return path.match(/\/(?:p|reel|reels|tv)\/([\w-]{8,15})/)?.[1] ?? null;
}

/**
 * og:* ve JSON-LD yalnızca TAM sayfa yüklemesinde taze olur. SPA geçişinde (reels'te kaydırma,
 * modal açma) bir önceki gönderinin verisi kalır. Bu yüzden: URL'deki kod, çıkarılan link'te
 * geçmeli ve og:url (varsa) aynı kodu içermeli.
 */
function metaIsForLink(link: NormalizedMediaLink): boolean {
  const code = shortcodeFromPath(location.pathname);
  if (!code) return false;
  const inLink = Object.values(link as unknown as Record<string, unknown>).some(
    (v) => typeof v === "string" && v.includes(code),
  );
  if (!inLink) return false;
  const ogUrl = meta("og:url");
  return !ogUrl || ogUrl.includes(code);
}

/**
 * og:description / og:title içinden caption'ı çıkarır.
 * Format: 'N likes, N comments - user on date: "caption".'
 */
function parseCaptionFromOg(desc: string): string | undefined {
  const quoted = desc.match(
    /:\s*[\u201c\u201d"]([\s\S]+)[\u201c\u201d"]\s*\.?\s*$/,
  );
  if (quoted?.[1]) return quoted[1].trim();
  // Uzun caption'larda açıklama kesilir ve kapanış tırnağı olmaz
  const idx = desc.indexOf(": ");
  if (idx > 0 && idx < 150) {
    const rest = desc
      .substring(idx + 2)
      .trim()
      .replace(/^[\u201c\u201d"]/, "");
    if (rest) return rest;
  }
  return undefined;
}

/** <br> → \n, "devamını gör" butonlarını at, satır yapısını koru. */
function cleanText(el: Element): string | undefined {
  const clone = el.cloneNode(true) as HTMLElement;
  clone.querySelectorAll("[role='button']").forEach((b) => b.remove());
  clone.querySelectorAll("br").forEach((br) => br.replaceWith("\n"));
  const text = (clone.textContent ?? "")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .trim();
  return text || undefined;
}

// ---------------------------------------------------------------------------
// Author
// ---------------------------------------------------------------------------

interface AuthorInfo {
  authorUsername?: string;
  authorUrl?: string;
}

/**
 * Kaynaklar (sırayla):
 *  1. header a[href="/username/"]        — gönderi sayfası
 *  2. a[href="/username/reels/"]         — reels görüntüleyici
 *  3. a[href="#"] + SVG + kısa metin     — collab / etiketli kullanıcı
 *  4. h2 ve genel fallback
 */
function extractAuthor(root: Element): AuthorInfo {
  const names: string[] = [];

  const push = (slug: string | null | undefined): void => {
    if (!slug || RESERVED.has(slug) || slug.length > 50 || names.includes(slug))
      return;
    names.push(slug);
  };
  const profileSlug = (a: Element): string | undefined =>
    a.getAttribute("href")?.match(/^\/([^/]+)\/$/)?.[1];

  root
    .querySelectorAll("header a[href^='/']")
    .forEach((a) => push(profileSlug(a)));
  root
    .querySelectorAll("a[href]")
    .forEach((a) => push(a.getAttribute("href")?.match(REELS_USER_RE)?.[1]));
  root.querySelectorAll('a[href="#"]').forEach((a) => {
    const t = a.textContent?.trim() ?? "";
    if (a.querySelector("svg") && /^[\w.]{1,30}$/.test(t)) push(t);
  });

  if (!names.length)
    root
      .querySelectorAll("h2 a[href^='/']")
      .forEach((a) => push(profileSlug(a)));

  if (!names.length) {
    for (const a of Array.from(root.querySelectorAll("a[href^='/']"))) {
      push(profileSlug(a));
      if (names.length > 0) break;
    }
  }

  if (!names.length) return {};
  return {
    authorUsername: names[0],
    authorUrl: `https://www.instagram.com/${names[0]}/`,
  };
}

// ---------------------------------------------------------------------------
// Images
// ---------------------------------------------------------------------------

/**
 * İçerik görselleri (profil resimleri hariç).
 * Genişlik bilinmeyen (0) ya da ≤ 200px olanlar atılır: avatar, ikon, yüklenmemiş lazy-load.
 */
function extractImages(root: Element): string[] {
  const seen = new Set<string>();
  const results: string[] = [];

  for (const img of Array.from(
    root.querySelectorAll<HTMLImageElement>("img"),
  )) {
    if (/profil|profile/i.test(img.alt) || img.closest("header") !== null)
      continue;

    const w =
      img.getBoundingClientRect().width || img.naturalWidth || img.width;
    if (w <= MIN_IMG_PX) continue;

    const src = img.currentSrc || img.src;
    if (!src || src.startsWith("data:") || seen.has(src)) continue;
    seen.add(src);
    results.push(src);
  }
  return results;
}

// ---------------------------------------------------------------------------
// Video + frame cache
// ---------------------------------------------------------------------------

interface CachedFrame {
  /** Yakalandığı video kaynağı (blob URL her video için benzersiz) */
  src: string;
  frame: string;
}

const frameCache = new WeakMap<Element, CachedFrame>();
const inFlight = new WeakSet<Element>();

const videoKey = (v: HTMLVideoElement): string => v.currentSrc || v.src || "";

function getCachedFrame(
  root: Element,
  video: HTMLVideoElement,
): string | undefined {
  const hit = frameCache.get(root);
  // Eleman başka bir gönderiye dönüştüyse kaynak değişmiştir → cache geçersiz
  return hit && hit.src === videoKey(video) ? hit.frame : undefined;
}

function captureFrame(video: HTMLVideoElement): string | null {
  if (video.readyState < 2 || !video.videoWidth) return null;
  const scale = Math.min(1, 480 / video.videoWidth);
  const c = document.createElement("canvas");
  c.width = Math.round(video.videoWidth * scale);
  c.height = Math.round(video.videoHeight * scale);
  try {
    c.getContext("2d")?.drawImage(video, 0, 0, c.width, c.height);
    return c.toDataURL("image/jpeg", 0.8);
  } catch {
    return null; // canvas tainted
  }
}

/** Öncelik: cache (kaynak doğrulamalı) → poster → anlık kare. */
function extractVideo(root: Element): {
  thumbnailUrl?: string;
  mediaUrl?: string;
} {
  const video = root.querySelector<HTMLVideoElement>("video");
  if (!video) return {};

  const src = video.currentSrc || video.src || undefined;
  const mediaUrl = src && !src.startsWith("blob:") ? src : undefined;

  const cached = getCachedFrame(root, video);
  if (cached) return { thumbnailUrl: cached, mediaUrl };

  const poster = video.getAttribute("poster") || undefined;
  if (poster) return { thumbnailUrl: poster, mediaUrl };

  return { thumbnailUrl: captureFrame(video) ?? undefined, mediaUrl };
}

/**
 * Video olan gönderinin ilk karesini arka planda hazırlar (max 12 sn, 250 ms aralıkla).
 * Aynı root için tek döngü çalışır; eleman DOM'dan çıkarsa ya da video değişirse durur.
 */
export async function warmUpVideoThumbnail(root: Element): Promise<void> {
  if (inFlight.has(root)) return;
  inFlight.add(root);
  try {
    const deadline = Date.now() + 12_000;
    while (Date.now() < deadline && root.isConnected) {
      const video = root.querySelector<HTMLVideoElement>("video");
      if (!video) return;
      const key = videoKey(video);
      if (key) {
        if (getCachedFrame(root, video)) return;
        const frame = captureFrame(video);
        if (frame) {
          frameCache.set(root, { src: key, frame });
          return;
        }
      }
      await sleep(250);
    }
  } finally {
    inFlight.delete(root);
  }
}

// ---------------------------------------------------------------------------
// Caption
// ---------------------------------------------------------------------------

function extractCaption(
  root: Element,
  link: NormalizedMediaLink,
  authorUsername?: string,
): string | undefined {
  // 1. <h1>: gönderi/reel detay sayfası. root'un MAIN/dialog/ARTICLE olması fark etmez.
  const h1 = root.querySelector("h1[dir='auto']") ?? root.querySelector("h1");
  if (h1) {
    const t = cleanText(h1);
    if (t) return t;
  }

  // 2. Feed: div[style*="display:inline"] > span[dir="auto"]
  const inlineSpan = root.querySelector(
    'div[style*="display:inline"] > span[dir="auto"], div[style*="display: inline"] > span[dir="auto"]',
  );
  if (inlineSpan) {
    const t = cleanText(inlineSpan);
    if (t) return t;
  }

  // 3. Reels görüntüleyici (yalnızca /reels/ akışı): caption div[dir="auto"]
  // Direkt sayfa yüklemesinde (/p/ veya /reel/ URL) bu adım atlanır; og:meta tazedir ve step 4'te kullanılır.
  const onDirectPage = !!shortcodeFromPath(location.pathname);
  if (root.tagName !== "ARTICLE" && !onDirectPage) {
    const best = Array.from(
      root.querySelectorAll<HTMLElement>("div[dir='auto']"),
    )
      .map((d) => ({ d, len: (d.textContent ?? "").trim().length }))
      .filter((x) => x.len > 0)
      .sort((a, b) => b.len - a.len)[0];
    if (best) {
      const t = cleanText(best.d);
      if (t) return t;
    }
  }

  // 4. og:description / og:title: sadece sayfa bu gönderiye aitse (SPA'da bayat olabilir)
  if (metaIsForLink(link)) {
    const fromDesc = parseCaptionFromOg(meta("og:description") ?? "");
    if (fromDesc) return fromDesc;
    const fromTitle = parseCaptionFromOg(meta("og:title") ?? "");
    if (fromTitle) return fromTitle;
  }

  // 5. Son çare yalnızca feed'de. Gönderi sayfasında span'lar yorumlardır ("Roll"), caption yoksa boş dön.
  if (shortcodeFromPath(location.pathname)) return undefined;

  const candidates = Array.from(
    root.querySelectorAll<HTMLSpanElement>("span[dir]"),
  )
    .filter((s) => {
      if (s.querySelector("a, time, svg")) return false;
      const text = s.textContent?.trim();
      if (!text || text.length < 2) return false;
      if (authorUsername && text === authorUsername) return false;
      if (/^[•·\s]+$/.test(text)) return false;
      if (/^[\d.,]+\s?[a-zA-ZÂ-ÿ]{0,3}$/.test(text)) return false;
      return true;
    })
    .map((s) => (s.textContent ?? "").trim());

  candidates.sort((a, b) => b.length - a.length);
  return candidates[0];
}

// ---------------------------------------------------------------------------
// Tarih
// ---------------------------------------------------------------------------

function getJsonLdDate(): string | undefined {
  for (const sc of Array.from(
    document.querySelectorAll<HTMLScriptElement>(
      'script[type="application/ld+json"]',
    ),
  )) {
    try {
      const parsed: unknown = JSON.parse(sc.textContent ?? "");
      for (const item of Array.isArray(parsed) ? parsed : [parsed]) {
        if (typeof item !== "object" || !item) continue;
        const obj = item as Record<string, unknown>;
        const d =
          obj["uploadDate"] ?? obj["datePublished"] ?? obj["dateCreated"];
        if (typeof d === "string") return new Date(d).toISOString();
      }
    } catch {
      /* geçersiz JSON / geçersiz tarih */
    }
  }
  return undefined;
}

/**
 * Sıra: caption satırındaki time → yorum listesi (ul) dışındaki ilk time → herhangi time → JSON-LD (taze ise).
 * Yorum listesi dışlanır: caption'sız gönderide yorumun tarihi alınmasın.
 */
function extractPublishedAt(
  root: Element,
  link: NormalizedMediaLink,
): string | undefined {
  const times = Array.from(
    root.querySelectorAll<HTMLTimeElement>("time[datetime]"),
  );
  const captionTime = root
    .querySelector("h1")
    ?.closest("li")
    ?.querySelector<HTMLTimeElement>("time[datetime]");
  const own = captionTime ?? times.find((t) => !t.closest("ul")) ?? times[0];
  const dt = own?.getAttribute("datetime");
  if (dt) return dt;
  return metaIsForLink(link) ? getJsonLdDate() : undefined;
}

// ---------------------------------------------------------------------------
// Ana fonksiyon
// ---------------------------------------------------------------------------

export function extractMetadata(
  root: Element,
  link: NormalizedMediaLink,
): ExtractedMetadata {
  const { authorUsername, authorUrl } = safe<AuthorInfo>(
    () => extractAuthor(root),
    {},
  );
  const video = safe(
    () => extractVideo(root),
    {} as { thumbnailUrl?: string; mediaUrl?: string },
  );
  const images = safe(() => extractImages(root), [] as string[]);
  const caption = safe(
    () => extractCaption(root, link, authorUsername),
    undefined,
  );
  const publishedAt = safe(() => extractPublishedAt(root, link), undefined);

  return {
    authorUsername,
    authorUrl,
    caption,
    thumbnailUrl: video.thumbnailUrl ?? images[0],
    mediaUrl: video.mediaUrl,
    publishedAt,
  };
}
