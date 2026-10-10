"use client";

import { useState, useTransition } from "react";
import { createBrowserClient } from "@/lib/supabase.browser";
import { ModalPortal } from "@/components/ModalPortal";
import { deleteAccount } from "@/app/actions/auth";

interface DeleteAccountDialogProps {
  email: string;
  onClose: () => void;
}

export function DeleteAccountDialog({ email, onClose }: DeleteAccountDialogProps) {
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = () => {
    if (!confirmed) return;
    setError(null);
    startTransition(async () => {
      const result = await deleteAccount();
      if (result.ok) {
        // Sign out first to clear sb-* cookies so login page doesn't
        // show "expired" banner on next visit.
        try { await createBrowserClient().auth.signOut(); } catch { /* ignore */ }
        window.location.replace("/login");
        return;
      } else {
        setError(result.error);
      }
    });
  };

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

        <div
          className="relative bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-md p-6 flex flex-col gap-5 border border-gray-100 dark:border-gray-800"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Icon + başlık */}
          <div className="flex items-start gap-4">
            <div className="w-11 h-11 rounded-full bg-red-50 dark:bg-red-950/60 flex items-center justify-center shrink-0 ring-1 ring-red-100 dark:ring-red-900/40">
              <svg className="w-5 h-5 text-red-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
            </div>
            <div className="pt-0.5">
              <p className="text-base font-semibold text-gray-900 dark:text-gray-100 leading-snug">
                Hesabı kalıcı olarak sil
              </p>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
                <span className="font-medium text-gray-700 dark:text-gray-300">{email}</span> hesabına
                ait tüm postlar, koleksiyonlar ve medya dosyaları kalıcı olarak silinecektir.
              </p>
            </div>
          </div>

          {/* Silme kapsamı */}
          <ul className="text-sm text-gray-500 dark:text-gray-400 space-y-1.5 pl-1">
            {[
              "Kaydedilen tüm postlar",
              "Oluşturulan tüm koleksiyonlar ve içerikleri",
              "Üyelikler ve davet kodları",
              "Yüklenen thumbnail ve avatar dosyaları",
            ].map((item) => (
              <li key={item} className="flex items-center gap-2">
                <span className="w-1 h-1 rounded-full bg-gray-400 dark:bg-gray-600 shrink-0" />
                {item}
              </li>
            ))}
          </ul>

          {/* Onay checkbox */}
          <label className="flex items-start gap-3 cursor-pointer group select-none">
            <div className="relative mt-0.5 shrink-0">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
                className="sr-only"
              />
              <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${
                confirmed
                  ? "bg-red-500 border-red-500"
                  : "border-gray-300 dark:border-gray-600 group-hover:border-red-400 dark:group-hover:border-red-500"
              }`}>
                {confirmed && (
                  <svg className="w-3 h-3 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                )}
              </div>
            </div>
            <span className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
              Bu işlemin geri alınamaz olduğunu anlıyor, hesabımın ve tüm verilerimin
              kalıcı olarak silineceğini onaylıyorum.
            </span>
          </label>

          {/* Hata */}
          {error && (
            <p className="text-sm text-red-500 dark:text-red-400 -mt-2">{error}</p>
          )}

          {/* Butonlar */}
          <div className="flex gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={isPending}
              className="flex-1 px-4 py-2.5 text-sm font-medium rounded-xl border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
            >
              Vazgeç
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!confirmed || isPending}
              className="flex-1 px-4 py-2.5 text-sm font-medium rounded-xl bg-red-500 hover:bg-red-600 active:bg-red-700 text-white transition-colors shadow-sm disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isPending ? (
                <>
                  <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                  Siliniyor…
                </>
              ) : (
                "Hesabımı Kalıcı Olarak Sil"
              )}
            </button>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}
