/**
 * AI readability analysis capability: analyzeReadability.
 * Computes readability metrics (sentence length, word length, grade level, score) and suggestions.
 * Deterministic; no LLM. Import this module to register the capability.
 */

import type { Capability } from "../../capabilityRegistry";
import { registerCapability } from "../../capabilityRegistry";

const CAPABILITY_NAME = "analyzeReadability";

const analyzeReadabilityCapability: Capability = {
  name: CAPABILITY_NAME,
  description:
    "Analyzes text readability: average sentence length, word length, approximate grade level, and a 0–100 readability score. Returns metrics and optional suggestions to improve readability.",
  requiredContext: ["content"],
  inputSchema: {
    type: "object",
    description: "Analyze readability input",
    properties: {
      content: {
        type: "object",
        description: "Content to analyze",
        properties: {
          plainText: { type: "string", description: "Full text to analyze" },
          blocks: {
            type: "array",
            description: "Content blocks (heading, body) – text extracted if plainText not set",
            items: { type: "object" },
          },
        },
      },
      locale: { type: "string", description: "Locale (nb | en) for suggestions" },
    },
    required: ["content"],
  },
  outputSchema: {
    type: "object",
    description: "Readability analysis result",
    required: ["score", "metrics", "suggestions", "summary"],
    properties: {
      score: { type: "number", description: "Readability score 0-100 (higher = easier to read)" },
      metrics: {
        type: "object",
        required: ["wordCount", "sentenceCount", "avgSentenceLength", "avgWordLength", "longWordsCount", "gradeLevel"],
        properties: {
          wordCount: { type: "number" },
          sentenceCount: { type: "number" },
          avgSentenceLength: { type: "number", description: "Words per sentence" },
          avgWordLength: { type: "number", description: "Characters per word" },
          longWordsCount: { type: "number", description: "Words longer than 12 characters" },
          gradeLevel: { type: "number", description: "Approximate US grade level (e.g. 8 = 8th grade)" },
        },
      },
      suggestions: {
        type: "array",
        items: { type: "string", description: "Tip to improve readability" },
      },
      summary: { type: "string", description: "Short overall summary" },
    },
  },
  safetyConstraints: [
    { code: "read_only", description: "Output is analysis only; no content or system mutation.", enforce: "hard" },
  ],
  targetSurfaces: ["backoffice", "editor", "api"],
};

registerCapability(analyzeReadabilityCapability);

export type ReadabilityContentInput = {
  plainText?: string | null;
  blocks?: Array<{ heading?: string | null; body?: string | null }> | null;
};

export type AnalyzeReadabilityInput = {
  content: ReadabilityContentInput;
  locale?: "nb" | "en" | null;
};

export type ReadabilityMetrics = {
  wordCount: number;
  sentenceCount: number;
  avgSentenceLength: number;
  avgWordLength: number;
  longWordsCount: number;
  gradeLevel: number;
};

export type AnalyzeReadabilityOutput = {
  score: number;
  metrics: ReadabilityMetrics;
  suggestions: string[];
  summary: string;
};

const LONG_WORD_CHARS = 12;
const IDEAL_SENTENCE_LENGTH = 15;
const MAX_SENTENCE_LENGTH_OK = 25;
const IDEAL_GRADE_LEVEL = 8;

function extractText(content: ReadabilityContentInput): string {
  const plain = (content.plainText ?? "").trim();
  if (plain) return plain;
  const blocks = Array.isArray(content.blocks) ? content.blocks : [];
  const parts: string[] = [];
  for (const b of blocks) {
    const h = (b?.heading ?? "").trim();
    const body = (b?.body ?? "").trim();
    if (h) parts.push(h);
    if (body) parts.push(body);
  }
  return parts.join(" ");
}

function splitSentences(text: string): string[] {
  if (!text.trim()) return [];
  const normalized = text
    .replace(/([.!?])\s+/g, "$1\n")
    .split(/\n/)
    .map((s) => s.trim())
    .filter(Boolean);
  return normalized.length > 0 ? normalized : [text];
}

function countSyllablesApprox(word: string): number {
  const w = word.toLowerCase().replace(/\W/g, "");
  if (w.length <= 3) return 1;
  const vowels = w.replace(/[^aeiouyæøå]/gi, "").length;
  if (vowels === 0) return 1;
  return Math.max(1, Math.min(vowels, Math.ceil(w.length / 3)));
}

