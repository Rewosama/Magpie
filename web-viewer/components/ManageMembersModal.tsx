"use client";

import { useEffect, useState, useTransition } from "react";
import { getCollectionMembers, revokeCollectionMember, getActiveInvites, revokeInviteCode } from "@/app/actions";
import type { CollectionMember, ActiveInvite } from "@/lib/types";
import { ModalPortal } from "@/components/ModalPortal";

interface ManageMembersModalProps {
  collectionId: string;
  collectionName: string;
  onClose: () => void;
}

export default function ManageMembersModal({ collectionId, collectionName, onClose }: ManageMembersModalProps) {
  const [members, setMembers] = useState<CollectionMember[]>([]);
  const [invites, setInvites] = useState<ActiveInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revoking, setRevoking] = useState<string | null>(null);
  const [revokingInvite, setRevokingInvite] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  useEffect(() => {
    Promise.all([
      getCollectionMembers(collectionId),
      getActiveInvites(collectionId),
    ]).then(([membersResult, invitesResult]) => {
      setLoading(false);
      if (!membersResult.ok) setError(membersResult.error);
      else setMembers(membersResult.data.members);
      if (!invitesResult.ok) { /* silent fail for invites */ }
      else setInvites(invitesResult.data.invites);
    });

    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [collectionId, onClose]);

  const handleRevokeM = (memberUserId: string) => {
    setRevoking(memberUserId);
    startTransition(async () => {
      const result = await revokeCollectionMember(collectionId, memberUserId);
      setRevoking(null);
      if (!result.ok) setError(result.error);
      else setMembers((prev) => prev.filter((m) => m.member_user_id !== memberUserId));
    });
  };

  const handleRevokeI = (inviteId: string) => {
    setRevokingInvite(inviteId);
    startTransition(async () => {
      const result = await revokeInviteCode(inviteId);
      setRevokingInvite(null);
      if (!result.ok) setError(result.error);
      else setInvites((prev) => prev.filter((i) => i.invite_id !== inviteId));
    });
  };

  const roleLabel = (role: string) => {
    if (role === "owner") return null;
    if (role === "collaborator") return <span className="ml-1.5 text-[9px] font-medium px-1.5 py-0.5 rounded bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400">Ortak</span>;
    return <span className="ml-1.5 text-[9px] font-medium px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400">Görüntüleyici</span>;
  };

  return (
    <ModalPortal>
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div
        className="relative bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-md p-6 flex flex-col gap-4 border border-gray-100 dark:border-gray-800 max-h-[80vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Üyeler ve Kodlar</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate max-w-[260px]">{collectionName}</p>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {error && <p className="text-sm text-red-500 dark:text-red-400 shrink-0">{error}</p>}

        <div className="overflow-y-auto flex flex-col gap-5">

          {/* ── Members ── */}
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-2">Üyeler</p>

            {loading ? (
              <div className="flex items-center justify-center py-6">
                <svg className="w-5 h-5 animate-spin text-indigo-500" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                </svg>
              </div>
            ) : members.length === 0 ? (
              <p className="text-xs text-gray-400 dark:text-gray-600 italic">Henüz üye yok</p>
            ) : (
              <ul className="divide-y divide-gray-100 dark:divide-gray-800">
                {members.map((m) => (
                  <li key={m.member_user_id} className="flex items-center gap-3 py-2.5">
                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 shrink-0 flex items-center justify-center text-white text-[10px] font-bold">
                      {m.email[0]?.toUpperCase() ?? "?"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1 flex-wrap">
                        <p className="text-xs font-medium text-gray-800 dark:text-gray-200 truncate max-w-[180px]">{m.email}</p>
                        {m.is_owner ? (
                          <span className="shrink-0 text-[9px] font-semibold px-1.5 py-0.5 rounded bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400">Sahip</span>
                        ) : roleLabel(m.member_role)}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <p className="text-[10px] text-gray-400 dark:text-gray-500">
                          {new Date(m.joined_at).toLocaleDateString("tr-TR", { day: "numeric", month: "short", year: "numeric" })}
                        </p>
                        {!m.is_owner && m.invite_code && (
                          <span className="text-[10px] font-mono text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded">
                            {m.invite_code}
                          </span>
                        )}
                      </div>
                    </div>
                    {!m.is_owner && (
                      <button
                        type="button"
                        onClick={() => handleRevokeM(m.member_user_id)}
                        disabled={revoking === m.member_user_id}
                        className="shrink-0 text-xs font-medium text-red-500 hover:text-red-700 dark:hover:text-red-400 disabled:opacity-40 transition-colors px-2 py-1 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/40"
                      >
                        {revoking === m.member_user_id ? "…" : "Kaldır"}
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* ── Active invite codes ── */}
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-2">
              Açık Davet Kodları {invites.length > 0 && <span className="normal-case">({invites.length})</span>}
            </p>

            {invites.length === 0 ? (
              <p className="text-xs text-gray-400 dark:text-gray-600 italic">Aktif kod yok</p>
            ) : (
              <ul className="divide-y divide-gray-100 dark:divide-gray-800">
                {invites.map((inv) => (
                  <li key={inv.invite_id} className="flex items-center gap-3 py-2.5">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-bold text-indigo-600 dark:text-indigo-400 tracking-widest">
                          {inv.code}
                        </span>
                        {inv.grants_role === "collaborator" ? (
                          <span className="text-[9px] font-medium px-1.5 py-0.5 rounded bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400">Ortak</span>
                        ) : (
                          <span className="text-[9px] font-medium px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400">Görüntüleyici</span>
                        )}
                      </div>
                      <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">
                        Son: {new Date(inv.expires_at).toLocaleString("tr-TR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRevokeI(inv.invite_id)}
                      disabled={revokingInvite === inv.invite_id}
                      className="shrink-0 text-xs font-medium text-red-500 hover:text-red-700 dark:hover:text-red-400 disabled:opacity-40 transition-colors px-2 py-1 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/40"
                    >
                      {revokingInvite === inv.invite_id ? "…" : "İptal"}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

        </div>
      </div>
    </div>
    </ModalPortal>
  );
}
