/**
 * Audience / persona hints for ads and funnel copy (deterministic labels).
 */

export const DEFAULT_B2B_AUDIENCES = [
  "HR- og driftledere i mellomstore bedrifter (50–500 ansatte)",
  "Office managers og facility i Oslo/Trondheim/Bergen",
  "CFO / økonomi som vil forutsigbare lunsjkostnader",
  "Bærekraftsansvarlig som ønsker målbar reduksjon av matsvinn",
] as const;

export function suggestAudiencesForProduct(productSummary: string): string[] {
  const t = productSummary.toLowerCase();
  const base: string[] = [...DEFAULT_B2B_AUDIENCES];
  if (t.includes("kantine") || t.includes("lunsj")) {
    base.push("Bedrifter som vurderer å erstatte eller supplere kantinedrift");
  }
  if (t.includes("tech") || t.includes("saas")) {
    base.push("Teknologibedrifter med hybrid kontor og høy ansatt-tetthet");
  }
  return Array.from(new Set(base));
}
