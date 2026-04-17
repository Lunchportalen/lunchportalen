"use client";

import { useEffect } from "react";

import { parseLandingAttributionFromSearchParams, storeAttribution } from "@/lib/revenue/session";

/**
 * Captures ?src=ai_social&postId=… (and optional productId) once per load.
 * Fail-closed: invalid/missing params → no-op.
 */
export default function AttributionCapture() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const u = new URL(window.location.href);
      const parsed = parseLandingAttributionFromSearchParams(u.searchParams);
      if (!parsed) return;
      storeAttribution(parsed);
    } catch {
      /* never break app shell */
    }
  }, []);

  return null;
}
