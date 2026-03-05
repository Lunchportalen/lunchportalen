"use client";

import { useEffect } from "react";

const ENDPOINT = "/api/public/analytics";

const ENV = typeof process.env.NEXT_PUBLIC_APP_ENV === "string" && process.env.NEXT_PUBLIC_APP_ENV === "staging" ? "staging" : "prod";

function sendCtaClick(eventKey: string, pageId: string | null, variantId: string | null) {
  const body = JSON.stringify({
    environment: ENV,
    locale: "nb",
    eventType: "cta_click",
    pageId,
    variantId,
    eventKey: eventKey.slice(0, 64),
    eventValue: null,
    metadata: null,
  });
  if (typeof navigator !== "undefined" && navigator.sendBeacon) {
    navigator.sendBeacon(ENDPOINT, body);
    return;
  }
  fetch(ENDPOINT, { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true }).catch(() => {});
}

export function CtaClickTracker() {
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const link = target.closest("a[data-analytics-cta-id]") as HTMLAnchorElement | null;
      if (!link) return;
      const ctaId = link.getAttribute("data-analytics-cta-id");
      const pageId = link.getAttribute("data-analytics-page-id");
      const variantId = link.getAttribute("data-analytics-variant-id");
      if (ctaId) sendCtaClick(ctaId, pageId ?? null, variantId ?? null);
    };
    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
  }, []);
  return null;
}
