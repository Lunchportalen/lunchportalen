/**
 * STEP 6 — Konverteringer: møter, avtaler, omsetning (sporbarhet).
 */

import type { GtmConversionEvent, GtmConversionKind, GtmCrmSnapshot, GtmLeadStatus } from "./types";

function isoNow(): string {
  return new Date().toISOString();
}

export function newConversionId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `gconv_${crypto.randomUUID()}`;
  }
  return `gconv_${Date.now().toString(36)}`;
}

export type GtmPipelineMetrics = {
  leadsTotal: number;
  newCount: number;
  contactedCount: number;
  interestedCount: number;
  closedCount: number;
  meetingsBooked: number;
  dealsClosed: number;
  revenueNok: number;
  conversionRateInterested: number;
};

export function emptyPipelineMetrics(): GtmPipelineMetrics {
  return {
    leadsTotal: 0,
    newCount: 0,
    contactedCount: 0,
    interestedCount: 0,
    closedCount: 0,
    meetingsBooked: 0,
    dealsClosed: 0,
    revenueNok: 0,
    conversionRateInterested: 0,
  };
}

function statusCounts(leads: { status: GtmLeadStatus }[]): Pick<GtmPipelineMetrics, "newCount" | "contactedCount" | "interestedCount" | "closedCount"> {
  let newCount = 0;
  let contactedCount = 0;
  let interestedCount = 0;
  let closedCount = 0;
  for (const l of leads) {
    if (l.status === "new") newCount += 1;
    else if (l.status === "contacted") contactedCount += 1;
    else if (l.status === "interested") interestedCount += 1;
    else if (l.status === "closed") closedCount += 1;
  }
  return { newCount, contactedCount, interestedCount, closedCount };
}

export function computeGtmPipelineMetrics(snapshot: Pick<GtmCrmSnapshot, "leads" | "conversions">): GtmPipelineMetrics {
  const { leads, conversions } = snapshot;
  const sc = statusCounts(leads);
  const meetingsBooked = conversions.filter((c) => c.kind === "meeting_booked").length;
  const dealsClosed = conversions.filter((c) => c.kind === "deal_closed").length;
  const revenueNok = conversions.reduce((acc, c) => acc + (typeof c.valueNok === "number" && c.valueNok > 0 ? c.valueNok : 0), 0);
  const denom = leads.length || 1;
  const conversionRateInterested = (sc.interestedCount + dealsClosed) / denom;

  return {
    leadsTotal: leads.length,
    ...sc,
    meetingsBooked,
    dealsClosed,
    revenueNok,
    conversionRateInterested,
  };
}

export function buildConversionEvent(input: {
  leadId: string;
  kind: GtmConversionKind;
  valueNok?: number;
  campaignId?: string;
}): GtmConversionEvent {
  return {
    id: newConversionId(),
    leadId: input.leadId,
    kind: input.kind,
    valueNok: input.valueNok,
    at: isoNow(),
    campaignId: input.campaignId?.trim() || undefined,
  };
}