/**
 * Analyzes readability: metrics and a 0–100 score (higher = easier to read).
 * Grade level via simplified Flesch–Kincaid–style formula; score inverts grade level.
 * Deterministic; no external calls.
 */
export function analyzeReadability(input: AnalyzeReadabilityInput): AnalyzeReadabilityOutput {
  const isEn = input.locale === "en";
  const text = extractText(input.content ?? {});
  const sentences = splitSentences(text);
  const sentenceCount = sentences.length;
  const words: string[] = text.split(/\s+/).filter((w) => w.length > 0);
  const wordCount = words.length;

  const longWords = words.filter((w) => w.replace(/\W/g, "").length > LONG_WORD_CHARS);
  const longWordsCount = longWords.length;
  const totalChars = words.reduce((acc, w) => acc + w.replace(/\W/g, "").length, 0);
  const avgWordLength = wordCount > 0 ? Math.round((totalChars / wordCount) * 10) / 10 : 0;
  const avgSentenceLength =
    sentenceCount > 0 ? Math.round((wordCount / sentenceCount) * 10) / 10 : 0;

  const totalSyllables = words.reduce((acc, w) => acc + countSyllablesApprox(w), 0);
  const syllablesPerWord = wordCount > 0 ? totalSyllables / wordCount : 0;
  const wordsPerSentence = sentenceCount > 0 ? wordCount / sentenceCount : 0;
  const gradeLevel =
    wordCount >= 10 && sentenceCount >= 1
      ? Math.round(
          (0.39 * wordsPerSentence + 11.8 * syllablesPerWord - 15.59) * 10
        ) / 10
      : 0;
  const clampedGrade = Math.max(1, Math.min(24, gradeLevel));

  const scoreFromGrade = 100 - (clampedGrade - 1) * (80 / 23);
  const scoreFromSentence =
    avgSentenceLength <= IDEAL_SENTENCE_LENGTH
      ? 100
      : avgSentenceLength >= MAX_SENTENCE_LENGTH_OK
        ? 50
        : 100 - ((avgSentenceLength - IDEAL_SENTENCE_LENGTH) / (MAX_SENTENCE_LENGTH_OK - IDEAL_SENTENCE_LENGTH)) * 50;
  const longWordRatio = wordCount > 0 ? longWordsCount / wordCount : 0;
  const scoreFromLongWords = longWordRatio <= 0.05 ? 100 : Math.max(0, 100 - longWordRatio * 400);
  const score = Math.round(
    (Math.max(0, scoreFromGrade) * 0.5 + scoreFromSentence * 0.3 + scoreFromLongWords * 0.2)
  );
  const finalScore = Math.max(0, Math.min(100, score));

  const suggestions: string[] = [];
  if (avgSentenceLength > MAX_SENTENCE_LENGTH_OK) {
    suggestions.push(
      isEn
        ? "Shorten long sentences; aim for under 25 words per sentence."
        : "Forkort lange setninger; sikt mot under 25 ord per setning."
    );
  }
  if (longWordsCount > 0 && longWordRatio > 0.1) {
    suggestions.push(
      isEn
        ? "Replace some long words with shorter alternatives where possible."
        : "Bytt ut noen lange ord med kortere alternativer der det er mulig."
    );
  }
  if (clampedGrade > 12) {
    suggestions.push(
      isEn
        ? "Simplify language to reach a broader audience (lower grade level)."
        : "Forenkle språket for å nå et bredere publikum (lavere lesenivå)."
    );
  }
  if (suggestions.length === 0 && wordCount >= 20) {
    suggestions.push(
      isEn ? "Readability is within a good range." : "Lesbarheten er innenfor et godt område."
    );
  }

  const summary = isEn
    ? `Readability ${finalScore}/100. ~Grade ${clampedGrade}, ${avgSentenceLength} words/sentence, ${longWordsCount} long words.`
    : `Lesbarhet ${finalScore}/100. Ca. trinn ${clampedGrade}, ${avgSentenceLength} ord/setning, ${longWordsCount} lange ord.`;

  return {
    score: finalScore,
    metrics: {
      wordCount,
      sentenceCount,
      avgSentenceLength,
      avgWordLength,
      longWordsCount,
      gradeLevel: clampedGrade,
    },
    suggestions,
    summary,
  };
}

export { analyzeReadabilityCapability, CAPABILITY_NAME };
