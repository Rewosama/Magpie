"use client";
import { ModalPortal } from "@/components/ModalPortal";

import { useState, useTransition, useRef, useEffect, useCallback } from "react";
import type { Collection, Tag, PostComment } from "@/lib/types";
import {
  movePost,
  addTagToPost,
  removeTagFromPost,
  createTagAndAddToPost,
  getPostComments,
  addPostComment,
  deletePostComment,
} from "@/app/actions";
import type { FeedPost } from "@/lib/types";
import { deletePost } from "@/app/actions";

// ── Platform icons ────────────────────────────────────────────────────────────

function InstagramIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <rect
        x="2"
        y="2"
        width="20"
        height="20"
        rx="0"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="none"
      />
      <circle
        cx="12"
        cy="12"
        r="4.5"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="none"
      />
      <circle cx="17.5" cy="6.5" r="1" fill="currentColor" />
    </svg>
  );
}

function XIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.747l7.73-8.835L2.002 2.25h6.351l4.266 5.643L18.244 2.25z" />
    </svg>
  );
}

function ThreadsIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M12.186 24h-.007c-3.581-.024-6.334-1.205-8.184-3.509C2.35 18.44 1.5 15.586 1.472 12.01v-.017c.03-3.579.879-6.43 2.525-8.482C5.845 1.205 8.6.024 12.18 0h.014c2.746.02 5.043.725 6.826 2.098 1.677 1.29 2.858 3.13 3.509 5.467l-2.04.569c-1.104-3.96-3.898-5.984-8.304-6.015-2.91.022-5.11.936-6.54 2.717C4.307 6.504 3.616 8.914 3.59 12c.025 3.086.718 5.496 2.057 7.164 1.43 1.783 3.631 2.698 6.54 2.717 2.623-.02 4.358-.631 5.8-2.045 1.647-1.613 1.618-3.593 1.09-4.798-.31-.71-.873-1.3-1.634-1.75-.192 1.352-.622 2.446-1.284 3.272-.886 1.102-2.14 1.704-3.73 1.79-1.202.065-2.361-.218-3.259-.801-1.063-.689-1.685-1.74-1.752-2.96-.065-1.182.408-2.256 1.332-3.023.88-.73 2.082-1.18 3.48-1.304.996-.089 1.94-.04 2.818.136v-.02c-.005-1.263-.086-2.153-.503-2.786-.387-.588-1.048-.889-1.962-.897h-.04c-.748.005-1.512.205-1.87.549l-1.325-1.597c.705-.586 1.803-.98 3.166-1.003h.06c1.474.016 2.627.506 3.428 1.457.739.878 1.127 2.085 1.153 3.59v.137c1.113.453 2.005 1.089 2.653 1.903.847 1.064 1.277 2.416 1.242 3.912-.035 1.494-.527 2.84-1.47 4.012C19.452 22.428 16.61 23.978 12.186 24z" />
    </svg>
  );
}

// ── Utilities ─────────────────────────────────────────────────────────────────

function safeUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  return /^https?:\/\//i.test(url) ? url : null;
}

const POST_TYPE_LABELS: Record<string, string> = {
  post: "POST",
  reel: "REEL",
  story: "STORY",
  tweet: "TWEET",
  thread: "THREAD",
};

// ── DeleteDialog ──────────────────────────────────────────────────────────────

