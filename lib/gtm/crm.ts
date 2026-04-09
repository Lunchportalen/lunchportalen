/**
 * STEP 9 — CRM-lag: leads, interaksjoner, status — serialiserbart (localStorage / senere server).
 */

import { buildConversionEvent } from "./conversion";
import { upsertAttributionFromConversion } from "./attribution";
import { newGtmLeadId } from "./leads";
import type {
  GtmAuditEntry,
  GtmCrmSnapshot,
  GtmInteraction,
  GtmLead,
  GtmLeadStatus,
  GtmConversionKind,
} from "./types";

export const GTM_CRM_STORAGE_KEY = "lp_gtm_crm_v1";

function isoNow(): string {
  return new Date().toISOString();
}

export function emptyGtmCrmSnapshot(): GtmCrmSnapshot {
  return { version: 1, leads: [], conversions: [], attribution: [], audit: [] };
}

/** Sikrer at en lead fra merged view finnes i CRM før interaksjon / status / konvertering. */
export function ensureGtmLeadInSnapshot(snapshot: GtmCrmSnapshot, lead: GtmLead): GtmCrmSnapshot {
  if (snapshot.leads.some((l) => l.id === lead.id)) return snapshot;
  return {
    ...snapshot,
    leads: [...snapshot.leads, { ...lead, updatedAt: isoNow() }],
    audit: [...snapshot.audit, newAudit("lead_materialized", lead.id)],
  };
}

function newAudit(action: string, leadId?: string, detail?: Record<string, unknown>): GtmAuditEntry {
  return {
    id: newGtmLeadId(),
    at: isoNow(),
    action,
    leadId,
    detail,
  };
}

function newInteractionId(): string {
  return `gint_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function appendGtmInteraction(
  snapshot: GtmCrmSnapshot,
  leadId: string,
  interaction: Omit<GtmInteraction, "id" | "at"> & { id?: string; at?: string },
): GtmCrmSnapshot {
  const full: GtmInteraction = {
    id: interaction.id ?? newInteractionId(),
    at: interaction.at ?? isoNow(),
    channel: interaction.channel,
    summary: interaction.summary,
    replyKind: interaction.replyKind,
    metadata: interaction.metadata,
  };

  const leads = snapshot.leads.map((l) => {
    if (l.id !== leadId) return l;
    return {
      ...l,
      interactions: [...l.interactions, full],
      updatedAt: isoNow(),
    };
  });

  return {
    ...snapshot,
    leads,
    audit: [...snapshot.audit, newAudit("interaction_appended", leadId, { channel: full.channel })],
  };
}

export function setGtmLeadStatus(snapshot: GtmCrmSnapshot, leadId: string, status: GtmLeadStatus): GtmCrmSnapshot {
  const leads = snapshot.leads.map((l) => (l.id === leadId ? { ...l, status, updatedAt: isoNow() } : l));
  return {
    ...snapshot,
    leads,
    audit: [...snapshot.audit, newAudit("status_set", leadId, { status })],
  };
}

export function upsertGtmLead(snapshot: GtmCrmSnapshot, lead: GtmLead): GtmCrmSnapshot {
  const idx = snapshot.leads.findIndex((l) => l.id === lead.id);
  const nextLead = { ...lead, updatedAt: isoNow() };
  const leads =
    idx >= 0
      ? snapshot.leads.map((l, i) => (i === idx ? { ...l, ...nextLead, interactions: l.interactions } : l))
      : [...snapshot.leads, nextLead];
  return {
    ...snapshot,
    leads,
    audit: [...snapshot.audit, newAudit(idx >= 0 ? "lead_updated" : "lead_created", lead.id)],
  };
}

export function recordGtmConversion(
  snapshot: GtmCrmSnapshot,
  input: { leadId: string; kind: GtmConversionKind; valueNok?: number; campaignId?: string },
): GtmCrmSnapshot {
  const ev = buildConversionEvent(input);
  const lead = snapshot.leads.find((l) => l.id === input.leadId);
  const attribution = upsertAttributionFromConversion(snapshot.attribution, ev, lead);
  return {
    ...snapshot,
    conversions: [...snapshot.conversions, ev],
    attribution,
    audit: [...snapshot.audit, newAudit("conversion_recorded", input.leadId, { kind: input.kind, valueNok: input.valueNok })],
  };
}

export function readGtmCrmFromLocalStorage(): GtmCrmSnapshot {
  if (typeof window === "undefined") return emptyGtmCrmSnapshot();
  try {
    const raw = window.localStorage.getItem(GTM_CRM_STORAGE_KEY);
    if (!raw) return emptyGtmCrmSnapshot();
    const v = JSON.parse(raw) as unknown;
    if (!v || typeof v !== "object") return emptyGtmCrmSnapshot();
    const o = v as Partial<GtmCrmSnapshot>;
    if (o.version !== 1 || !Array.isArray(o.leads)) return emptyGtmCrmSnapshot();
    return {
      version: 1,
      leads: o.leads as GtmLead[],
      conversions: Array.isArray(o.conversions) ? o.conversions : [],
      attribution: Array.isArray(o.attribution) ? o.attribution : [],
      audit: Array.isArray(o.audit) ? o.audit : [],
    };
  } catch {
    return emptyGtmCrmSnapshot();
  }
}

export function writeGtmCrmToLocalStorage(snapshot: GtmCrmSnapshot): void {
  if (typeof window === "undefined") return;
  try {
    const slim: GtmCrmSnapshot = {
      ...snapshot,
      leads: snapshot.leads.slice(0, 2000),
      audit: snapshot.audit.slice(-500),
    };
    window.localStorage.setItem(GTM_CRM_STORAGE_KEY, JSON.stringify(slim));
  } catch {
    /* quota */
  }
}
