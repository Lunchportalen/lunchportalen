/**
 * UI readability analyzer capability: analyzeInterfaceReadability.
 * Analyzes interface text content for readability: sentence length, paragraph length,
 * heading hierarchy, and complexity. Returns score, metrics, issues, and suggestions. Deterministic; no LLM.
 * Import this module to register the capability.
 */

import type { Capability } from "../../capabilityRegistry";
import { registerCapability } from "../../capabilityRegistry";

const CAPABILITY_NAME = "analyzeInterfaceReadability";

const analyzeInterfaceReadabilityCapability: Capability = {
  name: CAPABILITY_NAME,
  description:
    "UI readability analyzer: from text blocks (headings, paragraphs, labels), analyzes sentence length, paragraph length, heading hierarchy, and word complexity. Returns readability score (0-100), metrics, issues, and suggestions. Deterministic; no LLM.",
  requiredContext: [],
  inputSchema: {
    type: "object",
    description: "Analyze interface readability input",
    properties: {
      textBlocks: {
        type: "array",
        description: "Text content to analyze",
        items: {
          type: "object",
          required: ["type", "text"],
          properties: {
            type: { type: "string", description: "heading | paragraph | label" },
            text: { type: "string" },
            level: { type: "number", description: "Heading level 1-6" },
          },
        },
      },
      locale: { type: "string", description: "Locale (nb | en) for messages" },
      maxWordsPerSentence: {
        type: "number",
        description: "Threshold for long sentence (default: 25)",
      },
      maxSentencesPerParagraph: {
        type: "number",
        description: "Threshold for dense paragraph (default: 5)",
      },
    },
    required: ["textBlocks"],
  },
  outputSchema: {
    type: "object",
    description: "Interface readability analysis result",
    required: ["readabilityScore", "metrics", "issues", "suggestions", "summary", "generatedAt"],
    properties: {
      readabilityScore: { type: "number", description: "0-100, higher = more readable" },
      metrics: {
        type: "object",
        required: [
          "blockCount",
          "wordCount",
          "avgWordsPerSentence",
          "avgSentencesPerParagraph",
          "longSentenceCount",
          "denseParagraphCount",
          "headingCount",
          "hasH1",
        ],
        properties: {
          blockCount: { type: "number" },
          wordCount: { type: "number" },
          avgWordsPerSentence: { type: "number" },
          avgSentencesPerParagraph: { type: "number" },
          longSentenceCount: { type: "number" },
          denseParagraphCount: { type: "number" },
          headingCount: { type: "number" },
          hasH1: { type: "boolean" },
        },
      },
      issues: {
        type: "array",
        items: {
          type: "object",
          required: ["code", "severity", "message", "suggestion", "blockRef"],
          properties: {
            code: { type: "string" },
            severity: { type: "string", enum: ["high", "medium", "low"] },
            message: { type: "string" },
            suggestion: { type: "string" },
            blockRef: { type: "string" },
          },
        },
      },
      suggestions: { type: "array", items: { type: "string" } },
      summary: { type: "string" },
      generatedAt: { type: "string", description: "ISO timestamp" },
    },
  },
  safetyConstraints: [
    { code: "read_only", description: "Analysis only; does not mutate interface or content.", enforce: "hard" },
  ],
  targetSurfaces: ["backoffice", "editor", "api"],
};

registerCapability(analyzeInterfaceReadabilityCapability);

export type ReadabilityTextBlock = {
  type: "heading" | "paragraph" | "label";
  text: string;
  level?: number | null;
};

export type AnalyzeInterfaceReadabilityInput = {
  textBlocks: ReadabilityTextBlock[];
  locale?: "nb" | "en" | null;
  maxWordsPerSentence?: number | null;
  maxSentencesPerParagraph?: number | null;
};

export type ReadabilityMetrics = {
  blockCount: number;
  wordCount: number;
  avgWordsPerSentence: number;
  avgSentencesPerParagraph: number;
  longSentenceCount: number;
  denseParagraphCount: number;
  headingCount: number;
  hasH1: boolean;
};

