/**
 * Opprett lead fra landing / skjema — deterministisk segment (industri + rolle).
 */

import type { Industry } from "@/lib/ai/industry";
import { detectIndustry, isIndustry } from "@/lib/ai/industry";
import type { Role } from "@/lib/ai/role";
import { detectRole, isRole } from "@/lib/ai/role";
import { LEAD_SRC_QUERY_KEY } from "@/lib/social/leadSource";
import type { Lead } from "@/lib/leads/types";

/** Valgfrie query-parametre (additive) for eksplisitt segment utover tekstanalyse. */
export const LEAD_QUERY_INDUSTRY = "lp_industry";
export const LEAD_QUERY_ROLE = "lp_role";

function newLeadId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `lead_${crypto.randomUUID()}`;
  }
  return `lead_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}

export type CreateLeadInput = {
  /** leadSourceId fra ?src= */
  source: string;
  /** Fritekst (f.eks. skjemafelt, jobbtittel) for deteksjon */
  contextText?: string;
  companySize?: string;
  industryOverride?: Industry;
  roleOverride?: Role;
};

export function createLeadFromCapture(input: CreateLeadInput): Lead {
  const source = String(input.source ?? "").trim();
  const ctx = `${input.contextText ?? ""}`.trim();
  const industry =
    input.industryOverride ?? (ctx ? detectIndustry(ctx) : detectIndustry(source));
  const role = input.roleOverride ?? (ctx ? detectRole(ctx) : detectRole(source));

  return {
    id: newLeadId(),
    source,
    industry,
    role,
    companySize: input.companySize,
    createdAt: Date.now(),
  };
}

/**
 * Les ?src= + valgfrie lp_industry / lp_role fra søkestreng (?a=b&…).
 */
export function parseLeadCaptureQuery(search: string): {
  leadSourceId: string | null;
  industry?: Industry;
  role?: Role;
} {
  const q = search.startsWith("?") ? search : `?${search}`;
  try {
    const p = new URLSearchParams(q);
    const src = p.get(LEAD_SRC_QUERY_KEY)?.trim() || null;
    const indRaw = p.get(LEAD_QUERY_INDUSTRY)?.trim().toLowerCase();
    const roleRaw = p.get(LEAD_QUERY_ROLE)?.trim().toLowerCase();
    return {
      leadSourceId: src,
      industry: indRaw && isIndustry(indRaw) ? indRaw : undefined,
      role: roleRaw && isRole(roleRaw) ? roleRaw : undefined,
    };
  } catch {
    return { leadSourceId: null };
  }
}

/** Full flyt: URL-query → Lead (krever gyldig src). */
export function createLeadFromSearchParams(search: string, formContextText?: string): Lead | null {
  const parsed = parseLeadCaptureQuery(search);
  if (!parsed.leadSourceId) return null;
  return createLeadFromCapture({
    source: parsed.leadSourceId,
    contextText: formContextText,
    industryOverride: parsed.industry,
    roleOverride: parsed.role,
  });
}
