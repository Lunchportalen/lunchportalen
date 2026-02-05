"use client";

import { useEffect } from "react";

export default function NeonGuard() {
  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    const nodes = document.querySelectorAll('[class*="lp-neon-"]');
    if (nodes.length > 1) {
      console.warn(`[neon-guard] Multiple neon elements detected: ${nodes.length}`);
    }
  }, []);

  return null;
}
