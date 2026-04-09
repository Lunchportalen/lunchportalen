import "server-only";

import type { CMSContentInput, CroAnalysisResult, CroIssue } from "@/lib/ai/types";

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return Boolean(v && typeof v === "object" && !Array.isArray(v));
}

function asString(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function collectBlocks(content: CMSContentInput): unknown[] {
  const raw = content.blocks;
  if (Array.isArray(raw)) return raw;
  const nested = content.data;
  if (isPlainObject(nested) && Array.isArray(nested.blocks)) return nested.blocks;
  return [];
}

const CTA_TYPES = new Set(["cta", "ctarow", "button", "buttons", "signup", "newsletter", "form"]);
const TRUST_KEYWORDS = ["testimonial", "review", "logo", "partner", "kunde", "trusted", "sertifis", "iso", "gdpr"];

/**
 * Heuristic CRO pass — structure, CTA, trust, friction. No network.
 */
export function analyzeCro(content: CMSContentInput): CroAnalysisResult {
  const issues: CroIssue[] = [];
  const suggestions: string[] = [];
  const blocks = collectBlocks(content);

  let ctaBlockCount = 0;
  let heroPresent = false;
  let textBlockCount = 0;
  const trustSignalsFound: string[] = [];

  const blob = JSON.stringify(blocks).toLowerCase();

  for (const b of blocks) {
    if (!isPlainObject(b)) continue;
    const type = asString(b.type).toLowerCase();
    if (type.includes("hero")) heroPresent = true;
    if (type.includes("text") || type === "richtext" || type === "richText") textBlockCount++;
    if (CTA_TYPES.has(type) || type.includes("cta")) ctaBlockCount++;
  }

  for (const kw of TRUST_KEYWORDS) {
    if (blob.includes(kw)) trustSignalsFound.push(kw);
  }

  let score = 100;

  if (!heroPresent && blocks.length > 0) {
    issues.push({ code: "no_hero", message: "Ingen tydelig hero — svekket førsteinntrykk og retning.", severity: "medium" });
    score -= 12;
    suggestions.push("Legg til en hero med ett hovedbudskap og én primær handling.");
  }

  if (ctaBlockCount === 0 && blocks.length > 0) {
    issues.push({ code: "no_cta", message: "Ingen tydelig CTA-blokk funnet.", severity: "high" });
    score -= 18;
    suggestions.push("Plasser én primær CTA above the fold og gjenta sekundær CTA lenger ned.");
  } else if (ctaBlockCount > 4) {
    issues.push({ code: "cta_noise", message: "Mange CTA-er kan øke friksjon og splitte oppmerksomhet.", severity: "low" });
    score -= 6;
    suggestions.push("Konsolider til én primær + én sekundær CTA per skjermseksjon.");
  }

  if (textBlockCount < 1 && blocks.length > 1) {
    issues.push({ code: "low_explanation", message: "Lite forklarende tekst — lavere tillit og konvertering.", severity: "medium" });
    score -= 10;
    suggestions.push("Legg til kort verdi-tekst (3–5 setninger) som reduserer usikkerhet før CTA.");
  }

  if (trustSignalsFound.length === 0 && blocks.length > 2) {
    issues.push({ code: "trust_thin", message: "Få synlige tillitssignaler (logo, sitat, sertifisering).", severity: "low" });
    score -= 7;
    suggestions.push("Vis 1–2 tillits-elementer nær CTA (kundelogo, kort sitat, sikkerhetssignal).");
  }

  const title = asString(content.title);
  if (title && title.split(/\s+/).length > 14) {
    issues.push({ code: "headline_verbose", message: "Lang tittel — kan svekke klarhet.", severity: "low" });
    score -= 4;
    suggestions.push("Kort ned hovedoverskrift til ett klart løfte + evt. undertittel.");
  }

  score = Math.max(0, Math.min(100, Math.round(score)));

  return {
    score,
    issues,
    suggestions,
    signals: { ctaBlockCount, heroPresent, textBlockCount, trustSignalsFound },
  };
}
