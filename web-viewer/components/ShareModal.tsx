"use client";
import { ModalPortal } from "@/components/ModalPortal";

import { useEffect, useState, useTransition } from "react";
import { generateInviteCode } from "@/app/actions";

interface ShareModalProps {
  collectionId: string;
  collectionName: string;
  onClose: () => void;
}

type Role = "viewer" | "collaborator";

export default function ShareModal({
  collectionId,
  collectionName,
  onClose,
}: ShareModalProps) {
  const [role, setRole] = useState<Role>("viewer");
  const [code, setCode] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isPending, startTransition] = useTransition();

  const generate = (r: Role = role) => {
    setError(null);
    setCopied(false);
    setCode(null);
    startTransition(async () => {
      const result = await generateInviteCode(collectionId, r);
      if (!result.ok) setError(result.error);
      else {
        setCode(result.data.code);
        setExpiresAt(result.data.expiresAt);
      }
    });
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const handleRoleChange = (newRole: Role) => {
    setRole(newRole);
    setCode(null);
    setExpiresAt(null);
    setError(null);
  };

  const handleCopy = () => {
    if (!code) return;
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const expiryLabel = expiresAt
    ? new Date(expiresAt).toLocaleString("tr-TR", {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

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
                Koleksiyonu Paylaş
              </h2>
              <p className="mono text-zinc-500 mt-0.5 truncate max-w-[220px]">
                {collectionName}
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

          {/* Role picker */}
          <div className="flex gap-2">
            {(["viewer", "collaborator"] as Role[]).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => handleRoleChange(r)}
                className={`flex-1 py-2 px-3 mono uppercase tracking-wider text-[10px] border transition-all ${
                  role === r
                    ? "bg-zinc-100 dark:bg-zinc-800 border-zinc-900 dark:border-zinc-100 text-zinc-900 dark:text-zinc-100"
                    : "border-zinc-200 dark:border-zinc-800 text-zinc-500 hover:border-zinc-400 dark:hover:border-zinc-600"
                }`}
              >
                {r === "viewer" ? "Görüntüleyici" : "Ortak"}
              </button>
            ))}
          </div>

          {/* Role description */}
          <p className="mono text-zinc-400 -mt-2">
            {role === "viewer"
              ? "Davet edilen kişi yalnızca görüntüleyebilir."
              : "Davet edilen kişi post ekleyebilir ve kendi postlarını silebilir."}
          </p>

          {/* Code display */}
          {isPending ? (
            <div className="flex items-center justify-center py-4">
              <span className="mono text-zinc-400">Oluşturuluyor...</span>
            </div>
          ) : code ? (
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <code className="flex-1 text-center text-2xl font-mono font-bold tracking-[0.3em] text-zinc-900 dark:text-zinc-100 bg-zinc-100 dark:bg-zinc-800 py-3 px-4 border border-zinc-200 dark:border-zinc-700 select-all">
                  {code}
                </code>
                <button
                  type="button"
                  onClick={handleCopy}
                  title="Kopyala"
                  className={`p-2.5 border transition-all ${copied ? "bg-zinc-100 dark:bg-zinc-800 border-zinc-900 dark:border-zinc-100 text-zinc-900 dark:text-zinc-100" : "border-zinc-200 dark:border-zinc-800 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"}`}
                >
                  {copied ? (
                    <svg
                      className="w-4 h-4"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  ) : (
                    <svg
                      className="w-4 h-4"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                    >
                      <rect x="9" y="9" width="13" height="13" />
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                    </svg>
                  )}
                </button>
              </div>
              <p className="mono text-center text-zinc-400">
                Tek kullanımlık ·{" "}
                {expiryLabel
                  ? `${expiryLabel}'e kadar geçerli`
                  : "24 saat geçerli"}
              </p>
            </div>
          ) : null}

          {error && <p className="mono text-center text-red-500">{error}</p>}

          <button
            type="button"
            onClick={() => generate()}
            disabled={isPending}
            className={code ? "btn-minimal w-full" : "btn-primary w-full"}
          >
            {isPending ? "..." : code ? "YENİ KOD OLUŞTUR" : "KOD OLUŞTUR"}
          </button>
        </div>
      </div>
    </ModalPortal>
  );
}
