"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { ReactNode } from "react";

interface PlatformCount {
  all: number;
  instagram: number;
  x: number;
  threads: number;
}

interface PlatformFilterProps {
  activePlatform?: string;
  counts: PlatformCount;
  rightContent?: ReactNode;
}

export default function PlatformFilter({
  activePlatform,
  counts,
  rightContent,
}: PlatformFilterProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const PLATFORMS = [
    { id: null, label: "TÜMÜ", count: counts.all },
    { id: "instagram", label: "INSTAGRAM", count: counts.instagram },
    { id: "x", label: "X", count: counts.x },
  ] as const;

  function navigate(platformId: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (platformId) params.set("platform", platformId);
    else params.delete("platform");
    router.push(params.toString() ? `${pathname}?${params}` : pathname);
  }

  return (
    <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800">
      <div className="flex items-center gap-0">
        {PLATFORMS.map((platform) => {
          const isActive =
            platform.id === activePlatform || (!platform.id && !activePlatform);
          return (
            <button
              key={platform.id ?? "all"}
              onClick={() => navigate(platform.id)}
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
