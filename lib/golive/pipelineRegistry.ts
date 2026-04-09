/**
 * Prosessminne for Go Live-pipeline (superadmin) — **ikke** full CRM-erstatning.
 * Leads lagres her for oversikt i kontrolltårn; produksjon bør synkronisere mot ekte kilde.
 */
import "server-only";

import type { Lead } from "@/lib/golive/leads";

const byId = new Map<string, Lead>();

export function upsertPipelineLead(lead: Lead): void {
  const id = String(lead?.id ?? "").trim();
  if (!id) return;
  byId.set(id, {
    ...lead,
    id,
    companyName: String(lead.companyName ?? "").trim(),
    industry: String(lead.industry ?? "").trim(),
    location: String(lead.location ?? "").trim(),
  });
}

export function listPipelineLeads(): Lead[] {
  return [...byId.values()].map((l) => ({ ...l }));
}

export function removePipelineLead(id: string): boolean {
  const k = String(id ?? "").trim();
  if (!k) return false;
  return byId.delete(k);
}

export function clearPipelineRegistry(): void {
  byId.clear();
}

export type PipelinePhaseCounts = Record<Lead["status"], number>;

export function countPipelinePhases(leads: Lead[]): PipelinePhaseCounts {
  const empty: PipelinePhaseCounts = { new: 0, contacted: 0, qualified: 0, closed: 0 };
  for (const l of leads) {
    const s = l.status;
    if (s in empty) empty[s] += 1;
  }
  return empty;
}
