"use client";

/**
 * ShareTargetClient
 *
 * Client component for the share target flow:
 * 1. Validates and detects platform from shared URL
 * 2. Shows collection selector
 * 3. Saves post via server action
 */

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { detectPlatform, canonicalizeUrl } from "@/lib/canonicalizeUrl";
import { saveSharedPost } from "./actions";
import type { Collection } from "@/lib/types";

interface ShareTargetClientProps {
  sharedUrl: string;
  sharedText?: string;
  collections: Collection[];
}

type SaveState = "idle" | "saving" | "success" | "error";

export default function ShareTargetClient({
  sharedUrl,
  sharedText,
  collections,
}: ShareTargetClientProps) {
  const router = useRouter();
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(
    () => collections.find((c) => c.is_default)?.id ?? null,
  );

  // Detect platform and validate URL
  const platform = detectPlatform(sharedUrl);
  const canonicalUrl = platform ? canonicalizeUrl(sharedUrl, platform) : null;
  const isValidUrl = !!platform && !!canonicalUrl;

  // Platform display names and icons
  const platformInfo: Record<string, { name: string; icon: JSX.Element }> = {
    instagram: {
      name: "Instagram",
      icon: (
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
        </svg>
      ),
    },
    x: {
      name: "X",
      icon: (
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
      ),
    },
    threads: {
      name: "Threads",
      icon: (
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12.186 24h-.007c-3.581-.024-6.334-1.205-8.184-3.509C2.35 18.44 1.5 15.586 1.472 12.01v-.017c.03-3.579.879-6.43 2.525-8.482C5.845 1.205 8.6.024 12.18 0h.014c2.746.02 5.043.725 6.826 2.098 1.677 1.29 2.858 3.13 3.509 5.467l-2.04.569c-1.104-3.96-3.898-5.984-8.304-6.015-2.91.022-5.11.936-6.54 2.717C4.307 6.504 3.616 8.914 3.589 12c.027 3.086.718 5.496 2.057 7.164 1.43 1.783 3.631 2.698 6.54 2.717 2.623-.02 4.358-.631 5.8-2.045 1.647-1.613 1.618-3.593 1.09-4.798-.31-.71-.873-1.3-1.634-1.75-.192 1.352-.622 2.446-1.284 3.272-.886 1.102-2.14 1.704-3.73 1.79-1.202.065-2.361-.218-3.259-.801-1.063-.689-1.685-1.74-1.752-2.96-.065-1.17.408-2.243 1.33-3.023.88-.744 2.12-1.2 3.59-1.317a15.99 15.99 0 012.59-.012c-.09-.753-.263-1.358-.527-1.822-.396-.695-1.055-1.047-1.958-1.047h-.082c-.63.013-1.15.174-1.546.477a1.88 1.88 0 00-.574.717l-1.81-.815c.276-.614.707-1.133 1.276-1.54.79-.565 1.755-.856 2.872-.856h.096c1.498.026 2.674.542 3.498 1.535.735.888 1.177 2.07 1.315 3.517.69.084 1.335.213 1.93.385 1.07.312 1.97.78 2.676 1.394.834.724 1.417 1.63 1.736 2.693.332 1.106.372 2.428.12 3.932-.344 2.05-1.384 3.822-3.093 5.267-1.943 1.642-4.574 2.512-7.607 2.512z" />
        </svg>
      ),
    },
  };

  const handleSave = async () => {
    if (!isValidUrl || !canonicalUrl) return;

    setSaveState("saving");
    setError(null);

    try {
      const result = await saveSharedPost({
        url: sharedUrl,
        canonicalUrl,
        platform: platform!,
        collectionId: selectedCollectionId,
      });

      if (result.ok) {
        setSaveState("success");
        // Redirect to feed after short delay
        setTimeout(() => {
          router.push("/feed");
        }, 1500);
      } else {
        setSaveState("error");
        setError(result.error);
      }
    } catch (e) {
      setSaveState("error");
      setError(e instanceof Error ? e.message : "Bir hata oluştu");
    }
  };

  // Auto-redirect on success
  useEffect(() => {
    if (saveState === "success") {
      const timer = setTimeout(() => router.push("/feed"), 1500);
      return () => clearTimeout(timer);
    }
  }, [saveState, router]);

  // Invalid URL view
  if (!isValidUrl) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 bg-zinc-50 dark:bg-zinc-950">
        <div className="text-center space-y-4 max-w-sm">
          <div className="w-12 h-12 mx-auto flex items-center justify-center bg-amber-100 dark:bg-amber-900/30">
            <svg
              className="w-6 h-6 text-amber-500"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          </div>
          <h1 className="mono text-sm font-medium text-zinc-900 dark:text-zinc-100 uppercase tracking-wider">
            Desteklenmeyen URL
          </h1>
          <p className="text-sm text-zinc-500">
            Bu URL Instagram, X veya Threads&apos;den bir post değil.
          </p>
          <p className="text-xs text-zinc-400 break-all font-mono">{sharedUrl}</p>
          <a
            href="/feed"
            className="inline-block mt-4 px-4 py-2 text-sm bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors"
          >
            Arşive Dön
          </a>
        </div>
      </div>
    );
  }

  // Success view
  if (saveState === "success") {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 bg-zinc-50 dark:bg-zinc-950">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 mx-auto flex items-center justify-center bg-emerald-100 dark:bg-emerald-900/30">
            <svg
              className="w-6 h-6 text-emerald-500"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <h1 className="mono text-sm font-medium text-zinc-900 dark:text-zinc-100 uppercase tracking-wider">
            Kaydedildi
          </h1>
          <p className="text-sm text-zinc-500">Arşive yönlendiriliyorsun...</p>
        </div>
      </div>
    );
  }

  // Main save view
  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-8 bg-zinc-50 dark:bg-zinc-950">
      <div className="w-full max-w-sm space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="mono text-sm font-medium text-zinc-900 dark:text-zinc-100 uppercase tracking-wider">
            Postu Kaydet
          </h1>
          <p className="text-sm text-zinc-500">Arşivine ekle</p>
        </div>

        {/* Platform & URL Preview */}
        <div className="p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 flex items-center justify-center bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
              {platform && platformInfo[platform]?.icon}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                {platform && platformInfo[platform]?.name}
              </p>
              <p className="text-xs text-zinc-400 truncate">{canonicalUrl}</p>
            </div>
          </div>
        </div>

        {/* Collection Selector */}
        <div className="space-y-2">
          <label className="block text-xs text-zinc-500 uppercase tracking-wider">
            Koleksiyon
          </label>
          <select
            value={selectedCollectionId || ""}
            onChange={(e) =>
              setSelectedCollectionId(e.target.value || null)
            }
            className="w-full px-3 py-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-600 appearance-none cursor-pointer"
            style={{
              // Custom dropdown arrow
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

        {/* Actions */}
        <div className="flex gap-3">
          <a
            href="/feed"
            className="flex-1 px-4 py-3 text-center text-sm text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            İptal
          </a>
          <button
            onClick={handleSave}
            disabled={saveState === "saving"}
            className="flex-1 px-4 py-3 text-sm bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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

        {/* Shared text preview (if any) */}
        {sharedText && sharedText !== sharedUrl && (
          <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800">
            <p className="text-xs text-zinc-400 mb-2 uppercase tracking-wider">
              Paylaşılan metin
            </p>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 line-clamp-3">
              {sharedText}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