function DeleteDialog({
  onCancel,
  onConfirm,
}: {
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
              Bu kaydı silmek istediğine emin misin?
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

// ── CommentSection (Facebook-style comments) ──────────────────────────────────

interface CommentSectionProps {
  postId: string;
  currentUserEmail: string;
}

function CommentSection({ postId, currentUserEmail }: CommentSectionProps) {
  const [comments, setComments] = useState<PostComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [value, setValue] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [sending, setSending] = useState(false);
  const commentsEndRef = useRef<HTMLDivElement>(null);

  // Load comments on mount
  useEffect(() => {
    const loadComments = async () => {
      const result = await getPostComments(postId);
      if (result.ok) {
        setComments(result.data);
      }
      setLoading(false);
    };
    loadComments();
  }, [postId]);

  // Scroll to bottom when new comment added
  useEffect(() => {
    commentsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [comments.length]);

  const handleSubmit = async () => {
    if (!value.trim() || sending) return;
    setSending(true);
    const result = await addPostComment(postId, value.trim(), isPublic);
    setSending(false);
    if (result.ok) {
      setComments((prev) => [...prev, result.data]);
      setValue("");
    }
  };

  const handleDelete = async (commentId: string) => {
    const result = await deletePostComment(commentId);
    if (result.ok) {
      setComments((prev) => prev.filter((c) => c.id !== commentId));
    }
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (mins < 1) return "şimdi";
    if (mins < 60) return `${mins}dk`;
    if (hours < 24) return `${hours}sa`;
    if (days < 7) return `${days}g`;
    return date.toLocaleDateString("tr-TR", {
      day: "2-digit",
      month: "2-digit",
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <span className="mono text-zinc-400">...</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full min-h-[300px]">
      {/* Comments list - scrollable, takes remaining space */}
      <div className="flex-1 overflow-y-auto space-y-3 scrollbar-thin">
        {comments.length === 0 ? (
          <p className="mono text-zinc-400 text-center py-4">Henüz yorum yok</p>
        ) : (
          comments.map((comment) => (
            <div
              key={comment.id}
              className={`p-3 border ${
                comment.is_public
                  ? "border-zinc-200 dark:border-zinc-800"
                  : "border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50"
              }`}
            >
              <div className="flex items-start justify-between gap-2 mb-1">
                <div className="flex items-center gap-2 min-w-0">
                  {/* Privacy icon */}
                  {comment.is_public ? (
                    <svg
                      className="w-3 h-3 text-zinc-400 shrink-0"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <circle cx="12" cy="12" r="10" />
                      <line x1="2" y1="12" x2="22" y2="12" />
                      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                    </svg>
                  ) : (
                    <svg
                      className="w-3 h-3 text-zinc-400 shrink-0"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    </svg>
                  )}
                  {/* Email */}
                  <span className="mono text-zinc-500 truncate text-[11px]">
                    {comment.user_email}
                  </span>
                  {/* Time */}
                  <span className="mono text-zinc-400 text-[11px] shrink-0">
                    · {formatTime(comment.created_at)}
                  </span>
                </div>
                {/* Delete button - only for own comments */}
                {comment.user_email === currentUserEmail && (
                  <button
                    onClick={() => handleDelete(comment.id)}
                    className="text-zinc-400 hover:text-red-500 transition-colors shrink-0"
                  >
                    <svg
                      className="w-3 h-3"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                )}
              </div>
              <p className="text-sm text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap">
                {comment.content}
              </p>
            </div>
          ))
        )}
        <div ref={commentsEndRef} />
      </div>

      {/* Input area - always at bottom */}
      <div className="border-t border-zinc-200 dark:border-zinc-800 pt-3 mt-3 space-y-2 shrink-0">
        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSubmit();
            }
          }}
          placeholder={
            isPublic ? "Herkese açık yorum yaz..." : "Kişisel yorum yaz..."
          }
          maxLength={2000}
          rows={2}
          className="input-sharp resize-none text-sm w-full"
        />

        <div className="flex items-center justify-between">
          {/* Toggle */}
          <button
            type="button"
            onClick={() => setIsPublic(!isPublic)}
            className="flex items-center gap-2"
          >
            <div
              className={`relative w-8 h-4 border transition-colors ${
                isPublic
                  ? "bg-zinc-100 dark:bg-zinc-800 border-zinc-300 dark:border-zinc-600"
                  : "bg-zinc-800 dark:bg-zinc-200 border-zinc-800 dark:border-zinc-200"
              }`}
            >
              <span
                className={`absolute top-0.5 w-3 h-3 transition-all ${
                  isPublic
                    ? "left-4 bg-zinc-600 dark:bg-zinc-400"
                    : "left-0.5 bg-zinc-100 dark:bg-zinc-800"
                }`}
              />
            </div>
            <span className="mono text-zinc-500 text-[11px]">
              {isPublic ? "HERKESE AÇIK" : "KİŞİSEL"}
            </span>
          </button>

          <div className="flex items-center gap-3">
            <span className="mono text-zinc-400 text-[11px]">
              {value.length}/2000
            </span>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!value.trim() || sending}
              className="btn-primary px-3 py-1.5 disabled:opacity-40 flex items-center gap-1.5"
            >
              {sending ? (
                <span className="mono text-[11px]">...</span>
              ) : (
                <>
                  <svg
                    className="w-3.5 h-3.5"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <line x1="22" y1="2" x2="11" y2="13" />
                    <polygon points="22 2 15 22 11 13 2 9 22 2" />
                  </svg>
                  <span className="mono text-[11px]">GÖNDER</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── TagPicker (for modal) ─────────────────────────────────────────────────────

interface TagPickerProps {
  postId: string;
  currentTags: Tag[];
  allTags: Tag[];
  onTagAdded: (tag: Tag) => void;
  onTagRemoved: (tagId: string) => void;
}

function TagPicker({
  postId,
  currentTags,
  allTags,
  onTagAdded,
  onTagRemoved,
}: TagPickerProps) {
  const [query, setQuery] = useState("");
  const [isPending, startTransition] = useTransition();

  const currentTagIds = new Set(currentTags.map((t) => t.id));
  const availableTags = allTags.filter(
    (t) =>
      !currentTagIds.has(t.id) &&
      t.name.toLowerCase().includes(query.toLowerCase()),
  );
  const exactMatch = allTags.find(
    (t) => t.name.toLowerCase() === query.trim().toLowerCase(),
  );
  const showCreateOption = query.trim() && !exactMatch;

  const handleAddTag = (tag: Tag) => {
    startTransition(async () => {
      const result = await addTagToPost(postId, tag.id);
      if (result.ok) {
        onTagAdded(tag);
        setQuery("");
      }
    });
  };

  const handleCreateAndAdd = () => {
    if (!query.trim()) return;
    startTransition(async () => {
      const result = await createTagAndAddToPost(postId, query.trim());
      if (result.ok) {
        onTagAdded(result.data);
        setQuery("");
      }
    });
  };

  const handleRemoveTag = (tagId: string) => {
    startTransition(async () => {
      const result = await removeTagFromPost(postId, tagId);
      if (result.ok) onTagRemoved(tagId);
    });
  };

  return (
    <div className="space-y-3">
      {currentTags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {currentTags.map((tag) => (
            <span
              key={tag.id}
              className="inline-flex items-center gap-1.5 mono text-zinc-700 dark:text-zinc-300"
            >
              #{tag.name}
              <button
                onClick={() => handleRemoveTag(tag.id)}
                disabled={isPending}
                className="text-zinc-400 hover:text-red-500 transition-colors"
              >
                <svg
                  className="w-3 h-3"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </span>
          ))}
        </div>
      )}
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) =>
          e.key === "Enter" && showCreateOption && handleCreateAndAdd()
        }
        placeholder="Etiket ara veya oluştur..."
        className="input-sharp text-sm"
      />
      {(availableTags.length > 0 || showCreateOption) && (
        <div className="border border-zinc-200 dark:border-zinc-800 overflow-hidden">
          {showCreateOption && (
            <button
              onClick={handleCreateAndAdd}
              disabled={isPending}
              className="w-full text-left px-3 py-2 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800 flex items-center gap-2"
            >
              <span className="mono">+</span>
              <span className="mono">#{query.trim()}</span>
              <span className="mono text-zinc-400">oluştur</span>
            </button>
          )}
          {availableTags.slice(0, 5).map((tag) => (
            <button
              key={tag.id}
              onClick={() => handleAddTag(tag)}
              disabled={isPending}
              className="w-full text-left px-3 py-2 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800 mono text-zinc-600 dark:text-zinc-400"
            >
              #{tag.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── PostDetailModal (ultra-minimalist) ────────────────────────────────────────

interface PostDetailModalProps {
  post: FeedPost;
  onClose: () => void;
  isOwnPost: boolean;
  allTags: Tag[];
  localTags: Tag[];
  onTagAdded: (tag: Tag) => void;
  onTagRemoved: (tagId: string) => void;
  thumbnailUrl: string | null;
  onDelete: () => void;
  currentUserEmail: string;
}

function PostDetailModal({
  post,
  onClose,
  isOwnPost,
  allTags,
  localTags,
  onTagAdded,
  onTagRemoved,
  thumbnailUrl,
  onDelete,
  currentUserEmail,
}: PostDetailModalProps) {
  const [activeTab, setActiveTab] = useState<"content" | "comments" | "tags">(
    "content",
  );
  const [thumbError, setThumbError] = useState(false);

  const contentText = post.content_text ?? "";
  const displayName = post.author_display_name || post.author_username;
  const actualThumbnail = thumbError ? null : thumbnailUrl;

  const date = new Date(post.saved_at).toLocaleDateString("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  const time = new Date(post.saved_at).toLocaleTimeString("tr-TR", {
    hour: "2-digit",
    minute: "2-digit",
  });

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, [onClose]);

  return (
    <ModalPortal>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <div className="absolute inset-0 bg-black/70" />

        <div
          className="relative bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col md:flex-row"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Left: Media */}
          <div className="md:w-1/2 bg-zinc-100 dark:bg-zinc-950 flex items-center justify-center min-h-[200px] md:min-h-0 border-r border-zinc-200 dark:border-zinc-800">
            {actualThumbnail ? (
              <img
                src={actualThumbnail}
                alt=""
                onError={() => setThumbError(true)}
                className="w-full h-full object-contain max-h-[40vh] md:max-h-[90vh]"
              />
            ) : (
              <div className="text-zinc-300 dark:text-zinc-700 p-8">
                {post.platform === "instagram" ? (
                  <InstagramIcon className="w-16 h-16" />
                ) : post.platform === "threads" ? (
                  <ThreadsIcon className="w-16 h-16" />
                ) : (
                  <XIcon className="w-16 h-16" />
                )}
              </div>
            )}
          </div>

          {/* Right: Content */}
          <div className="md:w-1/2 flex flex-col max-h-[50vh] md:max-h-[90vh]">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-200 dark:border-zinc-800">
              <div className="flex items-center gap-3">
                <div className="avatar-circle w-8 h-8 bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center text-zinc-500 mono text-xs">
                  {displayName?.[0]?.toUpperCase() ?? "?"}
                </div>
                <div>
                  <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                    {displayName || "Bilinmeyen"}
                  </p>
                  <p className="mono text-zinc-500">
                    {date} · {time}
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
              >
                <svg
                  className="w-5 h-5"
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

            {/* Tabs */}
            {isOwnPost && (
              <div className="flex border-b border-zinc-200 dark:border-zinc-800">
                {[
                  { id: "content", label: "İÇERİK" },
                  { id: "comments", label: "YORUMLAR" },
                  {
                    id: "tags",
                    label: "ETİKETLER",
                    badge: localTags.length > 0 ? localTags.length : null,
                  },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as typeof activeTab)}
                    className={`flex-1 px-4 py-2.5 mono uppercase tracking-wider transition-colors relative ${
                      activeTab === tab.id
                        ? "text-zinc-900 dark:text-zinc-100"
                        : "text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
                    }`}
                  >
                    {tab.label}
                    {tab.badge && (
                      <span className="ml-1 text-zinc-500">{tab.badge}</span>
                    )}
                    {activeTab === tab.id && (
                      <div className="absolute bottom-0 left-0 right-0 h-px bg-zinc-900 dark:bg-zinc-100" />
                    )}
                  </button>
                ))}
              </div>
            )}

            {/* Content */}
            <div
              className={`flex-1 overflow-y-auto p-4 scrollbar-thin ${activeTab === "comments" ? "flex flex-col" : ""}`}
            >
              {activeTab === "content" && (
                <div className="space-y-4">
                  {contentText ? (
                    <p className="text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed whitespace-pre-wrap">
                      {contentText}
                    </p>
                  ) : (
                    <p className="text-sm text-zinc-400 italic">İçerik yok</p>
                  )}

                  {localTags.length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                      {localTags.map((tag) => (
                        <span key={tag.id} className="mono text-zinc-500">
                          #{tag.name}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {activeTab === "comments" && isOwnPost && (
                <CommentSection
                  postId={post.id}
                  currentUserEmail={currentUserEmail}
                />
              )}

              {activeTab === "tags" && isOwnPost && (
                <TagPicker
                  postId={post.id}
                  currentTags={localTags}
                  allTags={allTags}
                  onTagAdded={onTagAdded}
                  onTagRemoved={onTagRemoved}
                />
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between px-4 py-3 border-t border-zinc-200 dark:border-zinc-800">
              {isOwnPost ? (
                <button
                  onClick={onDelete}
                  className="mono text-red-500 hover:text-red-600 flex items-center gap-1.5"
                >
                  <svg
                    className="w-4 h-4"
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
              ) : (
                <span />
              )}

              {safeUrl(post.post_url) && (
                <a
                  href={safeUrl(post.post_url)!}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mono text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 flex items-center gap-1.5"
                >
                  ORİJİNALİ AÇ
                  <svg
                    className="w-4 h-4"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                  >
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                    <polyline points="15 3 21 3 21 9" />
                    <line x1="10" y1="14" x2="21" y2="3" />
                  </svg>
                </a>
              )}
            </div>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}

// ── PostCard (archive style) ──────────────────────────────────────────────────

interface PostCardProps {
  post: FeedPost;
  selectMode?: boolean;
  isSelected?: boolean;
  onToggleSelect?: () => void;
  currentUserId?: string;
  currentUserEmail?: string;
  isCollaborativeView?: boolean;
  searchQuery?: string;
  ownedCollections?: Collection[];
  onMovePost?: (
    postId: string,
    collectionId: string | null,
    collectionName: string | null,
  ) => void;
  onDeleted?: (postId: string) => void;
  allTags?: Tag[];
  onTagsChanged?: (postId: string, tags: Tag[]) => void;
}

export default function PostCard({
  post,
  selectMode = false,
  isSelected = false,
  onToggleSelect,
  currentUserId,
  currentUserEmail = "",
  isCollaborativeView = false,
  ownedCollections,
  onMovePost,
  onDeleted,
  allTags = [],
  onTagsChanged,
}: PostCardProps) {
  const [isPending, startTransition] = useTransition();
  const [deleted, setDeleted] = useState(false);
  const [thumbError, setThumbError] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showCollectionPicker, setShowCollectionPicker] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [movePending, startMoveTransition] = useTransition();
  const [localTags, setLocalTags] = useState<Tag[]>(post.tags ?? []);

  const thumbnailUrl = thumbError
    ? null
    : safeUrl(post.thumbnail_url ?? post.media_urls?.[0] ?? null);
  const contentText = post.content_text ?? "";
  const displayName = post.author_display_name || post.author_username;
  const isOwnPost = post.user_id === currentUserId;
  const postTypeLabel = post.post_type
    ? (POST_TYPE_LABELS[post.post_type] ?? post.post_type.toUpperCase())
    : null;

  const date = new Date(post.saved_at).toLocaleDateString("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  });

  const confirmDelete = () => {
    setShowDeleteDialog(false);
    setShowDetailModal(false);
    startTransition(async () => {
      const result = await deletePost(post.id);
      if (result.ok) {
        setDeleted(true);
        onDeleted?.(post.id);
      }
    });
  };

  const handleCollectionChange = (collectionId: string | null) => {
    setShowCollectionPicker(false);
    const col = collectionId
      ? ownedCollections?.find((c) => c.id === collectionId)
      : null;
    startMoveTransition(async () => {
      const result = await movePost(post.id, collectionId);
      if (result.ok) onMovePost?.(post.id, collectionId, col?.name ?? null);
    });
  };

  const handleTagAdded = (tag: Tag) => {
    const newTags = [...localTags, tag];
    setLocalTags(newTags);
    onTagsChanged?.(post.id, newTags);
  };

  const handleTagRemoved = (tagId: string) => {
    const newTags = localTags.filter((t) => t.id !== tagId);
    setLocalTags(newTags);
    onTagsChanged?.(post.id, newTags);
  };

  if (deleted) return null;

  return (
    <div className="relative h-full">
      {showDeleteDialog && (
        <DeleteDialog
          onCancel={() => setShowDeleteDialog(false)}
          onConfirm={confirmDelete}
        />
      )}

      {showDetailModal && (
        <PostDetailModal
          post={post}
          onClose={() => setShowDetailModal(false)}
          isOwnPost={isOwnPost}
          allTags={allTags}
          localTags={localTags}
          onTagAdded={handleTagAdded}
          onTagRemoved={handleTagRemoved}
          thumbnailUrl={thumbnailUrl}
          onDelete={() => setShowDeleteDialog(true)}
          currentUserEmail={currentUserEmail}
        />
      )}

      <article
        onClick={() =>
          selectMode ? onToggleSelect?.() : setShowDetailModal(true)
        }
        className={`group relative flex flex-col archive-card cursor-pointer transition-all duration-150 h-full ${
          isSelected ? "border-zinc-900 dark:border-zinc-100" : ""
        } ${isPending ? "opacity-50 pointer-events-none" : "hover:border-zinc-400 dark:hover:border-zinc-600"}`}
      >
        {/* Select checkbox */}
        {selectMode && (
          <div
            className={`absolute top-2 right-2 z-10 w-5 h-5 border flex items-center justify-center transition-all ${
              isSelected
                ? "bg-zinc-900 dark:bg-zinc-100 border-zinc-900 dark:border-zinc-100"
                : "bg-white dark:bg-zinc-900 border-zinc-300 dark:border-zinc-700"
            }`}
          >
            {isSelected && (
              <svg
                className="w-3 h-3 text-white dark:text-zinc-900"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
            )}
          </div>
        )}

        {/* Delete button */}
        {!selectMode && (!isCollaborativeView || isOwnPost) && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowDeleteDialog(true);
            }}
            className="absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100 w-6 h-6 flex items-center justify-center bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-400 hover:text-red-500 hover:border-red-500 transition-all"
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
          </button>
        )}

        {/* Thumbnail */}
        <div className="aspect-square bg-zinc-100 dark:bg-zinc-900 overflow-hidden relative border-b border-zinc-200 dark:border-zinc-800">
          {thumbnailUrl ? (
            <img
              src={thumbnailUrl}
              alt=""
              onError={() => setThumbError(true)}
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-zinc-300 dark:text-zinc-700">
              {post.platform === "instagram" ? (
                <InstagramIcon className="w-10 h-10" />
              ) : post.platform === "threads" ? (
                <ThreadsIcon className="w-10 h-10" />
              ) : (
                <XIcon className="w-10 h-10" />
              )}
            </div>
          )}

          {/* Type badge */}
          {postTypeLabel && (
            <div className="absolute top-2 left-2 mono text-[10px] bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 px-1.5 py-0.5">
              {postTypeLabel}
            </div>
          )}

          {/* Platform icon */}
          <div className="absolute bottom-2 left-2 w-6 h-6 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 flex items-center justify-center">
            {post.platform === "instagram" ? (
              <InstagramIcon className="w-3.5 h-3.5 text-zinc-600 dark:text-zinc-400" />
            ) : post.platform === "threads" ? (
              <ThreadsIcon className="w-3.5 h-3.5 text-zinc-600 dark:text-zinc-400" />
            ) : (
              <XIcon className="w-3.5 h-3.5 text-zinc-600 dark:text-zinc-400" />
            )}
          </div>
        </div>

        {/* Content */}
        <div className="p-3 flex flex-col h-[150px]">
          {/* Tags */}
          {localTags.length > 0 && (
            <div className="flex flex-wrap gap-x-2 gap-y-1 mb-1">
              {localTags.slice(0, 3).map((tag) => (
                <span key={tag.id} className="mono text-zinc-400">
                  #{tag.name}
                </span>
              ))}
              {localTags.length > 3 && (
                <span className="mono text-zinc-400">
                  +{localTags.length - 3}
                </span>
              )}
            </div>
          )}

          {/* Divider */}
          <div className="border-t border-zinc-100 dark:border-zinc-800 my-1" />

          {/* Author + Date */}
          <div className="flex items-center justify-between gap-2 mb-1">
            <p className="text-xs font-medium text-zinc-900 dark:text-zinc-100 truncate flex-1">
              @{displayName || "bilinmeyen"}
            </p>
            <span className="mono text-zinc-400 shrink-0">{date}</span>
          </div>

          {/* Caption */}
          <p className="text-xs text-zinc-500 dark:text-zinc-400 line-clamp-3 flex-1">
            {contentText || <span className="italic">İçerik yok</span>}
          </p>

          {/* Divider */}
          <div className="border-t border-zinc-100 dark:border-zinc-800 my-1" />

          {/* Collection */}
          <div className="flex items-center justify-between">
            {!selectMode && ownedCollections && ownedCollections.length > 0 ? (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowCollectionPicker((v) => !v);
                }}
                disabled={movePending}
                className="mono text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 truncate max-w-[120px] flex items-center gap-1"
              >
                <span className="truncate">
                  {post.collections?.name ?? "—"}
                </span>
                <svg
                  className={`w-3 h-3 shrink-0 transition-transform ${showCollectionPicker ? "rotate-180" : ""}`}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>
            ) : post.collections?.name ? (
              <span className="mono text-zinc-400 truncate max-w-[120px]">
                {post.collections.name}
              </span>
            ) : (
              <span className="mono text-zinc-400">—</span>
            )}
          </div>
        </div>
      </article>

      {/* Collection picker */}
      {showCollectionPicker && !selectMode && ownedCollections && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setShowCollectionPicker(false)}
          />
          <div className="absolute bottom-14 left-0 z-50 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 py-1 min-w-[140px]">
            {ownedCollections.map((col) => (
              <button
                key={col.id}
                onClick={() => handleCollectionChange(col.id)}
                className={`w-full text-left px-3 py-1.5 text-xs hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors ${
                  post.collection_id === col.id
                    ? "text-zinc-900 dark:text-zinc-100 font-medium"
                    : "text-zinc-600 dark:text-zinc-400"
                }`}
              >
                {col.name}
                {col.is_default && <span className="ml-1">★</span>}
              </button>
            ))}
            <div className="mx-2 my-1 border-t border-zinc-100 dark:border-zinc-800" />
            <button
              onClick={() => handleCollectionChange(null)}
              className={`w-full text-left px-3 py-1.5 text-xs hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors ${
                !post.collection_id
                  ? "text-zinc-900 dark:text-zinc-100 font-medium"
                  : "text-zinc-500"
              }`}
            >
              Koleksiyonsuz
            </button>
          </div>
        </>
      )}
    </div>
  );
}
