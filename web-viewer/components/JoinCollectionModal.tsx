"use client";
import { ModalPortal } from "@/components/ModalPortal";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { joinCollectionViaCode } from "@/app/actions";

interface JoinCollectionModalProps {
  onClose: () => void;
}

export default function JoinCollectionModal({
  onClose,
}: JoinCollectionModalProps) {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [successName, setSuccessName] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 50);
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
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
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <div className="absolute inset-0 bg-black/60" />
        <div
          className="relative bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 w-full max-w-sm p-5 flex flex-col gap-4"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="mono text-zinc-900 dark:text-zinc-100 uppercase tracking-wider">
                Koleksiyona Katıl
              </h2>
              <p className="mono text-zinc-500 mt-0.5">
                8 haneli davet kodunu gir
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
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

          {successName ? (
            <div className="flex flex-col items-center gap-2 py-4">
              <div className="w-10 h-10 border border-zinc-200 dark:border-zinc-700 flex items-center justify-center">
                <svg
                  className="w-5 h-5 text-zinc-900 dark:text-zinc-100"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <p className="text-sm text-zinc-700 dark:text-zinc-300 text-center">
                <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                  {successName}
                </span>{" "}
                koleksiyonuna katıldınız
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
                className={`w-full text-center text-xl font-mono font-bold tracking-[0.25em] px-4 py-3 border bg-white dark:bg-zinc-900 focus:outline-none transition-all ${
                  error
                    ? "border-red-400 dark:border-red-700"
                    : "border-zinc-200 dark:border-zinc-800 focus:border-zinc-400 dark:focus:border-zinc-600"
                } text-zinc-900 dark:text-zinc-100`}
              />
              {error && (
                <p className="mono text-center text-red-500">{error}</p>
              )}
              <button
                type="submit"
                disabled={isPending || code.length < 8}
                className="btn-primary w-full"
              >
                {isPending ? "..." : "KATIL"}
              </button>
            </form>
          )}
        </div>
      </div>
    </ModalPortal>
  );
}
