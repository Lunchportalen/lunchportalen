/**
 * Automatic A/B test generator capability: generateABTests.
 * Generates ready-to-run A/B test specs from page context: test id, name, element,
 * control value, variant value(s), metric, and suggested duration.
 * Deterministic; no LLM. Import this module to register the capability.
 */

import type { Capability } from "../capabilityRegistry";
import { registerCapability } from "../capabilityRegistry";

const CAPABILITY_NAME = "generateABTests";

const generateABTestsCapability: Capability = {
  name: CAPABILITY_NAME,
  description:
    "Automatic A/B test generator: produces ready-to-run A/B test specs from page context (blocks, goal). Returns test id, name, element (headline, cta, intro, hero_image, layout), control value, variant value(s), metric, suggested duration. Deterministic; no LLM.",
  requiredContext: [],
  inputSchema: {
    type: "object",
    description: "Generate A/B tests input",
    properties: {
      blocks: {
        type: "array",
        description: "Optional page blocks (hero, cta, richText) to derive control values",
        items: { type: "object" },
      },
      pageGoal: { type: "string", description: "Optional: conversion | signup | contact | lead" },
      locale: { type: "string", description: "Locale (nb | en) for copy" },
      maxTests: { type: "number", description: "Max tests to generate (default 6)" },
    },
    required: [],
  },
  outputSchema: {
    type: "object",
    description: "Generated A/B tests",
    required: ["tests", "summary"],
    properties: {
      tests: {
        type: "array",
        items: {
          type: "object",
          required: ["testId", "name", "element", "controlValue", "variantValue", "metric", "suggestedDuration"],
          properties: {
            testId: { type: "string" },
            name: { type: "string" },
            element: { type: "string", description: "headline | cta | intro | hero_image | layout" },
            controlValue: { type: "string" },
            variantValue: { type: "string" },
            variantValueB: { type: "string", description: "Optional third variant for A/B/C" },
            metric: { type: "string" },
            suggestedDuration: { type: "string" },
            priority: { type: "string", description: "high | medium | low" },
          },
        },
      },
      summary: { type: "string" },
      generatedAt: { type: "string", description: "ISO timestamp" },
    },
  },
  safetyConstraints: [
    { code: "suggestions_only", description: "Output is test specs only; no content or experiment mutation.", enforce: "hard" },
  ],
  targetSurfaces: ["backoffice", "editor", "api"],
};

registerCapability(generateABTestsCapability);

export type BlockLike = { type?: string | null; title?: string | null; heading?: string | null; body?: string | null; buttonLabel?: string | null };

export type GenerateABTestsInput = {
  blocks?: BlockLike[] | null;
  pageGoal?: string | null;
  locale?: "nb" | "en" | null;
  maxTests?: number | null;
};

export type GeneratedABTest = {
  testId: string;
  name: string;
  element: "headline" | "cta" | "intro" | "hero_image" | "layout";
  controlValue: string;
  variantValue: string;
  variantValueB?: string | null;
  metric: string;
  suggestedDuration: string;
  priority: "high" | "medium" | "low";
};

export type GenerateABTestsOutput = {
  tests: GeneratedABTest[];
  summary: string;
  generatedAt: string;
};

function hasBlockType(blocks: BlockLike[], type: string): boolean {
  return Array.isArray(blocks) && blocks.some((b) => (b.type ?? "").toLowerCase() === type.toLowerCase());
}

