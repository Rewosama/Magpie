"use client";

import { useEffect, useState, useTransition } from "react";
import {
  getCollectionMembers,
  revokeCollectionMember,
  getActiveInvites,
  revokeInviteCode,
} from "@/app/actions";
import type { CollectionMember, ActiveInvite } from "@/lib/types";
import { ModalPortal } from "@/components/ModalPortal";

interface ManageMembersModalProps {
  collectionId: string;
  collectionName: string;
  onClose: () => void;
}

export default function ManageMembersModal({
  collectionId,
  collectionName,
  onClose,
}: ManageMembersModalProps) {
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
      if (!invitesResult.ok) {
        /* silent fail for invites */
      } else setInvites(invitesResult.data.invites);
    });

    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [collectionId, onClose]);

  const handleRevokeM = (memberUserId: string) => {
    setRevoking(memberUserId);
    startTransition(async () => {
      const result = await revokeCollectionMember(collectionId, memberUserId);
      setRevoking(null);
      if (!result.ok) setError(result.error);
      else
        setMembers((prev) =>
          prev.filter((m) => m.member_user_id !== memberUserId),
        );
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
    if (role === "collaborator")
      return <span className="mono text-zinc-500 ml-2">ORTAK</span>;
    return <span className="mono text-zinc-500 ml-2">GÖRÜNTÜLEYICI</span>;
  };

  return (
    <ModalPortal>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <div className="absolute inset-0 bg-black/60" />
        <div
          className="relative bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 w-full max-w-md p-5 flex flex-col gap-4 max-h-[80vh] overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between shrink-0">
            <div>
              <h2 className="mono text-zinc-900 dark:text-zinc-100 uppercase tracking-wider">
                Üyeler ve Kodlar
              </h2>
              <p className="mono text-zinc-500 mt-0.5 truncate max-w-[260px]">
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

          {error && <p className="mono text-red-500 shrink-0">{error}</p>}

          <div className="overflow-y-auto flex flex-col gap-5 scrollbar-thin">
            {/* ── Members ── */}
            <div>
              <p className="sidebar-header">Üyeler</p>

              {loading ? (
                <div className="flex items-center justify-center py-6">
                  <span className="mono text-zinc-400">Yükleniyor...</span>
                </div>
              ) : members.length === 0 ? (
                <p className="mono text-zinc-500 italic">Henüz üye yok</p>
              ) : (
                <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {members.map((m) => (
                    <li
                      key={m.member_user_id}
                      className="flex items-center gap-3 py-2.5"
                    >
                      <div className="avatar-circle w-7 h-7 bg-zinc-200 dark:bg-zinc-800 shrink-0 flex items-center justify-center text-zinc-500 mono text-[10px]">
                        {m.email[0]?.toUpperCase() ?? "?"}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center">
                          <p className="text-xs font-medium text-zinc-800 dark:text-zinc-200 truncate max-w-[180px]">
                            {m.email}
                          </p>
                          {m.is_owner ? (
                            <span className="mono text-zinc-900 dark:text-zinc-100 ml-2">
                              SAHİP
                            </span>
                          ) : (
                            roleLabel(m.member_role)
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <p className="mono text-zinc-400">
                            {new Date(m.joined_at).toLocaleDateString("tr-TR", {
                              day: "2-digit",
                              month: "2-digit",
                              year: "2-digit",
                            })}
                          </p>
                          {!m.is_owner && m.invite_code && (
                            <span className="mono text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5">
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
                          className="mono text-red-500 hover:text-red-600 disabled:opacity-40 transition-colors"
                        >
                          {revoking === m.member_user_id ? "..." : "KALDIR"}
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* ── Active invite codes ── */}
            <div>
              <p className="sidebar-header">
                Açık Davet Kodları{" "}
                {invites.length > 0 && (
                  <span className="normal-case">({invites.length})</span>
                )}
              </p>

              {invites.length === 0 ? (
                <p className="mono text-zinc-500 italic">Aktif kod yok</p>
              ) : (
                <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {invites.map((inv) => (
                    <li
                      key={inv.invite_id}
                      className="flex items-center gap-3 py-2.5"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm font-bold text-zinc-900 dark:text-zinc-100 tracking-widest">
                            {inv.code}
                          </span>
                          <span className="mono text-zinc-500">
                            {inv.grants_role === "collaborator"
                              ? "ORTAK"
                              : "GÖRÜNTÜLEYICI"}
                          </span>
                        </div>
                        <p className="mono text-zinc-400 mt-0.5">
                          Son:{" "}
                          {new Date(inv.expires_at).toLocaleString("tr-TR", {
                            day: "numeric",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRevokeI(inv.invite_id)}
                        disabled={revokingInvite === inv.invite_id}
                        className="mono text-red-500 hover:text-red-600 disabled:opacity-40 transition-colors"
                      >
                        {revokingInvite === inv.invite_id ? "..." : "İPTAL"}
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
