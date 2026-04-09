/**
 * STEP 12 — Integrasjon mot eksisterende systemer (tynne, eksplisitte koblinger).
 */

import type { GtmLead } from "./types";

/** Kampanje-ID for attributjon fra CMS-redigering (side / innhold). */
export function campaignIdFromPageEditor(pageId: string, pageTitle?: string): string {
  const t = (pageTitle ?? "").trim().slice(0, 40).replace(/\s+/g, "_");
  return `cms_page:${pageId}${t ? `:${t}` : ""}`;
}

/**
 * Berik lead med kampanje fra editor — ingen nettverkskall.
 * Kan utvides til revenue-optimizer / analytics-snapshot senere.
 */
export function attachEditorCampaignContext(lead: GtmLead, pageId: string, pageTitle?: string): GtmLead {
  const campaignId = campaignIdFromPageEditor(pageId, pageTitle);
  return {
    ...lead,
    campaignId: lead.campaignId ?? campaignId,
    updatedAt: new Date().toISOString(),
  };
}

/** Metadata for logging mot AI decision / revenue pipelines (kun struktur). */
export function gtmLeadToDecisionContext(lead: GtmLead): {
  leadId: string;
  score: number;
  status: GtmLead["status"];
  source: GtmLead["source"];
  campaignId?: string;
  industry?: string;
} {
  return {
    leadId: lead.id,
    score: lead.score,
    status: lead.status,
    source: lead.source,
    campaignId: lead.campaignId,
    industry: lead.company.industry,
  };
}
