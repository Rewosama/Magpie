"use client";

import { createPortal } from "react-dom";
import { useEffect, useState } from "react";

/**
 * Renders children directly on document.body via a React portal.
 * Bypasses all ancestor stacking contexts (sticky header, flex containers…)
 * so fixed-position modals always appear above everything.
 */
export function ModalPortal({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  return createPortal(children, document.body);
}
