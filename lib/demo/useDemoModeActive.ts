"use client";

import { useEffect, useState } from "react";

import { isDemoMode } from "@/lib/demo/mode";

/**
 * Hydration-safe: false until mounted, then reads localStorage.
 * Use for UI (highlights, toggles); viewModel uses isDemoMode() in browser only.
 */
export function useDemoModeActive(): boolean {
  const [active, setActive] = useState(false);

  useEffect(() => {
    setActive(isDemoMode());
  }, []);

  return active;
}
