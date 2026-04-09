/**
 * STEP 2 — Scoring 0–100: størrelse, bransje, atferd (besøk/klikk).
 */

import { toIndustryFromOutbound } from "@/lib/outbound/normalizeSegment";

import type { GtmLead } from "./types";

const STRONG_INDUSTRIES = new Set(["it", "finance", "health", "office", "retail"]);

export type GtmBehaviorSignals = {
  /** Unike sidevisninger knyttet til lead / selskap (aggregat) */
  visits?: number;
  /** CTA- eller lenkeklikk */
  clicks?: number;
};

function clamp100(n: number): number {
  if (n < 0) return 0;
  if (n > 100) return 100;
  return Math.round(n);
}

/**
 * Forklarbar heuristikk — ikke ML. Kan kobles til analytics senere.
 */
export function scoreGtmLead(lead: GtmLead, behavior: GtmBehaviorSignals = {}): number {
  let s = 0;

  const n = lead.company.employeeCount;
  if (n != null && n >= 20 && n <= 200) s += 28;
  else if (n != null && n > 10 && n < 500) s += 14;
  else if (n != null && n >= 1) s += 6;

  const indKey = toIndustryFromOutbound(lead.company.industry ?? "office", lead.company.name);
  if (STRONG_INDUSTRIES.has(indKey)) s += 18;
  else s += 8;

  if (lead.contact.email?.includes("@")) s += 8;
  if (lead.contact.linkedinUrl?.startsWith("http")) s += 7;
  if (lead.contact.name?.trim()) s += 4;
  if (lead.source === "website_inbound") s += 12;
  else if (lead.source === "scraped_controlled") s += 4;
  else s += 6;

  const v = Math.min(40, Math.max(0, Number(behavior.visits) || 0));
  s += Math.min(20, v * 2);

  const c = Math.min(10, Math.max(0, Number(behavior.clicks) || 0));
  s += Math.min(18, c * 5);

  if (lead.status === "interested") s += 15;
  else if (lead.status === "contacted") s += 6;

  return clamp100(s);
}

export function withScoredLead(lead: GtmLead, behavior?: GtmBehaviorSignals): GtmLead {
  return { ...lead, score: scoreGtmLead(lead, behavior) };
}
