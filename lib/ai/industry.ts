/**
 * Bransjemodell for deterministisk segmentering (B2B SoMe / kalender).
 * Kun kjente verdier — ukjente signaler faller tilbake til «office».
 */

export type Industry = "it" | "construction" | "office" | "healthcare" | "public" | "finance";

const INDUSTRIES: readonly Industry[] = ["it", "construction", "office", "healthcare", "public", "finance"];

export function isIndustry(v: string): v is Industry {
  return (INDUSTRIES as readonly string[]).includes(v);
}

export function detectIndustry(text: string): Industry {
  const t = String(text ?? "").toLowerCase();

  if (t.includes("bygg") || t.includes("entreprenør")) return "construction";
  if (t.includes("it") || t.includes("tech")) return "it";
  if (t.includes("helse") || t.includes("klinikk")) return "healthcare";
  if (t.includes("kommune")) return "public";
  if (t.includes("bank") || t.includes("finans")) return "finance";

  return "office";
}
