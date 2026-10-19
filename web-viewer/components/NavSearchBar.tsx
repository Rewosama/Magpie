"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";

const DEBOUNCE_MS = 300;

export default function NavSearchBar() {
  const router = useRouter();
  const pathname = usePathname();
  const [value, setValue] = useState("");
  const isFirst = useRef(true);

  // Sync with URL on mount and route changes
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setValue(params.get("q") ?? "");
  }, [pathname]);

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

  // Only show on feed page
  if (pathname !== "/feed") return null;

  return (
    <div className="relative w-full max-w-md">
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
        className="w-full h-8 pl-9 pr-12 bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-600 transition-colors"
      />

      {/* Keyboard shortcut indicator */}
      <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none">
        <kbd className="mono text-[10px] px-1.5 py-0.5 bg-zinc-200 dark:bg-zinc-800 text-zinc-400">
          ⌘K
        </kbd>
      </div>
    </div>
  );
}
