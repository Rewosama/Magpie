"use client";

/**
 * MobileSidebar
 *
 * Slide-out sidebar for mobile devices.
 * Contains collections and tags filter, matches desktop sidebar functionality.
 */

import { useState, useEffect, useCallback } from "react";
import { usePathname } from "next/navigation";
import CollectionFilter from "@/components/CollectionFilter";
import type { Collection, SharedCollection, TagWithCount } from "@/lib/types";

interface MobileSidebarProps {
  ownedCollections: Collection[];
  sharedCollections: SharedCollection[];
  activeCollectionId?: string;
  tags?: TagWithCount[];
  activeTagId?: string;
}

export default function MobileSidebar({
  ownedCollections,
  sharedCollections,
  activeCollectionId,
  tags = [],
  activeTagId,
}: MobileSidebarProps) {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();

  // Close on navigation
  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  // Close on escape key
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false);
    };
    if (isOpen) {
      document.addEventListener("keydown", handleEsc);
      // Prevent body scroll when open
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handleEsc);
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  const toggle = useCallback(() => setIsOpen((prev) => !prev), []);

  return (
    <>
      {/* Hamburger Button - only visible on mobile */}
      <button
        onClick={toggle}
        className="md:hidden fixed bottom-6 left-6 z-50 w-12 h-12 flex items-center justify-center bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 shadow-lg touch-target no-select"
        aria-label="Koleksiyonlar menüsünü aç"
        aria-expanded={isOpen}
      >
        {isOpen ? (
          <svg
            className="w-5 h-5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        ) : (
          <svg
            className="w-5 h-5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        )}
      </button>

      {/* Overlay */}
      {isOpen && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
          onClick={() => setIsOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar Drawer */}
      <div
        className={`md:hidden fixed inset-y-0 left-0 z-50 w-64 bg-zinc-50 dark:bg-zinc-950 border-r border-zinc-200 dark:border-zinc-800 transform transition-transform duration-300 ease-out ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        style={{
          paddingTop: "env(safe-area-inset-top)",
          paddingBottom: "env(safe-area-inset-bottom)",
        }}
      >
        {/* Header */}
        <div className="h-12 flex items-center justify-between px-4 border-b border-zinc-200 dark:border-zinc-800">
          <span className="mono text-[10px] font-medium tracking-[0.15em] text-zinc-500 uppercase">
            Koleksiyonlar
          </span>
          <button
            onClick={() => setIsOpen(false)}
            className="p-2 text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 touch-target"
            aria-label="Menüyü kapat"
          >
            <svg
              className="w-4 h-4"
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

        {/* Sidebar Content */}
        <div className="p-4 overflow-y-auto" style={{ maxHeight: "calc(100vh - 3rem - env(safe-area-inset-top) - env(safe-area-inset-bottom))" }}>
          <CollectionFilter
            ownedCollections={ownedCollections}
            sharedCollections={sharedCollections}
            activeId={activeCollectionId}
            tags={tags}
            activeTagId={activeTagId}
          />
        </div>
      </div>
    </>
  );
}
