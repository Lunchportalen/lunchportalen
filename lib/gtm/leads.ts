/**
 * STEP 1 — Lead engine: normalisering, kilder, ID.
 */

import type { OutboundLead } from "@/lib/outbound/lead";

import type { GtmLead, GtmLeadSource, GtmLeadStatus } from "./types";

function isoNow(): string {
  return new Date().toISOString();
}

export function newGtmLeadId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `gtm_${crypto.randomUUID()}`;
  }
  return `gtm_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}

export type CreateGtmLeadInput = {
  company: GtmLead["company"];
  contact: GtmLead["contact"];
  source: GtmLeadSource;
  status?: GtmLeadStatus;
  score?: number;
  campaignId?: string;
};

export function createGtmLead(input: CreateGtmLeadInput): GtmLead {
  const now = isoNow();
  return {
    id: newGtmLeadId(),
    company: {
      name: String(input.company.name ?? "").trim() || "Ukjent selskap",
      employeeCount:
        typeof input.company.employeeCount === "number" && Number.isFinite(input.company.employeeCount)
          ? input.company.employeeCount
          : undefined,
      industry: input.company.industry?.trim() || undefined,
    },
    contact: {
      name: input.contact.name?.trim() || undefined,
      email: input.contact.email?.trim() || undefined,
      linkedinUrl: input.contact.linkedinUrl?.trim() || undefined,
      role: input.contact.role?.trim() || undefined,
    },
    source: input.source,
    score: typeof input.score === "number" && input.score >= 0 && input.score <= 100 ? input.score : 0,
    status: input.status ?? "new",
    campaignId: input.campaignId?.trim() || undefined,
    createdAt: now,
    updatedAt: now,
    interactions: [],
  };
}

/** Kartlegg eksisterende outbound-lead til GTM-modell (én sannhet i UI). */
export function gtmLeadFromOutbound(lead: OutboundLead, source: GtmLeadSource = "manual"): GtmLead {
  const now = isoNow();
  return {
    id: `gtm_ob_${lead.id}`,
    company: {
      name: lead.companyName,
      employeeCount: lead.companySize,
      industry: lead.industry,
    },
    contact: {
      name: lead.contactName,
      email: lead.email,
      linkedinUrl: lead.linkedinUrl,
      role: lead.role,
    },
    source,
    score: 0,
    status: "new",
    createdAt: now,
    updatedAt: now,
    interactions: [],
  };
}

/** Nettside-inbound: kampanje fra query eller referrer (kontrollert, ingen skjult scraping). */
export function parseInboundCampaignFromSearchParams(params: Record<string, string | undefined>): {
  campaignId?: string;
  source: GtmLeadSource;
} {
  const utm = params.utm_campaign ?? params.utm_source;
  const campaignId = utm?.trim() || params.src?.trim() || undefined;
  return {
    campaignId,
    source: "website_inbound",
  };
}

export function touchGtmLead(lead: GtmLead, patch: Partial<Pick<GtmLead, "status" | "score" | "campaignId">>): GtmLead {
  return {
    ...lead,
    ...patch,
    updatedAt: isoNow(),
  };
}
