"use client";

import { useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";

import { parseDemoDeviceSegment, parseDemoSourceSegment } from "@/lib/public/demoCtaAb/contextSegments";
import { parseDemoPatternIntent } from "@/lib/public/demoCtaAb/patternContext";
import { parseDemoCtaVariantIdFromQuery } from "@/lib/public/demoCtaAb/variantId";
import { AI_DEMO_FUNNEL_FROM } from "@/lib/public/aiDemoFunnel";
const ENDPOINT = "/api/public/analytics";

const ENV: "prod" | "staging" =
  typeof process.env.NEXT_PUBLIC_APP_ENV === "string" && process.env.NEXT_PUBLIC_APP_ENV === "staging"
    ? "staging"
    : "prod";

/**
 * Én beacon når bruker lander på /registrering?from=ai_demo (demo → signup-trinn).
 */
export function RegistrationDemoFunnelBeacon() {
  const searchParams = useSearchParams();
  const sent = useRef(false);

  useEffect(() => {
    if (sent.current) return;
    if (searchParams.get("from") !== AI_DEMO_FUNNEL_FROM) return;
    sent.current = true;

    const abRaw = searchParams.get("ab");
    const ctaAb = parseDemoCtaVariantIdFromQuery(abRaw);
    const ds = parseDemoDeviceSegment(searchParams.get("ds"));
    const ss = parseDemoSourceSegment(searchParams.get("ss"));
    const intentSeg = parseDemoPatternIntent(searchParams.get("is"));

    const body = JSON.stringify({
      environment: ENV,
      locale: "nb",
      eventType: "page_view",
      pageId: null,
      variantId: null,
      eventKey: "signup_from_ai_demo",
      eventValue: null,
      metadata: {
        funnel: "ai_demo",
        step: "registration_entry",
        ...(ctaAb ? { cta_ab: ctaAb } : {}),
        ...(ds ? { device_seg: ds } : {}),
        ...(ss ? { source_seg: ss } : {}),
        ...(intentSeg ? { intent_seg: intentSeg } : {}),
      },
    });
    if (typeof navigator !== "undefined" && navigator.sendBeacon) {
      navigator.sendBeacon(ENDPOINT, body);
      return;
    }
    void fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => {});
  }, [searchParams]);

  return null;
}
