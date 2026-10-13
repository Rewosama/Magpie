"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import type { TagWithCount } from "@/lib/types";
import { deleteTag } from "@/app/actions";

interface TagFilterProps {
  tags: TagWithCount[];
  activeTagId?: string;
}

export default function TagFilter({ tags, activeTagId }: TagFilterProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startDeleteTransition] = useTransition();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  function navigate(tagId?: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (tagId) params.set("tag", tagId);
    else params.delete("tag");
    router.push(params.toString() ? `${pathname}?${params}` : pathname);
  }

  function handleDelete(tagId: string, tagName: string) {
    if (!confirm(`"${tagName}" etiketini silmek istiyor musun?`)) return;
    setDeletingId(tagId);
    startDeleteTransition(async () => {
      await deleteTag(tagId);
      setDeletingId(null);
      if (activeTagId === tagId) navigate();
    });
  }

  if (tags.length === 0) return null;

  return (
    <div className="space-y-3">
      <p className="sidebar-header">Etiketler</p>
      <div className="space-y-1">
        {tags.map((tag) => {
          const isActive = activeTagId === tag.id;
          return (
            <div
              key={tag.id}
              className={`group flex items-center justify-between ${deletingId === tag.id ? "opacity-50" : ""}`}
            >
              <button
                onClick={() => navigate(isActive ? undefined : tag.id)}
                disabled={deletingId === tag.id}
                className={`flex items-center gap-2 px-0 py-1 transition-colors ${
                  isActive
                    ? "tag-active"
                    : "tag hover:text-zinc-700 dark:hover:text-zinc-200"
                }`}
              >
                <span className="mono">#{tag.name}</span>
                <span className="mono text-[10px] text-zinc-400 dark:text-zinc-500">
                  {tag.post_count}
                </span>
              </button>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete(tag.id, tag.name);
                }}
                disabled={deletingId === tag.id}
                className="p-1 text-zinc-300 dark:text-zinc-700 hover:text-red-500 dark:hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <svg
                  className="w-3 h-3"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
