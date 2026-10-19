"use client";

import { useState } from "react";
import { ModalPortal } from "@/components/ModalPortal";
import ThemeToggle from "@/components/ThemeToggle";
import { DeleteAccountDialog } from "@/components/DeleteAccountDialog";

interface SettingsButtonProps {
  email: string;
}

function ExternalIcon() {
  return (
    <svg
      className="w-3 h-3 shrink-0 text-zinc-400"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  );
}

export function SettingsButton({ email }: SettingsButtonProps) {
  const [open, setOpen] = useState(false);
  const [showDelete, setShowDelete] = useState(false);

  const handleDeleteClick = () => {
    setOpen(false);
    setShowDelete(true);
  };

  return (
    <>
      {/* Gear icon */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Ayarlar"
        className="w-8 h-8 flex items-center justify-center text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          className="w-4 h-4"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      </button>

      {/* Settings modal */}
      {open && (
        <ModalPortal>
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            onClick={() => setOpen(false)}
          >
            <div className="absolute inset-0 bg-black/60" />
            <div
              className="relative bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 w-full max-w-xs overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-200 dark:border-zinc-800">
                <span className="mono text-zinc-900 dark:text-zinc-100 uppercase tracking-wider">
                  Ayarlar
                </span>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Kapat"
                  className="text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
                >
                  <svg
                    className="w-4 h-4"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                  >
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>

              {/* E-posta */}
              <div className="px-4 py-3">
                <p className="mono text-zinc-400 uppercase tracking-wider mb-1">
                  Hesap
                </p>
                <p className="text-sm text-zinc-700 dark:text-zinc-300 truncate">
                  {email}
                </p>
              </div>

              <div className="mx-4 border-t border-zinc-100 dark:border-zinc-800" />

              {/* Tema */}
              <div className="flex items-center justify-between px-4 py-3">
                <span className="text-sm text-zinc-700 dark:text-zinc-300">
                  Koyu tema
                </span>
                <ThemeToggle />
              </div>

              <div className="mx-4 border-t border-zinc-100 dark:border-zinc-800" />

              {/* Gizlilik */}
              <div className="px-4 py-3 flex flex-col gap-1">
                <a
                  href="/privacy"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setOpen(false)}
                  className="flex items-center justify-between py-1.5 text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
                >
                  Gizlilik Politikası <ExternalIcon />
                </a>
                <a
                  href="/terms"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setOpen(false)}
                  className="flex items-center justify-between py-1.5 text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
                >
                  Kullanım Koşulları <ExternalIcon />
                </a>
              </div>

              <div className="mx-4 border-t border-zinc-100 dark:border-zinc-800" />

              {/* Hesabı sil */}
              <div className="px-4 py-4">
                <button
                  type="button"
                  onClick={handleDeleteClick}
                  className="btn-danger w-full flex items-center justify-center gap-2"
                >
                  <svg
                    className="w-4 h-4 shrink-0"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    aria-hidden="true"
                  >
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                    <path d="M10 11v6M14 11v6" />
                    <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                  </svg>
                  HESABI SİL
                </button>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}

      {showDelete && (
        <DeleteAccountDialog
          email={email}
          onClose={() => setShowDelete(false)}
        />
      )}
    </>
  );
}
