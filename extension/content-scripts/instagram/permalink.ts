/**
 * permalink.ts
 * Instagram URL'lerini normalize eder ve canonical biçime çevirir.
 * DOM scraping veya ağ isteği yapmaz; yalnızca URL string'i işler.
 */

import type { MediaType, NormalizedMediaLink } from "./types";

// ---------------------------------------------------------------------------
// Sabitler
// ---------------------------------------------------------------------------

const INSTAGRAM_ORIGIN = "https://www.instagram.com";

/**
 * Instagram canonical path türleri ve karşılık gelen MediaType değerleri.
 * Sıra önemli: "reels" → "reel" dönüşümü için önce "reels" dene.
 */
const PATH_PATTERNS: ReadonlyArray<{
  segment: string;
  canonical: string;
  mediaType: MediaType;
}> = [
  { segment: "reel",  canonical: "reel",  mediaType: "reel"  },
  { segment: "reels", canonical: "reel",  mediaType: "reel"  }, // normalize
  { segment: "p",     canonical: "p",     mediaType: "post"  },
  { segment: "tv",    canonical: "tv",    mediaType: "igtv"  },
];

/** Shortcode için geçerli karakter kümesi (A-Z a-z 0-9 _ -) */
const SHORTCODE_RE = /^[\w-]+$/;

// ---------------------------------------------------------------------------
// Yardımcılar
// ---------------------------------------------------------------------------

/**
 * Bir href string'ini güvenli biçimde URL nesnesine dönüştürür.
 * Göreli URL'ler instagram.com origin'i ile tamamlanır.
 */
function toURL(href: string): URL | null {
  try {
    // Göreli path ("/p/ABC123/") durumunda origin ekle
    const base = href.startsWith("/") ? INSTAGRAM_ORIGIN : undefined;
    return new URL(href, base);
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Ana fonksiyon
// ---------------------------------------------------------------------------

/**
 * Ham bir Instagram href'ini normalize edilmiş canonical link'e çevirir.
 *
 * @param rawHref  Anchor element'in href attribute'u veya link string'i
 * @returns        Normalize edilmiş link ya da geçersizse null
 *
 * @example
 * normalizeInstagramMediaUrl("/p/ABC123/?igshid=xyz")
 * // → { shortcode: "ABC123", mediaType: "post", canonicalUrl: "https://…/p/ABC123/" }
 */
export function normalizeInstagramMediaUrl(
  rawHref: string,
): NormalizedMediaLink | null {
  const url = toURL(rawHref);
  if (!url) return null;

  // Instagram dışı URL'leri reddet
  if (url.hostname !== "www.instagram.com" && url.hostname !== "instagram.com") {
    return null;
  }

  // Path segmentlerini temizle: ["", "reel", "ABC123", ""] → ["reel", "ABC123"]
  const segments = url.pathname.split("/").filter(Boolean);
  if (segments.length < 2) return null;

  const [typeSegment, shortcode, ...rest] = segments;

  // Sistem path'lerini kullanıcı içeriği sanma
  if (!shortcode || !SHORTCODE_RE.test(shortcode)) return null;

  // Belirli sub-path'leri olan URL'leri reddet (örn. /p/ABC/liked_by/)
  // Bunlar shortcode içeriği değil, post'un alt sayfalarıdır
  if (rest.length > 0) {
    const forbiddenSubs = ["liked_by", "comments", "activity"];
    if (forbiddenSubs.includes(rest[0])) return null;
  }

  const pattern = PATH_PATTERNS.find((p) => p.segment === typeSegment);
  if (!pattern) return null;

  // /reels/audio/..., /reels/saved/... gibi sub-path'leri reddet
  // (bunlar gerçek media değil, kategori/audio reels sayfaları)
  const EXCLUDED_SECOND_SEGMENTS = new Set(["audio", "saved", "suggested"]);
  if (EXCLUDED_SECOND_SEGMENTS.has(shortcode)) return null;

  const canonicalUrl = `${INSTAGRAM_ORIGIN}/${pattern.canonical}/${shortcode}/`;

  return {
    shortcode,
    mediaType: pattern.mediaType,
    canonicalUrl,
  };
}

/**
 * Bir Element'in içinde (veya kendisinde) ilk geçerli Instagram media link'ini bulur.
 * Birden fazla link varsa en spesifik olanı (post/reel) tercih eder.
 */
export function findNormalizedLinkInRoot(
  root: Element,
): NormalizedMediaLink | null {
  const anchors = root.querySelectorAll<HTMLAnchorElement>("a[href]");
  let fallback: NormalizedMediaLink | null = null;

  for (const anchor of Array.from(anchors)) {
    const normalized = normalizeInstagramMediaUrl(anchor.href);
    if (!normalized) continue;
    if (normalized.mediaType !== "unknown") return normalized; // İlk kesin eşleşme
    if (!fallback) fallback = normalized;
  }

  return fallback;
}
