/**
 * types.ts
 * Tüm TypeScript type/interface tanımları.
 */

export type MediaType = "post" | "reel" | "igtv" | "unknown";

export type SourceContext =
  | "feed"
  | "post-page"
  | "reel-page"
  | "profile"
  | "explore"
  | "modal"
  | "unknown";

export interface SavedInstagramMedia {
  /** "instagram:<shortcode>" */
  id: string;
  shortcode: string;
  /** Query param / hash temizlenmiş canonical URL */
  canonicalUrl: string;
  mediaType: MediaType;
  authorUsername?: string;
  authorUrl?: string;
  caption?: string;
  thumbnailUrl?: string;
  mediaUrl?: string;
  publishedAt?: string;
  sourceContext: SourceContext;
  savedAt: string;
}

export interface NormalizedMediaLink {
  shortcode: string;
  mediaType: MediaType;
  canonicalUrl: string;
}

/** Metadata extractor'dan dönen ham veri (tüm alanlar opsiyonel) */
export interface ExtractedMetadata {
  authorUsername?: string;
  authorUrl?: string;
  caption?: string;
  thumbnailUrl?: string;
  mediaUrl?: string;
  publishedAt?: string;
}

/** Buton durumları */
export type ButtonState = "idle" | "loading" | "saved" | "error" | "duplicate";
