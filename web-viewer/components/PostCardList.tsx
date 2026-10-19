"use client";
import { usePathname, useSearchParams } from "next/navigation";
import React, {
  useState,
  useRef,
  useCallback,
  useEffect,
  useTransition,
  useMemo,
} from "react";
import dynamic from "next/dynamic";
import { ModalPortal } from "@/components/ModalPortal";
import type { FeedPost, PostCursor } from "@/lib/types";
import PostCard from "@/components/PostCard";
import { deletePosts, getPosts } from "@/app/actions";

const AddByUrlModal = dynamic(() => import("@/components/AddByUrlModal"), {
  ssr: false,
});

function BulkDeleteDialog({
  count,
  onCancel,
  onConfirm,
}: {
  count: number;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <ModalPortal>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        onClick={onCancel}
      >
        <div className="absolute inset-0 bg-black/60" />
        <div
          className="relative bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 w-full max-w-sm p-6 space-y-4"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="text-center space-y-2">
            <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
              {count} kaydı silmek istediğine emin misin?
            </p>
            <p className="mono text-zinc-500">Bu işlem geri alınamaz.</p>
          </div>
          <div className="flex gap-3">
            <button onClick={onCancel} className="btn-minimal flex-1">
              Vazgeç
            </button>
            <button onClick={onConfirm} className="btn-danger flex-1">
              Sil
            </button>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}

function LoadingSpinner() {
  return (
    <div className="col-span-full flex justify-center py-8">
      <div className="mono text-zinc-400">Yükleniyor...</div>
    </div>
  );
}

// Platform Filter Component (inline for client-side filtering)
function PlatformTabs({
  activePlatform,
  counts,
  onPlatformChange,
  rightContent,
}: {
  activePlatform?: string;
  counts: { all: number; instagram: number; x: number; threads: number };
  onPlatformChange: (platform: string | null) => void;
  rightContent?: React.ReactNode;
}) {
  const PLATFORMS = [
    { id: null, label: "TÜMÜ", count: counts.all },
    { id: "instagram", label: "INSTAGRAM", count: counts.instagram },
    { id: "x", label: "X", count: counts.x },
  ] as const;

  return (
    <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800">
      <div className="flex items-center gap-0">
        {PLATFORMS.map((platform) => {
          const isActive =
            platform.id === activePlatform || (!platform.id && !activePlatform);
          return (
            <button
              key={platform.id ?? "all"}
              onClick={() => onPlatformChange(platform.id)}
              className={`platform-tab ${isActive ? "platform-tab-active" : ""}`}
            >
              {platform.label}
              <span
                className={`ml-1.5 ${isActive ? "text-zinc-600 dark:text-zinc-400" : "text-zinc-400 dark:text-zinc-600"}`}
              >
                ({platform.count})
              </span>
            </button>
          );
        })}
      </div>
      {rightContent && <div className="flex items-center">{rightContent}</div>}
    </div>
  );
}

interface PostCardListProps {
  posts: FeedPost[];
  currentUserId?: string;
  currentUserEmail?: string;
  isCollaborativeView?: boolean;
  initialCursor?: PostCursor | null;
  collectionId?: string;
  searchQuery?: string;
  ownedCollections?: import("@/lib/types").Collection[];
  allTags?: import("@/lib/types").Tag[];
  activeTagId?: string;
  activePlatform?: "instagram" | "x" | "threads";
  platformCounts?: {
    all: number;
    instagram: number;
    x: number;
    threads: number;
  };
}

export default function PostCardList({
  posts: initialPosts,
  currentUserId,
  currentUserEmail = "",
  isCollaborativeView = false,
  initialCursor = null,
  collectionId,
  searchQuery,
  ownedCollections,
  allTags = [],
  activePlatform: serverActivePlatform,
  platformCounts,
}: PostCardListProps) {
  const [allPosts, setAllPosts] = useState(initialPosts);
  const [cursor, setCursor] = useState<PostCursor | null>(
    initialCursor ?? null,
  );
  const [hasMore, setHasMore] = useState(initialCursor !== null);
  const [loading, setLoading] = useState(false);
  const loadingRef = useRef(false);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Client-side platform filter state
  const [clientPlatform, setClientPlatform] = useState<string | undefined>(
    serverActivePlatform,
  );
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Note: Removed visibilitychange refresh - it was causing unnecessary reloads
  // when switching tabs. Data is already fresh from initial load.

  const postsKey = JSON.stringify(initialPosts.map((p) => p.id));
  useEffect(() => {
    setAllPosts(initialPosts);
    setCursor(initialCursor ?? null);
    setHasMore(initialCursor !== null);
    loadingRef.current = false;
    setLoading(false);
    setClientPlatform(serverActivePlatform);
  }, [postsKey, initialCursor, initialPosts, serverActivePlatform]);

  // Filter posts client-side
  const posts = useMemo(() => {
    if (!clientPlatform) return allPosts;
    return allPosts.filter((p) => p.platform === clientPlatform);
  }, [allPosts, clientPlatform]);

  // Calculate counts from all posts (always from client state for real-time updates)
  const counts = useMemo(() => {
    return {
      all: allPosts.length,
      instagram: allPosts.filter((p) => p.platform === "instagram").length,
      x: allPosts.filter((p) => p.platform === "x").length,
      threads: allPosts.filter((p) => p.platform === "threads").length,
    };
  }, [allPosts]);

  // Handle platform change with smooth transition
  const handlePlatformChange = useCallback(
    (platform: string | null) => {
      setIsTransitioning(true);

      // Update URL without navigation (shallow)
      const params = new URLSearchParams(searchParams.toString());
      if (platform) params.set("platform", platform);
      else params.delete("platform");

      window.history.replaceState(
        null,
        "",
        params.toString() ? `${pathname}?${params}` : pathname,
      );

      // Smooth transition
      setTimeout(() => {
        setClientPlatform(platform || undefined);
        setIsTransitioning(false);
      }, 150);
    },
    [pathname, searchParams],
  );

  const loadMore = useCallback(async () => {
    if (loadingRef.current || !cursor) return;
    loadingRef.current = true;
    setLoading(true);
    try {
      const result = await getPosts({
        cursor,
        collectionId,
        platform: clientPlatform as "instagram" | "x" | "threads" | undefined,
      });
      if (!result.ok) return;
      setAllPosts((prev) => [...prev, ...result.data.posts]);
      setCursor(result.data.nextCursor);
      setHasMore(result.data.nextCursor !== null);
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, [cursor, collectionId, clientPlatform]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !hasMore) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) loadMore();
      },
      { rootMargin: "0px 0px 400px 0px" },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, loadMore]);

  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showDialog, setShowDialog] = useState(false);
  const [showAddByUrl, setShowAddByUrl] = useState(false);
  const [isPending, startTransition] = useTransition();

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === posts.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(posts.map((p) => p.id)));
  };

  const exitSelectMode = () => {
    setSelectMode(false);
    setSelectedIds(new Set());
  };

  const confirmBulkDelete = () => {
    setShowDialog(false);
    startTransition(async () => {
      const ids = Array.from(selectedIds);
      const result = await deletePosts(ids);
      if (result.ok) {
        const deleted = new Set(ids);
        setAllPosts((prev) => prev.filter((p) => !deleted.has(p.id)));
        setSelectedIds(new Set());
        setSelectMode(false);
      }
    });
  };

  const handleMovePost = (
    postId: string,
    collectionId: string | null,
    collectionName: string | null,
  ) => {
    setAllPosts((prev) =>
      prev.map((p) =>
        p.id !== postId
          ? p
          : {
              ...p,
              collection_id: collectionId,
              collections: collectionName ? { name: collectionName } : null,
            },
      ),
    );
  };

  const handleSingleDelete = (postId: string) => {
    setAllPosts((prev) => prev.filter((p) => p.id !== postId));
  };

  const handleTagsChanged = (
    postId: string,
    tags: import("@/lib/types").Tag[],
  ) => {
    setAllPosts((prev) =>
      prev.map((p) => (p.id !== postId ? p : { ...p, tags })),
    );
  };

  const allSelected = posts.length > 0 && selectedIds.size === posts.length;

  // Toolbar content for PlatformFilter's right side
  const toolbarContent = selectMode ? (
    <div className="flex items-center gap-4">
      <button
        onClick={toggleSelectAll}
        className="mono text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
      >
        {allSelected ? "SEÇİMİ KALDIR" : "TÜMÜNÜ SEÇ"}
      </button>
      {selectedIds.size > 0 && (
        <span className="mono text-zinc-400">{selectedIds.size} seçili</span>
      )}
      <button
        onClick={exitSelectMode}
        className="mono text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 flex items-center gap-1.5"
      >
        <svg
          className="w-3.5 h-3.5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
        İPTAL
      </button>
    </div>
  ) : (
    <div className="flex items-center gap-3">
      {/* URL ile Ekle butonu */}
      <button
        onClick={() => setShowAddByUrl(true)}
        className="mono text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 flex items-center gap-1.5 transition-colors"
      >
        <svg
          className="w-3.5 h-3.5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
          <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
        </svg>
        <span className="hidden sm:inline">URL İLE EKLE</span>
        <span className="sm:hidden">+</span>
      </button>
      {posts.length > 0 && (
        <button
          onClick={() => setSelectMode(true)}
          className="mono text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 flex items-center gap-1.5 transition-colors"
        >
          <svg
            className="w-3.5 h-3.5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <rect x="3" y="3" width="7" height="7" />
            <rect x="14" y="3" width="7" height="7" />
            <rect x="3" y="14" width="7" height="7" />
            <rect x="14" y="14" width="7" height="7" />
          </svg>
          SEÇ
        </button>
      )}
    </div>
  );

  // Empty state
  if (posts.length === 0 && !loading) {
    return (
      <>
        {/* Platform Filter - always visible */}
        <PlatformTabs
          activePlatform={clientPlatform}
          counts={counts}
          onPlatformChange={handlePlatformChange}
          rightContent={toolbarContent}
        />

        <div
          className={`flex flex-col items-center justify-center py-24 text-center border border-dashed border-zinc-200 dark:border-zinc-800 transition-opacity duration-200 ${isTransitioning ? "opacity-50" : ""}`}
        >
          <div className="mono text-zinc-400 mb-2">POST YOK</div>
          <p className="text-xs text-zinc-500">
            Instagram veya X&apos;ten gönderi kaydedin.
          </p>
        </div>
      </>
    );
  }

  return (
    <>
      {/* Platform Filter with Toolbar */}
      <PlatformTabs
        activePlatform={clientPlatform}
        counts={counts}
        onPlatformChange={handlePlatformChange}
        rightContent={toolbarContent}
      />

      {/* Grid */}
      <ul
        className={`grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 transition-opacity duration-200 ${isTransitioning || isPending ? "opacity-50 pointer-events-none" : ""}`}
      >
        {posts.map((post) => (
          <li key={post.id}>
            <PostCard
              post={post}
              selectMode={selectMode}
              isSelected={selectedIds.has(post.id)}
              onToggleSelect={() => toggleSelect(post.id)}
              currentUserId={currentUserId}
              currentUserEmail={currentUserEmail}
              isCollaborativeView={isCollaborativeView}
              searchQuery={searchQuery}
              ownedCollections={ownedCollections}
              onMovePost={handleMovePost}
              onDeleted={handleSingleDelete}
              allTags={allTags}
              onTagsChanged={handleTagsChanged}
            />
          </li>
        ))}
        {loading && <LoadingSpinner />}
      </ul>

      {hasMore && (
        <div ref={sentinelRef} className="h-1 w-full" aria-hidden="true" />
      )}

      {/* Floating action bar */}
      {selectMode && selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 px-4 py-2.5">
          <span className="mono text-zinc-700 dark:text-zinc-300">
            {selectedIds.size} seçili
          </span>
          <div className="w-px h-4 bg-zinc-200 dark:bg-zinc-800" />
          <button
            onClick={() => setShowDialog(true)}
            className="btn-danger flex items-center gap-1.5"
          >
            <svg
              className="w-3.5 h-3.5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
            </svg>
            SİL
          </button>
        </div>
      )}

      {showDialog && (
        <BulkDeleteDialog
          count={selectedIds.size}
          onCancel={() => setShowDialog(false)}
          onConfirm={confirmBulkDelete}
        />
      )}

      {showAddByUrl && ownedCollections && (
        <AddByUrlModal
          collections={ownedCollections}
          onClose={() => setShowAddByUrl(false)}
          onSuccess={() => {
            // Sayfayı router ile yenile (soft navigation)
            // revalidatePath server action'da çağrılıyor, sadece modal'ı kapat
            setShowAddByUrl(false);
          }}
        />
      )}
    </>
  );
}
