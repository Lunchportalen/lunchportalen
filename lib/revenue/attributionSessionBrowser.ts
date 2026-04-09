"use client";

/**
 * Read stored AI Social attribution for order API payloads (sessionStorage → cookie fallback).
 */

import { deserializeAttribution, ORDER_ATTRIBUTION_COOKIE_NAME, ORDER_ATTRIBUTION_STORAGE_KEY } from "@/lib/revenue/session";
import type { StoredOrderAttribution } from "@/lib/revenue/session";

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const parts = document.cookie.split(";").map((p) => p.trim());
  const prefix = `${name}=`;
  for (const p of parts) {
    if (p.startsWith(prefix)) {
      try {
        return decodeURIComponent(p.slice(prefix.length));
      } catch {
        return p.slice(prefix.length);
      }
    }
  }
  return null;
}

export function getOrderAttributionForApi(): StoredOrderAttribution | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(ORDER_ATTRIBUTION_STORAGE_KEY);
    const fromSession = deserializeAttribution(raw);
    if (fromSession) return fromSession;
  } catch {
    /* ignore quota / private mode */
  }
  return deserializeAttribution(readCookie(ORDER_ATTRIBUTION_COOKIE_NAME));
}
