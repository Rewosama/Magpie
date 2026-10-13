"use client";

/**
 * AddByUrlModal
 *
 * Modal for adding posts by pasting a URL.
 * Detects platform, fetches metadata, and saves to collection.
 */

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { detectPlatform, canonicalizeUrl } from "@/lib/canonicalizeUrl";
import { savePostByUrl } from "@/app/actions/url-save";
import type { Collection } from "@/lib/types";

interface AddByUrlModalProps {
  collections: Collection[];
  onClose: () => void;
  onSuccess?: () => void;
}

type SaveState = "idle" | "validating" | "saving" | "success" | "error";

const platformInfo: Record<string, { name: string; color: string }> = {
  instagram: { name: "Instagram", color: "text-pink-500" },
  x: { name: "X", color: "text-zinc-900 dark:text-zinc-100" },
  threads: { name: "Threads", color: "text-zinc-600 dark:text-zinc-400" },
};

export default function AddByUrlModal({
  collections,
  onClose,
  onSuccess,
}: AddByUrlModalProps) {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [selectedCollectionId, setSelectedCollectionId] = useState<
    string | null
  >(() => collections.find((c) => c.is_default)?.id ?? null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Close on escape
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, [onClose]);

  // Detect platform from URL
  const trimmedUrl = url.trim();
  const detectedPlatform = trimmedUrl ? detectPlatform(trimmedUrl) : null;
  const canonicalUrl = detectedPlatform
    ? canonicalizeUrl(trimmedUrl, detectedPlatform)
    : null;
  const isValidUrl = !!detectedPlatform && !!canonicalUrl;

  const handleSave = async () => {
    if (!isValidUrl || !canonicalUrl || !detectedPlatform) return;

    setSaveState("saving");
    setError(null);

    try {
      const result = await savePostByUrl({
        url: trimmedUrl,
        canonicalUrl,
        platform: detectedPlatform,
        collectionId: selectedCollectionId,
      });

      if (result.ok) {
        setSaveState("success");
        // Soft refresh - revalidatePath server'da çağrıldı
        router.refresh();
        setTimeout(() => {
          onSuccess?.();
          onClose();
        }, 1000);
      } else {
        setSaveState("error");
        setError(result.error);
      }
    } catch (e) {
      setSaveState("error");
      setError(e instanceof Error ? e.message : "Bir hata oluştu");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && isValidUrl && saveState === "idle") {
      handleSave();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 w-full max-w-md overflow-hidden">
        {/* Loading Overlay */}
        {saveState === "saving" && (
          <div className="absolute inset-0 z-10 bg-zinc-50/90 dark:bg-zinc-950/90 flex flex-col items-center justify-center gap-4">
            <div className="w-12 h-12 border-2 border-zinc-200 dark:border-zinc-800 border-t-zinc-900 dark:border-t-zinc-100 rounded-full animate-spin" />
            <p className="mono text-sm text-zinc-500">Kaydediliyor...</p>
          </div>
        )}

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-200 dark:border-zinc-800">
          <span className="mono text-[11px] font-medium tracking-[0.15em] text-zinc-500 uppercase">
            URL ile Ekle
          </span>
          <button
            onClick={onClose}
            className="p-1 text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
          >
            <svg
              className="w-4 h-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="p-4 space-y-4">
          {/* URL Input */}
          <div className="space-y-2">
            <label className="block text-xs text-zinc-500 uppercase tracking-wider">
              Post URL&apos;si
            </label>
            <input
              ref={inputRef}
              type="url"
              value={url}
              onChange={(e) => {
                setUrl(e.target.value);
                setSaveState("idle");
                setError(null);
              }}
              onKeyDown={handleKeyDown}
              placeholder="https://instagram.com/p/... veya https://x.com/..."
              className="input-sharp text-sm"
              disabled={saveState === "saving" || saveState === "success"}
            />
          </div>

          {/* Platform Detection */}
          {trimmedUrl && (
            <div className="flex items-center gap-2 text-sm">
              {detectedPlatform ? (
                <>
                  <svg
                    className="w-4 h-4 text-emerald-500"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  <span className={platformInfo[detectedPlatform]?.color}>
                    {platformInfo[detectedPlatform]?.name}
                  </span>
                  <span className="text-zinc-400">algılandı</span>
                </>
              ) : (
                <>
                  <svg
                    className="w-4 h-4 text-amber-500"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                  <span className="text-zinc-500">
                    Desteklenen platform algılanamadı
                  </span>
                </>
              )}
            </div>
          )}

          {/* Collection Selector */}
          <div className="space-y-2">
            <label className="block text-xs text-zinc-500 uppercase tracking-wider">
              Koleksiyon
            </label>
            <select
              value={selectedCollectionId || ""}
              onChange={(e) => setSelectedCollectionId(e.target.value || null)}
              disabled={saveState === "saving" || saveState === "success"}
              className="w-full px-3 py-2.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-600 appearance-none cursor-pointer disabled:opacity-50"
              style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%2371717a'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`,
                backgroundRepeat: "no-repeat",
                backgroundPosition: "right 0.75rem center",
                backgroundSize: "1rem",
              }}
            >
              <option value="">Koleksiyon seçilmedi</option>
              {collections.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.is_default ? `★ ${c.name}` : c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-sm text-red-600 dark:text-red-400">
              {error}
            </div>
          )}

          {/* Success Message */}
          {saveState === "success" && (
            <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 text-sm text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
              <svg
                className="w-4 h-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
              Post kaydedildi!
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-4 border-t border-zinc-200 dark:border-zinc-800">
          <button
            onClick={onClose}
            disabled={saveState === "saving"}
            className="flex-1 px-4 py-2.5 text-sm text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors disabled:opacity-50"
          >
            İptal
          </button>
          <button
            onClick={handleSave}
            disabled={
              !isValidUrl || saveState === "saving" || saveState === "success"
            }
            className="flex-1 px-4 py-2.5 text-sm bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {saveState === "saving" ? (
              <>
                <svg
                  className="w-4 h-4 animate-spin"
                  viewBox="0 0 24 24"
                  fill="none"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                Kaydediliyor...
              </>
            ) : (
              "Kaydet"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
