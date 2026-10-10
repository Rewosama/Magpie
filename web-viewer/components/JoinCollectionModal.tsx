"use client";
import { ModalPortal } from "@/components/ModalPortal";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { joinCollectionViaCode } from "@/app/actions";

interface JoinCollectionModalProps {
  onClose: () => void;
}

export default function JoinCollectionModal({ onClose }: JoinCollectionModalProps) {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [successName, setSuccessName] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 50);
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;
    setError(null);
    startTransition(async () => {
      const result = await joinCollectionViaCode(code);
      if (!result || "error" in result) {
        setError(result.error);
      } else {
        setSuccessName(result.data.collectionName);
        setTimeout(() => {
          router.refresh();
          onClose();
        }, 1500);
      }
    });
  };

  return (
    <ModalPortal>
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div
        className="relative bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-sm p-6 flex flex-col gap-5 border border-gray-100 dark:border-gray-800"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Koleksiyona Katıl</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">8 haneli davet kodunu gir</p>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {successName ? (
          <div className="flex flex-col items-center gap-2 py-4">
            <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-950/60 flex items-center justify-center">
              <svg className="w-5 h-5 text-green-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100 text-center">
              <span className="font-semibold text-indigo-600 dark:text-indigo-400">{successName}</span> koleksiyonuna katıldınız
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <input
              ref={inputRef}
              type="text"
              value={code}
              onChange={(e) => {
                setCode(e.target.value.toUpperCase());
                setError(null);
              }}
              placeholder="ABC12345"
              maxLength={8}
              autoComplete="off"
              spellCheck={false}
              className={`w-full text-center text-xl font-mono font-bold tracking-[0.25em] px-4 py-3 rounded-xl border bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 transition-all ${
                error
                  ? "border-red-300 dark:border-red-700 focus:ring-red-500/30"
                  : "border-gray-200 dark:border-gray-700 focus:ring-indigo-500/30 focus:border-indigo-400"
              } text-gray-900 dark:text-gray-100`}
            />
            {error && (
              <p className="text-xs text-center text-red-500 dark:text-red-400">{error}</p>
            )}
            <button
              type="submit"
              disabled={isPending || code.length < 8}
              className="w-full py-2.5 text-sm font-medium rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white transition-colors shadow-sm"
            >
              {isPending ? "Kontrol ediliyor…" : "Katıl"}
            </button>
          </form>
        )}
      </div>
    </div>
    </ModalPortal>
  );
}
