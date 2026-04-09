/**
 * Rolle + bransje i utgående tekster — tynn wrapper over industryRoleMessaging.
 */

import type { Industry } from "@/lib/ai/industry";
import type { Role } from "@/lib/ai/role";
import { getIndustryRoleIntro } from "@/lib/social/industryRoleMessaging";
import { toIndustryFromOutbound, toRoleFromOutbound } from "@/lib/outbound/normalizeSegment";

/**
 * Personlig intro-linje for gitt bransje/rolle (strenger fra CRM/CSV normaliseres).
 */
export function getIndustryRoleMessage(industryRaw: string, roleRaw: string): string {
  const ctx = `${industryRaw} ${roleRaw}`;
  const ind = toIndustryFromOutbound(industryRaw, ctx);
  const role = toRoleFromOutbound(roleRaw, ctx);
  return getIndustryRoleIntro(ind, role);
}

export function getIndustryRoleMessageCanonical(industry: Industry, role: Role): string {
  return getIndustryRoleIntro(industry, role);
}
