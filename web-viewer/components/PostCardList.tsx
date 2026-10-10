"use client";
import { useRouter } from "next/navigation";
import React, {
  useState,
  useRef,
  useCallback,
  useEffect,
  useTransition,
} from "react";
import { ModalPortal } from "@/components/ModalPortal";
import type { FeedPost, PostCursor } from "@/lib/types";
import PostCard from "@/components/PostCard";
import { deletePosts, getPosts } from "@/app/actions";

// ── BulkDeleteDialog (unchanged) ──────────────────────────────────────────────

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
        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
        <div
          className="relative bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-[320px] p-6 flex flex-col gap-5 border border-gray-100 dark:border-gray-800"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-start gap-4">
            <div className="w-11 h-11 rounded-full bg-red-50 dark:bg-red-950/60 flex items-center justify-center shrink-0 ring-1 ring-red-100 dark:ring-red-900/40">
              <svg
                className="w-5 h-5 text-red-500"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                <path d="M10 11v6M14 11v6" />
                <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
              </svg>
            </div>
            <div className="pt-0.5">
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 leading-snug">
                {count} kaydı sil?
              </p>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
                Seçilen kayıtlar arşivinden kaldırılacak, geri alınamaz.
              </p>
            </div>
          </div>
          <div className="flex gap-2.5">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 px-4 py-2 text-sm font-medium rounded-xl border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              Vazgeç
            </button>
            <button
              type="button"
              onClick={onConfirm}
              className="flex-1 px-4 py-2 text-sm font-medium rounded-xl bg-red-500 hover:bg-red-600 active:bg-red-700 text-white transition-colors shadow-sm"
            >
              Sil
            </button>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}

// ── Spinner ────────────────────────────────────────────────────────────────────

function LoadingSpinner() {
  return (
    <div className="col-span-full flex justify-center py-8">
      <svg
        className="animate-spin w-6 h-6 text-indigo-500"
        viewBox="0 0 24 24"
        fill="none"
        aria-label="Yükleniyor"
        role="status"
      >
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
        />
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
        />
      </svg>
    </div>
  );
}

// ── PostCardList ───────────────────────────────────────────────────────────────

interface PostCardListProps {
  posts: FeedPost[];
  currentUserId?: string;
  isCollaborativeView?: boolean;
  /**
   * Cursor pointing to the next page returned by the server.
   * Null means all posts fit in the first page — infinite scroll is disabled.
   * Only meaningful in browse mode (no search query).
   */
  initialCursor?: PostCursor | null;
  /**
   * Active collection ID filter.  Passed through to getPosts() on scroll so
   * subsequent pages stay within the same collection.
   */
  collectionId?: string;
  /**
   * Active search query.  When set, posts are search results (ts_rank ordered,
   * no cursor pagination) and PostCard highlights matching terms.
   */
  searchQuery?: string;
  /** Owned collections passed through to each PostCard for the move-to-collection picker. */
  ownedCollections?: import("@/lib/types").Collection[];
}

