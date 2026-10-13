"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useState, useRef, useTransition } from "react";
import type { Collection, SharedCollection, TagWithCount } from "@/lib/types";
import {
  renameCollection,
  setDefaultCollection,
  leaveCollection,
} from "@/app/actions";
import dynamic from "next/dynamic";
import TagFilter from "@/components/TagFilter";

const ShareModal = dynamic(() => import("@/components/ShareModal"), {
  ssr: false,
});
const ManageMembersModal = dynamic(
  () => import("@/components/ManageMembersModal"),
  { ssr: false },
);
const JoinCollectionModal = dynamic(
  () => import("@/components/JoinCollectionModal"),
  { ssr: false },
);

interface CollectionFilterProps {
  ownedCollections: Collection[];
  sharedCollections: SharedCollection[];
  activeId?: string;
  tags?: TagWithCount[];
  activeTagId?: string;
}

function CollectionItem({
  c,
  isActive,
  onNavigate,
  onShare,
  onManage,
}: {
  c: Collection;
  isActive: boolean;
  onNavigate: (id: string) => void;
  onShare: (c: Collection) => void;
  onManage: (c: Collection) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(c.name);
  const [isPending, startTransition] = useTransition();
  const [isDefaultPending, startDefaultTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  const startEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setValue(c.name);
    setEditing(true);
    setTimeout(() => inputRef.current?.select(), 50);
  };

  const cancelEdit = () => {
    setEditing(false);
    setValue(c.name);
  };

  const saveEdit = () => {
    if (value.trim() === c.name) {
      cancelEdit();
      return;
    }
    startTransition(async () => {
      await renameCollection(c.id, value);
      setEditing(false);
    });
  };

  const handleSetDefault = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (c.is_default) return;
    startDefaultTransition(async () => {
      await setDefaultCollection(c.id);
    });
  };

  if (editing) {
    return (
      <div className="py-1">
        <div className="flex items-center gap-1">
          <input
            ref={inputRef}
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") saveEdit();
              if (e.key === "Escape") cancelEdit();
            }}
            maxLength={255}
            autoFocus
            className="input-sharp flex-1 min-w-0 text-xs py-1"
          />
          <button
            onClick={saveEdit}
            disabled={isPending}
            className="p-1 text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
          >
            <svg
              className="w-3.5 h-3.5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </button>
          <button
            onClick={cancelEdit}
            className="p-1 text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
          >
            <svg
              className="w-3.5 h-3.5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="group flex items-center gap-1">
      {/* Star for default */}
      <button
        onClick={handleSetDefault}
        disabled={c.is_default || isDefaultPending}
        className={`p-0.5 transition-colors ${
          c.is_default
            ? "text-zinc-900 dark:text-zinc-100"
            : "text-zinc-300 dark:text-zinc-700 opacity-0 group-hover:opacity-100 hover:text-zinc-500"
        }`}
      >
        <svg
          className="w-3 h-3"
          viewBox="0 0 24 24"
          fill={c.is_default ? "currentColor" : "none"}
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
      </button>

      {/* Name */}
      <button
        onClick={() => onNavigate(c.id)}
        className={`flex-1 text-left py-1.5 text-xs transition-colors truncate ${
          isActive
            ? "text-zinc-900 dark:text-zinc-100 font-medium"
            : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
        }`}
      >
        {c.name}
      </button>

      {/* Actions */}
      <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 transition-opacity">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onShare(c);
          }}
          className="p-1 text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
        >
          <svg
            className="w-3 h-3"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <circle cx="18" cy="5" r="3" />
            <circle cx="6" cy="12" r="3" />
            <circle cx="18" cy="19" r="3" />
            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
            <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
          </svg>
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onManage(c);
          }}
          className="p-1 text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
        >
          <svg
            className="w-3 h-3"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
        </button>
        <button
          onClick={startEdit}
          className="p-1 text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
        >
          <svg
            className="w-3 h-3"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
          </svg>
        </button>
      </div>
    </div>
  );
}

function SharedCollectionItem({
  c,
  isActive,
  onNavigate,
  onLeave,
}: {
  c: SharedCollection;
  isActive: boolean;
  onNavigate: (id: string) => void;
  onLeave: (id: string) => void;
}) {
  const isCollab = c.member_role === "collaborator";

  return (
    <div className="group flex items-center gap-1">
      <button
        onClick={() => onNavigate(c.collection_id)}
        className={`flex-1 text-left py-1.5 transition-colors ${
          isActive
            ? "text-zinc-900 dark:text-zinc-100"
            : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
        }`}
      >
        <div className="flex items-center gap-2">
          <svg
            className={`w-3 h-3 shrink-0 ${isCollab ? "text-zinc-600 dark:text-zinc-400" : "text-zinc-400 dark:text-zinc-600"}`}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            {isCollab ? (
              <>
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </>
            ) : (
              <>
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </>
            )}
          </svg>
          <div className="min-w-0 flex-1">
            <p className={`text-xs truncate ${isActive ? "font-medium" : ""}`}>
              {c.collection_name}
            </p>
            <p className="mono text-[10px] text-zinc-400 truncate">
              {c.owner_email}
            </p>
          </div>
        </div>
      </button>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onLeave(c.collection_id);
        }}
        className="p-1 text-zinc-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <svg
          className="w-3 h-3"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
          <polyline points="16 17 21 12 16 7" />
          <line x1="21" y1="12" x2="9" y2="12" />
        </svg>
      </button>
    </div>
  );
}

