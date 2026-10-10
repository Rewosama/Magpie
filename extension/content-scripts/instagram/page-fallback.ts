/**
 * page-fallback.ts
 * DOM extraction'ın eksik bıraktığı alanları Open Graph ve JSON-LD ile doldurur.
 * Yalnızca tekil post/reel sayfalarında güvenilirdir.
 */

import type { ExtractedMetadata, SourceContext } from "./types";

// ---------------------------------------------------------------------------
// Yardımcılar
// ---------------------------------------------------------------------------

/** Bir meta tag'in content attribute'unu döndürür. */
function getMeta(property: string): string | undefined {
  const el = document.querySelector<HTMLMetaElement>(
    `meta[property="${property}"], meta[name="${property}"]`,
  );
  const content = el?.content?.trim();
  return content || undefined;
}

/**
 * JSON-LD script bloklarını parse eder ve ilk geçerli Instagram Media objesini döndürür.
 * Hata durumunda sessizce undefined döner.
 */
function parseJsonLd(): Record<string, unknown> | undefined {
  const scripts = document.querySelectorAll<HTMLScriptElement>(
    'script[type="application/ld+json"]',
  );
  for (const script of Array.from(scripts)) {
    try {
      const data: unknown = JSON.parse(script.textContent ?? "");
      if (data && typeof data === "object" && !Array.isArray(data)) {
        return data as Record<string, unknown>;
      }
    } catch {
      // Parse hatası — sonraki bloğa geç
    }
  }
  return undefined;
}

/** OG description'dan caption'ı parse eder.
 *  Instagram formatı: "N likes, M comments - username, date: CAPTION"
 *  Eğer ": " içeriyorsa sonrasını caption kabul et.
 */
function parseOgDescription(description: string): string | undefined {
  if (!description) return undefined;

  // A: Sondaki tırnak içi metin — "...date: \"caption text\"."
  // Akıllı tırnak (“”) veya düz tırnak
  const quoted = description.match(/:\s*["“”„](.+)["“”‟]\.?\s*$/s);
  if (quoted?.[1]) return quoted[1].trim();

  // B: İki noktadan sonraki bölüm — "...date: caption text"
  const colonIdx = description.indexOf(": ");
  if (colonIdx > 0 && colonIdx < 150) {
    const rest = description.substring(colonIdx + 2).trim();
    if (rest.length > 0) return rest;
  }

  return description.trim() || undefined;
}

// ---------------------------------------------------------------------------
// Fallback veri toplama
// ---------------------------------------------------------------------------

interface PageFallbackData {
  caption?: string;
  thumbnailUrl?: string;
  mediaUrl?: string;
  authorUsername?: string;
}

/**
 * Sayfadaki OG meta tag'lerinden ve JSON-LD'den fallback veri toplar.
 */
export function getPageFallbackData(): PageFallbackData {
  const ogImage = getMeta("og:image");
  const ogVideo =
    getMeta("og:video") ??
    getMeta("og:video:url") ??
    getMeta("og:video:secure_url");
  const ogDesc = getMeta("og:description");
  const ogTitle = getMeta("og:title");
  const ogType = getMeta("og:type"); // "video.other" for Reels

  let caption: string | undefined;
  if (ogDesc) caption = parseOgDescription(ogDesc);

  // JSON-LD'den author çıkarmaya çalış (isteğe bağlı, hata toleranslı)
  let authorUsername: string | undefined;
  try {
    const ld = parseJsonLd();
    if (ld?.author && typeof ld.author === "object") {
      const author = ld.author as Record<string, unknown>;
      if (typeof author.url === "string") {
        const match = author.url.match(/instagram\.com\/([^/]+)/);
        if (match?.[1]) authorUsername = match[1];
      }
    }
  } catch {
    // JSON-LD parse hatası — ignored
  }

  // og:title formatı: "DisplayName on Instagram: 'caption...'"
  if (!authorUsername && ogTitle) {
    const match = ogTitle.match(/^(.+?)\s+on\s+Instagram/i);
    if (match?.[1]) {
      // Display name genellikle username değil; sadece @ ile başlıyorsa güven
      const name = match[1].trim();
      if (name.startsWith("@")) authorUsername = name.slice(1);
    }
  }

  return {
    caption,
    thumbnailUrl: ogImage,
    mediaUrl: ogVideo,
    authorUsername,
  };
}

// ---------------------------------------------------------------------------
// Ana fonksiyon
// ---------------------------------------------------------------------------

/**
 * DOM'dan çıkarılan metadata'ya eksik alanları fallback ile ekler.
 * Mevcut (truthy) değerlerin üzerine yazmaz.
 *
 * @param domData       DOM extraction'dan gelen metadata
 * @param context       Sayfa bağlamı — sadece tekil sayfalarda fallback uygula
 */
export function fillMissingFields(
  domData: ExtractedMetadata,
  context: SourceContext,
): ExtractedMetadata {
  // Feed sayfasında OG verileri yanlış postu işaret edebilir — uygulama
  const isSinglePage =
    context === "post-page" || context === "reel-page";

  if (!isSinglePage) return domData;

  // Tüm alanlar zaten doluysa fallback'e gerek yok
  const allFilled =
    domData.caption !== undefined &&
    domData.thumbnailUrl !== undefined &&
    domData.authorUsername !== undefined;

  if (allFilled) return domData;

  const fallback = getPageFallbackData();

  return {
    authorUsername: domData.authorUsername ?? fallback.authorUsername,
    authorUrl: domData.authorUrl,
    caption: domData.caption ?? fallback.caption,
    thumbnailUrl: domData.thumbnailUrl ?? fallback.thumbnailUrl,
    mediaUrl: domData.mediaUrl ?? fallback.mediaUrl,
    publishedAt: domData.publishedAt,
  };
}
