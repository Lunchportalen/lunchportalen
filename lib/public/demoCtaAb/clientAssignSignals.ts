"use client";

import {
  classifyDeviceFromUserAgent,
  classifyIntentFromSignals,
  classifySourceFromSignals,
} from "@/lib/public/demoCtaAb/classifyContextShared";

export type ClientDemoAbSignals = {
  utmSource: string;
  utmMedium: string;
  utmCampaign: string;
  referrer: string;
};

/** Signaler til POST /api/public/ai-demo-cta/assign (kilde-klassifisering). */
export function collectClientDemoAbSignals(): ClientDemoAbSignals {
  if (typeof window === "undefined") {
    return { utmSource: "", utmMedium: "", utmCampaign: "", referrer: "" };
  }
  const sp = new URLSearchParams(window.location.search);
  return {
    utmSource: sp.get("utm_source") ?? "",
    utmMedium: sp.get("utm_medium") ?? "",
    utmCampaign: sp.get("utm_campaign") ?? "",
    referrer: typeof document !== "undefined" ? document.referrer ?? "" : "",
  };
}

/** Samme kontekstnøkkel som server (for å invalidere LS ved endret trafikk/enhet/intent). */
export function computeClientDemoAbContextKey(): string {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return "unknown|unknown|demo_auto";
  }
  const sig = collectClientDemoAbSignals();
  const d = classifyDeviceFromUserAgent(navigator.userAgent);
  const s = classifySourceFromSignals({
    utm_source: sig.utmSource,
    utm_medium: sig.utmMedium,
    referrer: sig.referrer,
  });
  const i = classifyIntentFromSignals({
    source_seg: s,
    utm_source: sig.utmSource,
    utm_medium: sig.utmMedium,
    utm_campaign: sig.utmCampaign,
    referrer: sig.referrer,
  });
  return `${d}|${s}|${i}`;
}
