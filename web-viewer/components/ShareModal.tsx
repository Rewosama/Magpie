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
      else { setCode(result.data.code); setExpiresAt(result.data.expiresAt); }
    });
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const handleRoleChange = (newRole: Role) => {
    setRole(newRole);
    // Only clear the code — don't auto-generate; user clicks explicitly
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
    ? new Date(expiresAt).toLocaleString("tr-TR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
    : null;

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
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Koleksiyonu Paylaş</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate max-w-[220px]">{collectionName}</p>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
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
                className={`flex-1 py-2 px-3 rounded-xl text-xs font-medium border transition-all ${
                  role === r
                    ? "bg-indigo-50 dark:bg-indigo-950/50 border-indigo-300 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300"
                    : "border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-600"
                }`}
              >
                <span className="flex items-center justify-center gap-1.5">
                  {r === "viewer" ? (
                    <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
                    </svg>
                  ) : (
                    <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
                      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                    </svg>
                  )}
                  {r === "viewer" ? "Görüntüleyici" : "Ortak"}
                </span>
              </button>
            ))}
          </div>

        {/* Role description */}
        <p className="text-xs text-gray-400 dark:text-gray-500 -mt-3">
          {role === "viewer"
            ? "Davet edilen kişi yalnızca görüntüleyebilir."
            : "Davet edilen kişi post ekleyebilir ve kendi postlarını silebilir."}
        </p>

        {/* Code display */}
        {isPending ? (
          <div className="flex items-center justify-center py-4">
            <svg className="w-6 h-6 animate-spin text-indigo-500" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
            </svg>
          </div>
        ) : code ? (
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <code className="flex-1 text-center text-2xl font-mono font-bold tracking-[0.3em] text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50 rounded-xl py-3 px-4 border border-indigo-100 dark:border-indigo-900 select-all">
                {code}
              </code>
              <button type="button" onClick={handleCopy} title="Kopyala"
                className={`p-2.5 rounded-xl border transition-all ${copied ? "bg-green-50 border-green-200 text-green-600 dark:bg-green-950/50 dark:border-green-800 dark:text-green-400" : "border-gray-200 dark:border-gray-700 text-gray-500 hover:text-indigo-600 hover:border-indigo-300 dark:hover:text-indigo-400 dark:hover:border-indigo-700"}`}
              >
                {copied ? (
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                ) : (
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                  </svg>
                )}
              </button>
            </div>
            <p className="text-xs text-center text-gray-400 dark:text-gray-500">
              Tek kullanımlık · {expiryLabel ? `${expiryLabel}'e kadar geçerli` : "24 saat geçerli"}
            </p>
          </div>
        ) : null}

        {error && <p className="text-sm text-center text-red-500 dark:text-red-400">{error}</p>}

        <button type="button" onClick={() => generate()} disabled={isPending}
          className={`w-full py-2 text-sm font-medium rounded-xl transition-colors disabled:opacity-40 ${
            code
              ? "border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800"
              : "bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm"
          }`}
        >
          {isPending ? "Oluşturuluyor…" : code ? "Yeni Kod Oluştur" : "Kod Oluştur"}
        </button>
      </div>
    </div>
    </ModalPortal>
  );
}
