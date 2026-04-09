import type { DemoDeviceSegment, DemoSourceSegment } from "@/lib/public/demoCtaAb/contextSegments";
import type { DemoIntentSegment } from "@/lib/public/demoCtaAb/types";

export function classifyDeviceFromUserAgent(ua: string | null | undefined): DemoDeviceSegment {
  if (!ua || !ua.trim()) return "unknown";
  const s = ua;
  if (/tablet|ipad|playbook|silk|(android(?!.*mobile))/i.test(s)) return "tablet";
  if (/Mobile|iP(hone|od)|Android.*Mobile|BlackBerry|IEMobile|webOS|Opera Mini|Opera Mobi/i.test(s)) {
    return "mobile";
  }
  return "desktop";
}

function hostFromReferrer(ref: string | null | undefined): string {
  if (!ref || !ref.trim()) return "";
  try {
    return new URL(ref).hostname.toLowerCase();
  } catch {
    return "";
  }
}

export function classifySourceFromSignals(input: {
  utm_source?: string | null;
  utm_medium?: string | null;
  referrer?: string | null;
}): DemoSourceSegment {
  const us = (input.utm_source ?? "").trim().toLowerCase();
  const um = (input.utm_medium ?? "").trim().toLowerCase();
  const host = hostFromReferrer(input.referrer ?? "");

  if (um === "email" || um === "e-mail") return "email";
  if (um === "cpc" || um === "ppc" || um === "paid" || um === "paidsearch" || um === "display") return "paid";
  if (um === "social" || um === "social-network" || um === "sm") return "social";

  const socialHosts =
    /facebook|instagram|linkedin|twitter|x\.com|tiktok|snapchat|threads\.net|reddit\.|pinterest\./i;
  if (socialHosts.test(host) || socialHosts.test(us)) return "social";

  const paidHints = /ads|adwords|gclid|fbclid|paid|sponsored/i;
  if (paidHints.test(us) || paidHints.test(um)) return "paid";

  if (us === "email" || us === "newsletter" || us === "mail") return "email";

  if (!host && !us && !um) return "direct";

  if (/google\.|bing\.|duckduckgo|yahoo\.|ecosia|kagi\./i.test(host)) return "organic";

  if (host || us || um) return "referral";

  return "unknown";
}

/**
 * Grov intensjon i demoflyten (server: signaler fra UTM/referrer — uten klientfelt).
 */
export function classifyIntentFromSignals(input: {
  source_seg: DemoSourceSegment;
  utm_source?: string | null;
  utm_medium?: string | null;
  utm_campaign?: string | null;
  referrer?: string | null;
}): DemoIntentSegment {
  const us = (input.utm_source ?? "").trim().toLowerCase();
  const um = (input.utm_medium ?? "").trim().toLowerCase();
  const uc = (input.utm_campaign ?? "").trim().toLowerCase();
  const ref = (input.referrer ?? "").toLowerCase();

  if (
    us.includes("share") ||
    uc.includes("share") ||
    um.includes("share") ||
    ref.includes("share") ||
    ref.includes("utm_medium=share")
  ) {
    return "shared_link";
  }

  if (input.source_seg === "direct" && !ref && !us && !um && !uc) {
    return "direct";
  }

  return "demo_auto";
}
