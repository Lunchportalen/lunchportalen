import "server-only";

import type { CMSContentInput, SeoAnalysisResult, SeoIssue } from "@/lib/ai/types";

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

function collectTextFromBlocks(blocks: unknown[], maxChars = 50_000): string {
  const parts: string[] = [];
  const walk = (node: unknown) => {
    if (parts.join(" ").length > maxChars) return;
    if (typeof node === "string") {
      parts.push(node);
      return;
    }
    if (Array.isArray(node)) {
      for (const x of node) walk(x);
      return;
    }
    if (!isPlainObject(node)) return;
    for (const k of ["text", "body", "title", "heading", "label", "description", "content", "html"]) {
      const v = node[k];
      if (typeof v === "string") parts.push(v);
    }
    for (const v of Object.values(node)) walk(v);
  };
  walk(blocks);
  return parts.join(" \n ");
}

function countWords(text: string): number {
  const t = text.trim();
  if (!t) return 0;
  return t.split(/\s+/).filter(Boolean).length;
}

function headingLikeCount(blocks: unknown[]): number {
  let n = 0;
  for (const b of blocks) {
    if (!isPlainObject(b)) continue;
    const type = asString(b.type).toLowerCase();
    if (type.includes("heading") || type === "h1" || type === "h2" || type === "h3") n++;
    const t = asString(b.title) || asString(b.heading);
    if (t && type.includes("hero")) n++;
  }
  return n;
}

function keywordHints(content: CMSContentInput, bodyText: string): string[] {
  const kw = content.keywords;
  if (Array.isArray(kw)) {
    return kw.map((x) => (typeof x === "string" ? x.trim() : "")).filter(Boolean).slice(0, 12);
  }
  const title = asString(content.title);
  const slug = asString(content.slug);
  const hints: string[] = [];
  if (title) hints.push(title.split(/\s+/).slice(0, 4).join(" ").toLowerCase());
  if (slug) hints.push(slug.replace(/-/g, " "));
  const words = bodyText.toLowerCase().match(/\b[\p{L}]{4,}\b/gu) ?? [];
  const freq = new Map<string, number>();
  for (const w of words) freq.set(w, (freq.get(w) ?? 0) + 1);
  const top = [...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([w]) => w);
  return [...hints, ...top].filter(Boolean).slice(0, 8);
}

/**
 * Rule-based SEO pass (fast, deterministic). Complements LLM tools elsewhere; no network I/O.
 */
export function analyzeSeo(content: CMSContentInput): SeoAnalysisResult {
  const issues: SeoIssue[] = [];
  const improvements: string[] = [];

  const title = asString(content.title) || asString(content.metaTitle);
  const meta = asString(content.metaDescription) || asString(content.description);
  const blocks = collectBlocks(content);
  const blob = collectTextFromBlocks(blocks) + " " + asString(content.body);
  const wordCount = countWords(blob);
  const titleLength = title.length;
  const metaLength = meta.length;
  const headingCount = headingLikeCount(blocks);
  const hints = keywordHints(content, blob);

  let score = 100;

  if (!title) {
    issues.push({ code: "missing_title", message: "Tittel mangler — kritisk for SEO.", severity: "high" });
    score -= 25;
    improvements.push("Legg til en klar sidetittel (ca. 30–60 tegn) som beskriver innholdet.");
  } else if (titleLength < 25) {
    issues.push({ code: "title_short", message: "Tittel er kort — kan svekke klikk og relevans.", severity: "medium" });
    score -= 10;
    improvements.push("Utvid tittelen med primærnøkkelord uten å fylle med fluff.");
  } else if (titleLength > 65) {
    issues.push({ code: "title_long", message: "Tittel risikerer å kuttes i SERP.", severity: "low" });
    score -= 5;
    improvements.push("Kort inn tittelen mot ~60 tegn; behold viktigste ord først.");
  }

  if (!meta) {
    issues.push({ code: "missing_meta", message: "Meta-beskrivelse mangler.", severity: "medium" });
    score -= 12;
    improvements.push("Skriv en meta-beskrivelse (120–160 tegn) med verdiforslag og CTA-linte.");
  } else if (metaLength < 80) {
    issues.push({ code: "meta_thin", message: "Meta-beskrivelse er tynn.", severity: "low" });
    score -= 6;
    improvements.push("Berik meta med konkret nytte og ett klart søkeintensjonord.");
  } else if (metaLength > 170) {
    issues.push({ code: "meta_long", message: "Meta kan bli avkortet i SERP.", severity: "low" });
    score -= 4;
    improvements.push("Trim meta til under ~160 tegn; start med sterkest budskap.");
  }

  if (headingCount < 1 && wordCount > 80) {
    issues.push({ code: "headings_weak", message: "Få eller ingen tydelige overskrifter i innhold.", severity: "medium" });
    score -= 10;
    improvements.push("Strukturer med H2/H3 som speiler søkehensikt og scannbarhet.");
  }

  if (wordCount < 120) {
    issues.push({ code: "thin_content", message: "Lite tekstdybde — lav topical authority.", severity: "medium" });
    score -= 12;
    improvements.push("Utvid med 1–2 avsnitt som svarer på «hvorfor nå» og «hva får jeg».");
  } else if (wordCount > 3500) {
    issues.push({ code: "dense_content", message: "Svært lang tekst — vurder seksjoner og TOC.", severity: "low" });
    score -= 3;
    improvements.push("Del opp i seksjoner med overskrifter og korte avsnitt for mobil.");
  }

  const lower = `${title} ${meta} ${blob}`.toLowerCase();
  const missingKw = hints.filter((h) => h && !lower.includes(h.toLowerCase().slice(0, 12)));
  if (hints.length >= 2 && missingKw.length === hints.length) {
    issues.push({ code: "keyword_gap", message: "Foreslåtte nøkkelord synes ikke tydelig i synlig tekst.", severity: "low" });
    score -= 5;
    improvements.push("Naturlig innfletting av primærnøkkelord i ingress og én H2.");
  }

  score = Math.max(0, Math.min(100, Math.round(score)));

  return {
    score,
    issues,
    improvements,
    signals: { titleLength, metaLength, headingCount, wordCount, keywordHints: hints },
  };
}
