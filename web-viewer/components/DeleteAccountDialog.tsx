"use client";

import { useState, useTransition } from "react";
import { createBrowserClient } from "@/lib/supabase.browser";
import { ModalPortal } from "@/components/ModalPortal";
import { deleteAccount } from "@/app/actions/auth";

interface DeleteAccountDialogProps {
  email: string;
  onClose: () => void;
}

export function DeleteAccountDialog({
  email,
  onClose,
}: DeleteAccountDialogProps) {
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = () => {
    if (!confirmed) return;
    setError(null);
    startTransition(async () => {
      const result = await deleteAccount();
      if (result.ok) {
        try {
          await createBrowserClient().auth.signOut();
        } catch {
          /* ignore */
        }
        window.location.replace("/login");
        return;
      } else {
        setError(result.error);
      }
    });
  };

  return (
    <ModalPortal>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <div className="absolute inset-0 bg-black/60" />

        <div
          className="relative bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 w-full max-w-md p-6 flex flex-col gap-5"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 border border-red-300 dark:border-red-800 flex items-center justify-center shrink-0">
              <svg
                className="w-5 h-5 text-red-500"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                aria-hidden="true"
              >
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                Hesabı kalıcı olarak sil
              </p>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                <span className="font-medium text-zinc-700 dark:text-zinc-300">
                  {email}
                </span>{" "}
                hesabına ait tüm veriler kalıcı olarak silinecektir.
              </p>
            </div>
          </div>

          {/* Silme kapsamı */}
          <ul className="text-sm text-zinc-500 dark:text-zinc-400 space-y-1.5 pl-1">
            {[
              "Kaydedilen tüm postlar",
              "Oluşturulan tüm koleksiyonlar ve içerikleri",
              "Üyelikler ve davet kodları",
              "Yüklenen thumbnail ve avatar dosyaları",
            ].map((item) => (
              <li key={item} className="flex items-center gap-2">
                <span className="mono text-zinc-400">—</span>
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
              <div
                className={`w-5 h-5 border flex items-center justify-center transition-all ${
                  confirmed
                    ? "bg-red-500 border-red-500"
                    : "border-zinc-300 dark:border-zinc-600 group-hover:border-red-400 dark:group-hover:border-red-500"
                }`}
              >
                {confirmed && (
                  <svg
                    className="w-3 h-3 text-white"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </div>
            </div>
            <span className="text-sm text-zinc-600 dark:text-zinc-400">
              Bu işlemin geri alınamaz olduğunu anlıyor, hesabımın ve tüm
              verilerimin kalıcı olarak silineceğini onaylıyorum.
            </span>
          </label>

          {/* Hata */}
          {error && <p className="mono text-red-500 -mt-2">{error}</p>}

          {/* Butonlar */}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isPending}
              className="btn-minimal flex-1"
            >
              Vazgeç
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!confirmed || isPending}
              className="btn-danger flex-1 flex items-center justify-center gap-2"
            >
              {isPending ? (
                <>
                  <span className="mono">...</span>
                  Siliniyor
                </>
              ) : (
                "HESABI SİL"
              )}
            </button>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}