export type ReadabilityIssue = {
  code: string;
  severity: "high" | "medium" | "low";
  message: string;
  suggestion: string;
  blockRef: string;
};

export type AnalyzeInterfaceReadabilityOutput = {
  readabilityScore: number;
  metrics: ReadabilityMetrics;
  issues: ReadabilityIssue[];
  suggestions: string[];
  summary: string;
  generatedAt: string;
};

function safeStr(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function wordCount(s: string): number {
  return s.split(/\s+/).filter(Boolean).length;
}

function sentenceCount(s: string): number {
  const trimmed = s.trim();
  if (!trimmed) return 0;
  const parts = trimmed.split(/[.!?]+/).filter(Boolean);
  return parts.length || 1;
}

function sentences(s: string): string[] {
  return s.trim().split(/[.!?]+/).map((t) => t.trim()).filter(Boolean);
}

/**
 * Analyzes interface text blocks for readability. Deterministic; no external calls.
 */
export function analyzeInterfaceReadability(input: AnalyzeInterfaceReadabilityInput): AnalyzeInterfaceReadabilityOutput {
  const blocks = Array.isArray(input.textBlocks) ? input.textBlocks : [];
  const isEn = input.locale === "en";
  const maxWordsPerSentence = Math.max(5, Math.min(50, Number(input.maxWordsPerSentence) || 25));
  const maxSentencesPerParagraph = Math.max(2, Math.min(15, Number(input.maxSentencesPerParagraph) || 5));

  const issues: ReadabilityIssue[] = [];
  const suggestions: string[] = [];
  let totalWords = 0;
  let totalSentences = 0;
  let totalParagraphs = 0;
  let longSentenceCount = 0;
  let denseParagraphCount = 0;
  let headingCount = 0;
  let hasH1 = false;

  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];
    if (!b || typeof b !== "object") continue;

    const type = b.type === "heading" || b.type === "paragraph" || b.type === "label" ? b.type : "paragraph";
    const text = safeStr(b.text);
    const ref = `block_${i}`;

    if (type === "heading") {
      headingCount++;
      const level = Math.min(6, Math.max(1, Number(b.level) || 1));
      if (level === 1) hasH1 = true;
      const words = wordCount(text);
      if (words > 15) {
        issues.push({
          code: "heading_too_long",
          severity: "medium",
          message: isEn ? "Heading is long; may hurt scannability." : "Overskriften er lang; kan svekte skanbarhet.",
          suggestion: isEn ? "Keep headings under 10–12 words." : "Hold overskrifter under 10–12 ord.",
          blockRef: ref,
        });
      }
      if (words === 0) {
        issues.push({
          code: "heading_empty",
          severity: "high",
          message: isEn ? "Heading has no text." : "Overskrift har ingen tekst.",
          suggestion: isEn ? "Add concise heading text." : "Legg til kort overskriftstekst.",
          blockRef: ref,
        });
      }
      continue;
    }

    if (type === "paragraph" || type === "label") {
      const sents = sentences(text);
      const sentCount = sents.length || (text ? 1 : 0);
      totalParagraphs++;
      totalSentences += sentCount;

      const words = wordCount(text);
      totalWords += words;

      if (type === "paragraph" && sentCount > maxSentencesPerParagraph) {
        denseParagraphCount++;
        issues.push({
          code: "paragraph_dense",
          severity: "medium",
          message: isEn ? `Paragraph has ${sentCount} sentences; consider splitting.` : `Avsnittet har ${sentCount} setninger; vurder å dele opp.`,
          suggestion: isEn ? "Use 3–5 sentences per paragraph for readability." : "Bruk 3–5 setninger per avsnitt for lesbarhet.",
          blockRef: ref,
        });
      }

      for (let j = 0; j < sents.length; j++) {
        const w = wordCount(sents[j]);
        if (w > maxWordsPerSentence) {
          longSentenceCount++;
          if (longSentenceCount <= 3) {
            issues.push({
              code: "sentence_long",
              severity: "low",
              message: isEn ? `Sentence has ${w} words (threshold ${maxWordsPerSentence}).` : `Setningen har ${w} ord (terskel ${maxWordsPerSentence}).`,
              suggestion: isEn ? "Shorten or split long sentences." : "Forkort eller del lange setninger.",
              blockRef: ref,
            });
          }
        }
      }

      if (type === "label" && words > 5) {
        issues.push({
          code: "label_long",
          severity: "low",
          message: isEn ? "Label text is long; keep labels short." : "Etikettekst er lang; hold etiketter korte.",
          suggestion: isEn ? "Use 1–4 words for labels where possible." : "Bruk 1–4 ord for etiketter der mulig.",
          blockRef: ref,
        });
      }
    }
  }

  const avgWordsPerSentence = totalSentences > 0 ? Math.round((totalWords / totalSentences) * 10) / 10 : 0;
  const avgSentencesPerParagraph = totalParagraphs > 0 ? Math.round((totalSentences / totalParagraphs) * 10) / 10 : 0;

  if (blocks.some((b) => b?.type === "heading") && !hasH1) {
    issues.push({
      code: "no_h1",
      severity: "high",
      message: isEn ? "No H1 heading; add one for structure and SEO." : "Ingen H1-overskrift; legg til én for struktur og SEO.",
      suggestion: isEn ? "Use exactly one H1 per view." : "Bruk nøyaktig én H1 per visning.",
      blockRef: "page",
    });
  }

  if (avgWordsPerSentence > 20 && totalSentences >= 3) {
    suggestions.push(isEn ? "Consider shorter sentences on average (aim for ~15–18 words)." : "Vurder kortere setninger i snitt (mål ~15–18 ord).");
  }
  if (longSentenceCount > 0) {
    suggestions.push(isEn ? `Shorten or split ${longSentenceCount} long sentence(s).` : `Forkort eller del ${longSentenceCount} lang(e) setning(er).`);
  }
  if (denseParagraphCount > 0) {
    suggestions.push(isEn ? `Split ${denseParagraphCount} dense paragraph(s) for scannability.` : `Del opp ${denseParagraphCount} tette avsnitt for skanbarhet.`);
  }
  if (headingCount === 0 && totalWords > 50) {
    suggestions.push(isEn ? "Add headings to break up long content." : "Legg til overskrifter for å bryte opp langt innhold.");
  }

  let score = 100;
  score -= issues.filter((i) => i.severity === "high").length * 12;
  score -= issues.filter((i) => i.severity === "medium").length * 6;
  score -= issues.filter((i) => i.severity === "low").length * 2;
  if (avgWordsPerSentence > 22 && totalSentences >= 2) score -= 5;
  if (denseParagraphCount > 0) score -= Math.min(15, denseParagraphCount * 5);
  const readabilityScore = Math.max(0, Math.min(100, score));

  const metrics: ReadabilityMetrics = {
    blockCount: blocks.length,
    wordCount: totalWords,
    avgWordsPerSentence,
    avgSentencesPerParagraph,
    longSentenceCount,
    denseParagraphCount,
    headingCount,
    hasH1,
  };

  const summary = isEn
    ? `Readability: score ${readabilityScore}/100. ${metrics.wordCount} words, ${metrics.blockCount} blocks; ${issues.length} issue(s). ${metrics.hasH1 ? "H1 present." : "No H1."}`
    : `Lesbarhet: score ${readabilityScore}/100. ${metrics.wordCount} ord, ${metrics.blockCount} blokker; ${issues.length} problem(er). ${metrics.hasH1 ? "H1 finnes." : "Ingen H1."}`;

  return {
    readabilityScore,
    metrics,
    issues,
    suggestions,
    summary,
    generatedAt: new Date().toISOString(),
  };
}

export { analyzeInterfaceReadabilityCapability, CAPABILITY_NAME };
