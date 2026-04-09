import type { Industry } from "@/lib/ai/industry";
import { detectIndustry, isIndustry } from "@/lib/ai/industry";
import type { Role } from "@/lib/ai/role";
import { detectRole, isRole } from "@/lib/ai/role";

/** Kartlegg CSV-/fritekst til kanoniske segmenter (deterministisk). */
export function toIndustryFromOutbound(raw: string, context?: string): Industry {
  const t = String(raw ?? "").trim().toLowerCase();
  if (isIndustry(t)) return t;
  return detectIndustry(`${raw} ${context ?? ""}`);
}

export function toRoleFromOutbound(raw: string, context?: string): Role {
  const t = String(raw ?? "").trim().toLowerCase();
  if (isRole(t)) return t;
  return detectRole(`${raw} ${context ?? ""}`);
}
