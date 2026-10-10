"use client";

import { useState } from "react";
import Link from "next/link";
import { ModalPortal } from "@/components/ModalPortal";
import ThemeToggle from "@/components/ThemeToggle";
import { DeleteAccountDialog } from "@/components/DeleteAccountDialog";

interface SettingsButtonProps {
  email: string;
}

function ExternalIcon() {
  return (
    <svg className="w-3.5 h-3.5 shrink-0 opacity-50" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
      <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
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
        className="w-9 h-9 flex items-center justify-center rounded-lg text-gray-500 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-100 dark:hover:bg-gray-800 transition-colors"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5" aria-hidden="true">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      </button>

      {/* Settings modal */}
      {open && (
        <ModalPortal>
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setOpen(false)}>
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
            <div
              className="relative bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-xs border border-gray-100 dark:border-gray-800 overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-800">
                <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">Ayarlar</span>
                <button type="button" onClick={() => setOpen(false)} aria-label="Kapat" className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors">
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>

              {/* E-posta */}
              <div className="px-5 py-3.5">
                <p className="text-xs font-medium text-gray-400 dark:text-gray-500 mb-0.5">Hesap</p>
                <p className="text-sm text-gray-700 dark:text-gray-300 truncate">{email}</p>
              </div>

              <div className="mx-5 border-t border-gray-100 dark:border-gray-800" />

              {/* Tema */}
              <div className="flex items-center justify-between px-5 py-3.5">
                <span className="text-sm text-gray-700 dark:text-gray-300">Koyu tema</span>
                <ThemeToggle />
              </div>

              <div className="mx-5 border-t border-gray-100 dark:border-gray-800" />

              {/* Gizlilik */}
              <div className="px-5 py-3 flex flex-col gap-0.5">
                <Link href="/privacy" target="_blank" rel="noopener noreferrer" onClick={() => setOpen(false)}
                  className="flex items-center justify-between py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
                  Gizlilik Politikası <ExternalIcon />
                </Link>
                <Link href="/terms" target="_blank" rel="noopener noreferrer" onClick={() => setOpen(false)}
                  className="flex items-center justify-between py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
                  Kullanım Koşulları <ExternalIcon />
                </Link>
              </div>

              <div className="mx-5 border-t border-gray-100 dark:border-gray-800" />

              {/* Hesabı sil */}
              <div className="px-5 py-4">
                <button
                  type="button"
                  onClick={handleDeleteClick}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-red-200 dark:border-red-900/60 text-red-500 dark:text-red-400 text-sm font-medium hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
                >
                  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                    <path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                  </svg>
                  Hesabı Sil
                </button>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}

      {showDelete && (
        <DeleteAccountDialog email={email} onClose={() => setShowDelete(false)} />
      )}
    </>
  );
}
