"use client";

import { useEffect, useRef } from "react";

import type { CmsSurface } from "@/lib/cms/surfaces";

type Env = "prod" | "staging";

type Props = {
  environment: Env;
  locale: "nb" | "en";
  pageId: string | null;
  variantId: string | null;
  /** Valgfri nøkkel for funnel / ikke-CMS-flater (page_id i DB er ofte uuid). */
  eventKey?: string | null;
  metadata?: Record<string, unknown> | null;
  /** When set, merged into metadata as `cms_surface` for per-surface analytics. */
  cmsSurface?: CmsSurface | null;
};

const ENDPOINT = "/api/public/analytics";

function sendPageView(
  environment: Env,
  locale: "nb" | "en",
  pageId: string | null,
  variantId: string | null,
  eventKey: string | null | undefined,
  metadata: Record<string, unknown> | null | undefined,
  cmsSurface: CmsSurface | null | undefined,
) {
  const merged =
    cmsSurface != null
      ? { ...(metadata && typeof metadata === "object" ? metadata : {}), cms_surface: cmsSurface }
      : metadata ?? null;
  const body = JSON.stringify({
    environment,
    locale,
    eventType: "page_view",
    pageId,
    variantId,
    eventKey: eventKey ?? null,
    eventValue: null,
    metadata: merged,
  });
  if (typeof navigator !== "undefined" && navigator.sendBeacon) {
    navigator.sendBeacon(ENDPOINT, body);
    return;
  }
  fetch(ENDPOINT, { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true }).catch(() => {});
}

const TRACK_EXP = "/api/public/track-event";

export function TrackPageView({ environment, locale, pageId, variantId, eventKey, metadata, cmsSurface }: Props) {
  const sent = useRef(false);
  useEffect(() => {
    if (sent.current) return;
    sent.current = true;
    sendPageView(environment, locale, pageId, variantId, eventKey, metadata, cmsSurface);
  }, [environment, locale, pageId, variantId, eventKey, metadata, cmsSurface]);

  useEffect(() => {
    try {
      const v = (typeof window !== "undefined" ? (window as unknown as { __LP_VARIANT__?: unknown }).__LP_VARIANT__ : null) as
        | { experimentId?: unknown; variantId?: unknown }
        | null
        | undefined;
      if (!v) return;
      const experimentId = typeof v.experimentId === "string" ? v.experimentId : "";
      const variantId = typeof v.variantId === "string" ? v.variantId : "";
      if (!experimentId || !variantId) return;
      fetch(TRACK_EXP, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          experimentId,
          variantId,
          type: "impression",
        }),
      }).catch(() => {});
    } catch {
      /* never block render */
    }
  }, []);

  return null;
}