export default function PostCardList({
  posts: initialPosts,
  currentUserId,
  isCollaborativeView = false,
  initialCursor = null,
  collectionId,
  searchQuery,
  ownedCollections,
}: PostCardListProps) {
  // ── Post state ───────────────────────────────────────────────────────────────
  const [posts, setPosts] = useState(initialPosts);
  const [cursor, setCursor] = useState<PostCursor | null>(initialCursor ?? null);
  const [hasMore, setHasMore] = useState(initialCursor !== null);
  const [loading, setLoading] = useState(false);
  // Ref prevents duplicate in-flight requests when observer fires repeatedly.
  const loadingRef = useRef(false);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Auto-refresh when switching back to this tab (e.g. after saving via extension)
  useEffect(() => {
    const onVisibility = () => { if (!document.hidden) router.refresh(); };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [router]);


  // ── Sync on URL navigation ───────────────────────────────────────────────────
  // When the server re-renders (collection / search param change), reset all
  // pagination state to match the new first page.
  const postsKey = JSON.stringify(initialPosts.map((p) => p.id));
  useEffect(() => {
    setPosts(initialPosts);
    setCursor(initialCursor ?? null);
    setHasMore(initialCursor !== null);
    loadingRef.current = false;
    setLoading(false);
    // postsKey captures identity; initialCursor changes with every navigation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postsKey]);

  // ── Infinite scroll ──────────────────────────────────────────────────────────
  const loadMore = useCallback(async () => {
    if (loadingRef.current || !cursor) return;
    loadingRef.current = true;
    setLoading(true);
    try {
      const result = await getPosts({ cursor, collectionId });
      if (!result.ok) return; // silent fail — user can scroll back up to retry
      setPosts((prev) => [...prev, ...result.data.posts]);
      setCursor(result.data.nextCursor);
      setHasMore(result.data.nextCursor !== null);
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, [cursor, collectionId]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !hasMore) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) loadMore();
      },
      // Pre-load next page when the sentinel is 400px below the viewport.
      { rootMargin: "0px 0px 400px 0px" }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, loadMore]);

  // ── Select / bulk-delete state ───────────────────────────────────────────────
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showDialog, setShowDialog] = useState(false);
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
    if (selectedIds.size === posts.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(posts.map((p) => p.id)));
    }
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
        setPosts((prev) => prev.filter((p) => !deleted.has(p.id)));
        setSelectedIds(new Set());
        setSelectMode(false);
      }
    });
  };

  const allSelected = posts.length > 0 && selectedIds.size === posts.length;

  // ── Move post handler ───────────────────────────────────────────────────────
  const handleMovePost = (
    postId: string,
    collectionId: string | null,
    collectionName: string | null,
  ) => {
    setPosts(prev =>
      prev.map(p =>
        p.id !== postId
          ? p
          : {
              ...p,
              collection_id: collectionId,
              collections: collectionName ? { name: collectionName } : null,
            }
      )
    );
  };

  // ── Empty state ──────────────────────────────────────────────────────────────
  if (posts.length === 0 && !loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="w-16 h-16 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-4">
          <svg
            className="w-8 h-8 text-gray-300 dark:text-gray-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
            />
          </svg>
        </div>
        <p className="text-base font-medium text-gray-500 dark:text-gray-400">
          No results found
        </p>
        <p className="text-sm text-gray-400 dark:text-gray-600 mt-1">
          Try adjusting your search or save some posts first.
        </p>
      </div>
    );
  }

  // ── Main render ──────────────────────────────────────────────────────────────
  return (
    <>
      {/* Toolbar row */}
      <div className="flex items-center justify-between min-h-[32px]">
        {selectMode ? (
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={toggleSelectAll}
              className="text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-200 transition-colors"
            >
              {allSelected ? "Seçimi kaldır" : "Tümünü seç"}
            </button>
            <span className="text-xs text-gray-400 dark:text-gray-600">
              {selectedIds.size > 0 ? `${selectedIds.size} seçildi` : ""}
            </span>
          </div>
        ) : (
          <span />
        )}

        {selectMode ? (
          <button
            type="button"
            onClick={exitSelectMode}
            className="flex items-center gap-1.5 text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
          >
            <svg
              className="w-4 h-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
            İptal
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setSelectMode(true)}
            className="flex items-center gap-1.5 text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            <svg
              className="w-3.5 h-3.5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="3" y="3" width="7" height="7" rx="1" />
              <rect x="14" y="3" width="7" height="7" rx="1" />
              <rect x="3" y="14" width="7" height="7" rx="1" />
              <rect x="14" y="14" width="7" height="7" rx="1" />
            </svg>
            Seç
          </button>
        )}
      </div>

      {/* Grid */}
      <ul
        className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 ${
          isPending ? "opacity-60 pointer-events-none" : ""
        }`}
      >
        {posts.map((post) => (
          <li key={post.id}>
            <PostCard
              post={post}
              selectMode={selectMode}
              isSelected={selectedIds.has(post.id)}
              onToggleSelect={() => toggleSelect(post.id)}
              currentUserId={currentUserId}
              isCollaborativeView={isCollaborativeView}
              searchQuery={searchQuery}
              ownedCollections={ownedCollections}
              onMovePost={handleMovePost}
            />
          </li>
        ))}

        {/* Infinite scroll loading indicator (inside grid so it fills a cell) */}
        {loading && <LoadingSpinner />}
      </ul>

      {/* Sentinel — IntersectionObserver watches this div to trigger next page */}
      {hasMore && (
        <div ref={sentinelRef} className="h-1 w-full" aria-hidden="true" />
      )}

      {/* Floating action bar */}
      {selectMode && selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-xl px-4 py-3 animate-in fade-in slide-in-from-bottom-2 duration-200">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300 tabular-nums">
            {selectedIds.size} kayıt seçildi
          </span>
          <div className="w-px h-4 bg-gray-200 dark:bg-gray-700" />
          <button
            type="button"
            onClick={() => setShowDialog(true)}
            className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-white bg-red-500 hover:bg-red-600 rounded-xl transition-colors shadow-sm"
          >
            <svg
              className="w-3.5 h-3.5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
            </svg>
            Sil
          </button>
        </div>
      )}

      {/* Bulk delete dialog */}
      {showDialog && (
        <BulkDeleteDialog
          count={selectedIds.size}
          onCancel={() => setShowDialog(false)}
          onConfirm={confirmBulkDelete}
        />
      )}
    </>
  );
}
