"use client";

import { useEffect } from "react";

import { isValidDemoCtaVariantId } from "@/lib/public/demoCtaAb/variantId";

const ENDPOINT = "/api/public/analytics";

const ENV = typeof process.env.NEXT_PUBLIC_APP_ENV === "string" && process.env.NEXT_PUBLIC_APP_ENV === "staging" ? "staging" : "prod";

function sendCtaClick(
  eventKey: string,
  pageId: string | null,
  variantId: string | null,
  metadata: Record<string, unknown> | null,
) {
  const body = JSON.stringify({
    environment: ENV,
    locale: "nb",
    eventType: "cta_click",
    pageId,
    variantId,
    eventKey: eventKey.slice(0, 64),
    eventValue: null,
    metadata,
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
      const ab = link.getAttribute("data-analytics-ab-variant");
      let ds: string | null = null;
      let ss: string | null = null;
      let ins: string | null = null;
      let walk: HTMLElement | null = link;
      while (walk) {
        ds = walk.getAttribute("data-demo-device-seg") ?? ds;
        ss = walk.getAttribute("data-demo-source-seg") ?? ss;
        ins = walk.getAttribute("data-demo-intent-seg") ?? ins;
        walk = walk.parentElement;
      }
      const meta: Record<string, unknown> | null =
        ab && isValidDemoCtaVariantId(ab)
          ? {
              funnel: "ai_demo",
              cta_ab: ab,
              ...(ds ? { device_seg: ds } : {}),
              ...(ss ? { source_seg: ss } : {}),
              ...(ins ? { intent_seg: ins } : {}),
            }
          : null;
      if (ctaId) sendCtaClick(ctaId, pageId ?? null, variantId ?? null, meta);
    };
    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
  }, []);
  return null;
}
