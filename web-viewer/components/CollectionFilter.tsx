"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useState, useRef, useTransition } from "react";
import type { Collection, SharedCollection } from "@/lib/types";
import { renameCollection, setDefaultCollection, leaveCollection } from "@/app/actions";
import dynamic from "next/dynamic";

const ShareModal = dynamic(() => import("@/components/ShareModal"), { ssr: false });
const ManageMembersModal = dynamic(() => import("@/components/ManageMembersModal"), { ssr: false });
const JoinCollectionModal = dynamic(() => import("@/components/JoinCollectionModal"), { ssr: false });

interface CollectionFilterProps {
  ownedCollections: Collection[];
  sharedCollections: SharedCollection[];
  activeId?: string;
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
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isDefaultPending, startDefaultTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  const startEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setValue(c.name);
    setError(null);
    setEditing(true);
    setTimeout(() => inputRef.current?.select(), 50);
  };

  const cancelEdit = () => { setEditing(false); setValue(c.name); setError(null); };

  const saveEdit = () => {
    if (value.trim() === c.name) { cancelEdit(); return; }
    startTransition(async () => {
      const result = await renameCollection(c.id, value);
      if (error) setError(error);
      else { setEditing(false); setError(null); }
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") saveEdit();
    if (e.key === "Escape") cancelEdit();
  };

  if (editing) {
    return (
      <div className="px-3 py-1.5 space-y-1">
        <div className="flex items-center gap-1.5">
          <input ref={inputRef} type="text" value={value} onChange={(e) => setValue(e.target.value)} onKeyDown={handleKeyDown} maxLength={255} autoFocus
            className="flex-1 min-w-0 text-sm px-2 py-1 rounded-md border border-indigo-400 dark:border-indigo-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <button type="button" onClick={saveEdit} disabled={isPending} className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-200 p-1 disabled:opacity-40" aria-label="Save">
            {isPending ? (
              <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/></svg>
            ) : (
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            )}
          </button>
          <button type="button" onClick={cancelEdit} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1" aria-label="Cancel">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        {error && <p className="text-xs text-red-500 dark:text-red-400 px-1">{error}</p>}
      </div>
    );
  }

  const handleSetDefault = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (c.is_default) return;
    startDefaultTransition(async () => { await setDefaultCollection(c.id); });
  };

  return (
    <div className="group/item">
      <div className="flex items-center gap-1">
        {/* Default star */}
        <button type="button" onClick={handleSetDefault} disabled={c.is_default || isDefaultPending}
          aria-label={c.is_default ? `${c.name} varsayılan koleksiyon` : `${c.name} koleksiyonunu varsayılan yap`}
          title={c.is_default ? "Uzantı bu koleksiyona kaydediyor" : "Varsayılan olarak ayarla — uzantı buraya kaydeder"}
          className={`p-1 rounded shrink-0 transition-all ${c.is_default ? "text-amber-500 dark:text-amber-400 opacity-100" : "opacity-25 group-hover/item:opacity-100 text-gray-400 hover:text-amber-400 dark:text-gray-500 dark:hover:text-amber-400"}`}
        >
          {isDefaultPending ? (
            <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/></svg>
          ) : (
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill={c.is_default ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
            </svg>
          )}
        </button>

        {/* Name */}
        <button type="button" onClick={() => onNavigate(c.id)} aria-current={isActive ? "page" : undefined}
          className={`flex-1 min-w-0 text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors ${isActive ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300" : "text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"}`}
        >
          <span className="flex items-center gap-1.5 min-w-0">
            <span className="truncate">{c.name}</span>
            {c.is_default && (
              <span className="shrink-0 text-[8px] font-medium px-1 py-px rounded bg-amber-50 dark:bg-amber-900/20 text-amber-500 dark:text-amber-400">varsayılan</span>
            )}
          </span>
        </button>

        {/* Action buttons (hover) */}
        <div className="opacity-0 group-hover/item:opacity-100 flex items-center gap-0.5 transition-all">
          {/* Share */}
          <button type="button" onClick={(e) => { e.stopPropagation(); onShare(c); }} aria-label={`${c.name} koleksiyonunu paylaş`} title="Paylaş"
            className="p-1 rounded text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all shrink-0"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
            </svg>
          </button>
          {/* Manage members */}
          <button type="button" onClick={(e) => { e.stopPropagation(); onManage(c); }} aria-label={`${c.name} koleksiyonunun üyelerini yönet`} title="Üyeler"
            className="p-1 rounded text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all shrink-0"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
          </button>
          {/* Rename */}
          <button type="button" onClick={startEdit} aria-label={`${c.name} koleksiyonunu yeniden adlandır`}
            className="p-1 rounded text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all shrink-0"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
          </button>
        </div>
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
    <div className="group/item flex items-center gap-1">
      <button type="button" onClick={() => onNavigate(c.collection_id)} aria-current={isActive ? "page" : undefined}
        className={`flex-1 min-w-0 text-left px-3 py-2 rounded-lg transition-colors ${isActive ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300" : "text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"}`}
      >
        <div className="flex items-center gap-2 min-w-0">
          {isCollab ? (
            <svg className="w-3 h-3 shrink-0 text-indigo-400 dark:text-indigo-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
          ) : (
            <svg className="w-3 h-3 shrink-0 text-gray-400 dark:text-gray-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
            </svg>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium truncate">{c.collection_name}</p>
            <p className="text-[10px] text-gray-400 dark:text-gray-500 truncate">{c.owner_email}</p>
          </div>
        </div>
      </button>
      <div className="opacity-0 group-hover/item:opacity-100 flex items-center gap-0.5 transition-all">
        {/* Leave collection */}
        <button type="button" onClick={(e) => { e.stopPropagation(); onLeave(c.collection_id); }}
          aria-label="Koleksiyondan ayrıl" title="Ayrıl"
          className="p-1 rounded text-gray-400 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-all shrink-0"
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
            <polyline points="16 17 21 12 16 7"/>
            <line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
        </button>
      </div>
    </div>
  );
}

export default function CollectionFilter({ ownedCollections, sharedCollections, activeId }: CollectionFilterProps) {
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
      // Page will revalidate, sidebar will refresh
    });
  };

  function navigate(collectionId?: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (collectionId) params.set("collection", collectionId);
    else params.delete("collection");
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  const sorted = [...ownedCollections].sort((a, b) => (b.is_default ? 1 : 0) - (a.is_default ? 1 : 0));

  return (
    <>
      <aside className="w-52 shrink-0">
        <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 px-3 mb-2">Collections</p>
        <nav className="space-y-0.5">
          {/* All */}
          <button type="button" onClick={() => navigate()} aria-current={!activeId ? "page" : undefined}
            className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors ${!activeId ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300" : "text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"}`}
          >
            All
          </button>

          {/* Owned collections */}
          {sorted.length === 0 ? (
            <p className="px-3 py-2 text-xs text-gray-400 dark:text-gray-600 italic">Henüz koleksiyon yok</p>
          ) : (
            sorted.map((c) => (
              <CollectionItem key={c.id} c={c} isActive={activeId === c.id} onNavigate={navigate} onShare={setShareTarget} onManage={setManageTarget} />
            ))
          )}

          {/* Shared collections section */}
          {sharedCollections.length > 0 && (
            <>
              <div className="pt-3 pb-1 px-3">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">Paylaşılanlar</p>
              </div>
              {sharedCollections.map((c) => (
                <SharedCollectionItem key={c.collection_id} c={c} isActive={activeId === c.collection_id} onNavigate={navigate} onLeave={handleLeave} />
              ))}
            </>
          )}

          {/* Join button */}
          <div className="pt-3">
            <button type="button" onClick={() => setJoinOpen(true)}
              className="flex items-center gap-1.5 w-full px-3 py-1.5 text-xs font-medium text-gray-400 dark:text-gray-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-gray-50 dark:hover:bg-gray-800/50 rounded-lg transition-colors"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
              Koleksiyona Katıl
            </button>
          </div>
        </nav>
      </aside>

      {/* Modals */}
      {shareTarget && <ShareModal collectionId={shareTarget.id} collectionName={shareTarget.name} onClose={() => setShareTarget(null)} />}
      {manageTarget && <ManageMembersModal collectionId={manageTarget.id} collectionName={manageTarget.name} onClose={() => setManageTarget(null)} />}
      {joinOpen && <JoinCollectionModal onClose={() => setJoinOpen(false)} />}
    </>
  );
}
