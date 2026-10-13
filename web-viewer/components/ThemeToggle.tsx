"use client";

import { useEffect, useState } from "react";

export default function ThemeToggle() {
  const [dark, setDark] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem("magpie-theme");
    const prefersDark = window.matchMedia(
      "(prefers-color-scheme: dark)",
    ).matches;
    const isDark = saved ? saved === "dark" : prefersDark;
    setDark(isDark);
    document.documentElement.classList.toggle("dark", isDark);
  }, []);

  const toggle = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("magpie-theme", next ? "dark" : "light");
  };

  if (!mounted) return <div className="w-8 h-4" />;

  return (
    <button
      onClick={toggle}
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      className={`relative w-8 h-4 border transition-colors ${
        dark ? "bg-zinc-100 border-zinc-100" : "bg-zinc-800 border-zinc-800"
      }`}
    >
      <span
        className={`absolute top-0.5 w-3 h-3 transition-all ${
          dark ? "left-0.5 bg-zinc-800" : "left-4 bg-zinc-100"
        }`}
      />
    </button>
  );
}