export default function CollectionFilter({
  ownedCollections,
  sharedCollections,
  activeId,
  tags = [],
  activeTagId,
}: CollectionFilterProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [shareTarget, setShareTarget] = useState<Collection | null>(null);
  const [manageTarget, setManageTarget] = useState<Collection | null>(null);
  const [joinOpen, setJoinOpen] = useState(false);
  const [, startLeaveTransition] = useTransition();

  const handleLeave = (collectionId: string) => {
    if (!confirm("Bu koleksiyondan ayrılmak istiyor musun?")) return;
    startLeaveTransition(async () => {
      await leaveCollection(collectionId);
    });
  };

  function navigate(collectionId?: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (collectionId) params.set("collection", collectionId);
    else params.delete("collection");
    params.delete("tag");
    router.push(params.toString() ? `${pathname}?${params}` : pathname);
  }

  const sorted = [...ownedCollections].sort(
    (a, b) => (b.is_default ? 1 : 0) - (a.is_default ? 1 : 0),
  );

  return (
    <>
      <aside
        className="w-48 shrink-0 flex flex-col"
        style={{ minHeight: "calc(100vh - 6rem)" }}
      >
        <div className="flex-1 space-y-8">
          {/* Collections */}
          <div className="space-y-3">
            <p className="sidebar-header">Koleksiyonlar</p>
            <nav className="space-y-0.5">
              {/* All */}
              <button
                onClick={() => navigate()}
                className={`w-full text-left py-1.5 text-xs transition-colors ${
                  !activeId
                    ? "text-zinc-900 dark:text-zinc-100 font-medium"
                    : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
                }`}
              >
                Tümü
              </button>

              {sorted.length === 0 ? (
                <p className="py-2 text-xs text-zinc-400 italic">
                  Henüz koleksiyon yok
                </p>
              ) : (
                sorted.map((c) => (
                  <CollectionItem
                    key={c.id}
                    c={c}
                    isActive={activeId === c.id}
                    onNavigate={navigate}
                    onShare={setShareTarget}
                    onManage={setManageTarget}
                  />
                ))
              )}

              {/* Shared */}
              {sharedCollections.length > 0 && (
                <div className="pt-4 space-y-0.5">
                  <p className="sidebar-header">Paylaşılan</p>
                  {sharedCollections.map((c) => (
                    <SharedCollectionItem
                      key={c.collection_id}
                      c={c}
                      isActive={activeId === c.collection_id}
                      onNavigate={navigate}
                      onLeave={handleLeave}
                    />
                  ))}
                </div>
              )}

              {/* Join - Dashed button */}
              <div className="pt-4">
                <button
                  onClick={() => setJoinOpen(true)}
                  className="dashed-button w-full flex items-center justify-center gap-1.5 py-2 text-xs"
                >
                  <span className="mono">+</span>
                  <span>KOLEKSİYONA KATIL</span>
                </button>
              </div>
            </nav>
          </div>

          {/* Tags */}
          <TagFilter tags={tags} activeTagId={activeTagId} />
        </div>

        {/* Bottom buttons - Destek & Discord */}
        <div className="pt-4 flex gap-2 border-t border-zinc-200 dark:border-zinc-800 mt-8">
          <a
            href="https://donate.bynogame.com/rewou"
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 flex items-center justify-center gap-1.5 py-2 text-[10px] text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors border border-zinc-200 dark:border-zinc-800"
          >
            <svg
              className="w-3 h-3"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
            </svg>
            <span>Destek</span>
          </a>
          <a
            href="https://discord.com/invite/qg6snV6skE"
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 flex items-center justify-center gap-1.5 py-2 text-[10px] text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors border border-zinc-200 dark:border-zinc-800"
          >
            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
              <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
            </svg>
            <span>Discord</span>
          </a>
        </div>
      </aside>

      {shareTarget && (
        <ShareModal
          collectionId={shareTarget.id}
          collectionName={shareTarget.name}
          onClose={() => setShareTarget(null)}
        />
      )}
      {manageTarget && (
        <ManageMembersModal
          collectionId={manageTarget.id}
          collectionName={manageTarget.name}
          onClose={() => setManageTarget(null)}
        />
      )}
      {joinOpen && <JoinCollectionModal onClose={() => setJoinOpen(false)} />}
    </>
  );
}
