"use client";

import { useEffect, useRef } from "react";

type Env = "prod" | "staging";

type Props = {
  environment: Env;
  locale: "nb" | "en";
  pageId: string | null;
  variantId: string | null;
};

const ENDPOINT = "/api/public/analytics";

function sendPageView(environment: Env, locale: "nb" | "en", pageId: string | null, variantId: string | null) {
  const body = JSON.stringify({
    environment,
    locale,
    eventType: "page_view",
    pageId,
    variantId,
    eventKey: null,
    eventValue: null,
    metadata: null,
  });
  if (typeof navigator !== "undefined" && navigator.sendBeacon) {
    navigator.sendBeacon(ENDPOINT, body);
    return;
  }
  fetch(ENDPOINT, { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true }).catch(() => {});
}

export function TrackPageView({ environment, locale, pageId, variantId }: Props) {
  const sent = useRef(false);
  useEffect(() => {
    if (sent.current) return;
    sent.current = true;
    sendPageView(environment, locale, pageId, variantId);
  }, [environment, locale, pageId, variantId]);
  return null;
}
