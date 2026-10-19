"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

const DEBOUNCE_MS = 300;

export default function SearchBar({ initialQuery }: { initialQuery: string }) {
  const router = useRouter();
  const [value, setValue] = useState(initialQuery);
  const isFirst = useRef(true);

  useEffect(() => {
    if (isFirst.current) {
      isFirst.current = false;
      return;
    }
    const timer = setTimeout(() => {
      const params = new URLSearchParams(window.location.search);
      const trimmed = value.trim();
      if (trimmed) params.set("q", trimmed);
      else params.delete("q");
      router.push(`/feed?${params.toString()}`);
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [value, router]);

  return (
    <div className="relative">
      {/* Search icon */}
      <svg
        className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.5}
      >
        <circle cx="11" cy="11" r="8" />
        <path d="m21 21-4.35-4.35" />
      </svg>

      <input
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        maxLength={200}
        placeholder="Ara..."
        aria-label="Search posts"
        className="input-sharp pl-10 pr-16 h-9 text-sm"
      />

      {/* Keyboard shortcut indicator */}
      <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 pointer-events-none">
        <kbd className="mono text-[10px] px-1.5 py-0.5 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-400">
          ⌘K
        </kbd>
      </div>
    </div>
  );
}