function getFirst(blocks: BlockLike[], type: string, field: string): string | null {
  if (!Array.isArray(blocks)) return null;
  const b = blocks.find((x) => (x.type ?? "").toLowerCase() === type.toLowerCase());
  if (!b) return null;
  const v = (b as Record<string, unknown>)[field];
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

/**
 * Generates A/B test specs from page context. Deterministic; no external calls.
 */
export function generateABTests(input: GenerateABTestsInput = {}): GenerateABTestsOutput {
  const locale = input.locale === "en" ? "en" : "nb";
  const isEn = locale === "en";
  const maxTests = Math.min(12, Math.max(1, Math.floor(Number(input.maxTests) ?? 6)));
  const blocks = Array.isArray(input.blocks) ? input.blocks : [];

  const headline = getFirst(blocks, "hero", "title") ?? getFirst(blocks, "richText", "heading");
  const ctaLabel = getFirst(blocks, "cta", "buttonLabel");
  const hasHero = hasBlockType(blocks, "hero");
  const hasCta = hasBlockType(blocks, "cta");
  const hasRichText = hasBlockType(blocks, "richText");

  const tests: GeneratedABTest[] = [];
  const duration = isEn ? "2–4 weeks, min 100 conversions per variant" : "2–4 uker, min 100 konverteringer per variant";

  if ((hasHero || hasRichText) && tests.length < maxTests) {
    tests.push({
      testId: "ab-headline",
      name: isEn ? "Headline: benefit-led vs current" : "Overskrift: fordel vs nåværende",
      element: "headline",
      controlValue: headline || (isEn ? "Current headline" : "Nåværende overskrift"),
      variantValue: isEn ? "Short benefit-focused headline (5–8 words)" : "Kort fordel-fokusert overskrift (5–8 ord)",
      metric: isEn ? "CTA clicks / conversions" : "CTA-klikk / konverteringer",
      suggestedDuration: duration,
      priority: "high",
    });
  }

  if (hasCta && tests.length < maxTests) {
    tests.push({
      testId: "ab-cta-label",
      name: isEn ? "CTA button: action vs outcome" : "CTA-knapp: handling vs resultat",
      element: "cta",
      controlValue: ctaLabel || (isEn ? "Current button" : "Nåværende knapp"),
      variantValue: isEn ? "Get started" : "Kom i gang",
      variantValueB: isEn ? "See offer" : "Se tilbud",
      metric: isEn ? "CTA click-through rate" : "CTA klikk-rate",
      suggestedDuration: duration,
      priority: "high",
    });
  }

  if (hasCta && tests.length < maxTests) {
    tests.push({
      testId: "ab-cta-length",
      name: isEn ? "CTA: short (1–2 words) vs long" : "CTA: kort (1–2 ord) vs lang",
      element: "cta",
      controlValue: ctaLabel || (isEn ? "Current" : "Nåværende"),
      variantValue: isEn ? "Contact" : "Kontakt",
      metric: isEn ? "CTA click-through rate" : "CTA klikk-rate",
      suggestedDuration: duration,
      priority: "medium",
    });
  }

  if (hasRichText && tests.length < maxTests) {
    tests.push({
      testId: "ab-intro-length",
      name: isEn ? "Intro: short vs long first paragraph" : "Intro: kort vs lang første avsnitt",
      element: "intro",
      controlValue: isEn ? "Current intro length" : "Nåværende introlengde",
      variantValue: isEn ? "1–2 sentences above fold, expand below" : "1–2 setninger over fold, utdyp under",
      metric: isEn ? "Scroll depth / CTA clicks" : "Scroll-dybde / CTA-klikk",
      suggestedDuration: duration,
      priority: "medium",
    });
  }

  if (hasHero && tests.length < maxTests) {
    tests.push({
      testId: "ab-hero-image",
      name: isEn ? "Hero: with image vs without / different" : "Hero: med bilde vs uten / annet",
      element: "hero_image",
      controlValue: isEn ? "Current hero image" : "Nåværende hero-bilde",
      variantValue: isEn ? "No image / minimal" : "Ingen bilde / minimalt",
      metric: isEn ? "Time on page / CTA clicks" : "Tid på side / CTA-klikk",
      suggestedDuration: duration,
      priority: "low",
    });
  }

  tests.push({
    testId: "ab-cta-placement",
    name: isEn ? "CTA placement: current vs above fold" : "CTA-plassering: nåværende vs over fold",
    element: "layout",
    controlValue: isEn ? "Current CTA position" : "Nåværende CTA-plassering",
    variantValue: isEn ? "CTA above fold or after first section" : "CTA over fold eller etter første seksjon",
    metric: isEn ? "CTA clicks / conversions" : "CTA-klikk / konverteringer",
    suggestedDuration: duration,
    priority: "high",
  });

  if (tests.length < maxTests) {
    tests.push({
      testId: "ab-trust-line",
      name: isEn ? "Trust: none vs short line near CTA" : "Tillit: ingen vs kort linje nær CTA",
      element: "layout",
      controlValue: isEn ? "No trust line" : "Ingen tillitslinje",
      variantValue: isEn ? "Short trust line near CTA (e.g. Used by X companies)" : "Kort tillitslinje nær CTA (f.eks. Brukes av X bedrifter)",
      metric: isEn ? "CTA click-through rate" : "CTA klikk-rate",
      suggestedDuration: duration,
      priority: "low",
    });
  }

  const out = tests.slice(0, maxTests);
  const summary = isEn
    ? `Generated ${out.length} A/B test(s). Run with suggested duration and metric.`
    : `Genererte ${out.length} A/B-test(er). Kjør med anbefalt varighet og måling.`;

  return {
    tests: out,
    summary,
    generatedAt: new Date().toISOString(),
  };
}

export { generateABTestsCapability, CAPABILITY_NAME };
