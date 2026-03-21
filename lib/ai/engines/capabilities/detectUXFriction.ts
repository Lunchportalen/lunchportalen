/**
 * AI UX friction detector capability: detectUXFriction.
 * Uses scroll depth and click rate to detect friction (e.g. shallow scroll, low engagement).
 * Deterministic; no LLM. Import this module to register the capability.
 */

import type { Capability } from "../capabilityRegistry";
import { registerCapability } from "../capabilityRegistry";

const CAPABILITY_NAME = "detectUXFriction";

const detectUXFrictionCapability: Capability = {
  name: CAPABILITY_NAME,
  description:
    "Detects UX friction from scroll depth and click rate. Low scroll depth or low click rate may indicate drop-off, unclear CTAs, or content that fails to engage. Returns friction signals, severity, and suggestions.",
  requiredContext: ["scrollDepth", "clickRate"],
  inputSchema: {
    type: "object",
    description: "Detect UX friction input",
    properties: {
      scrollDepth: {
        type: "number",
        description: "Average scroll depth 0-1 (e.g. 0.5 = 50% of page) or 0-100 (treated as percentage)",
      },
      clickRate: {
        type: "number",
        description: "Click rate 0-1 (e.g. CTA clicks / views) or 0-100 (treated as percentage)",
      },
      pageViews: {
        type: "number",
        description: "Optional: view count for context (e.g. low volume = low confidence)",
      },
      scrollDepthThreshold: {
        type: "number",
        description: "Scroll depth below this is friction (0-1, default 0.4)",
      },
      clickRateThreshold: {
        type: "number",
        description: "Click rate below this is friction (0-1, default 0.02)",
      },
      locale: { type: "string", description: "Locale (nb | en) for messages" },
    },
    required: ["scrollDepth", "clickRate"],
  },
  outputSchema: {
    type: "object",
    description: "UX friction detection result",
    required: ["frictionDetected", "signals", "severity", "suggestions", "summary", "metrics"],
    properties: {
      frictionDetected: { type: "boolean", description: "True if one or more friction signals" },
      signals: {
        type: "array",
        items: { type: "string", description: "e.g. low_scroll_depth | low_click_rate" },
      },
      severity: { type: "string", description: "low | medium | high" },
      suggestions: {
        type: "array",
        items: { type: "string" },
      },
      summary: { type: "string" },
      metrics: {
        type: "object",
        required: ["scrollDepth", "clickRate"],
        properties: {
          scrollDepth: { type: "number", description: "Normalized 0-1" },
          clickRate: { type: "number", description: "Normalized 0-1" },
          scrollDepthThreshold: { type: "number" },
          clickRateThreshold: { type: "number" },
        },
      },
    },
  },
  safetyConstraints: [
    { code: "detection_only", description: "Output is detection only; no content or system mutation.", enforce: "hard" },
  ],
  targetSurfaces: ["backoffice", "api", "editor"],
};

registerCapability(detectUXFrictionCapability);

export type DetectUXFrictionInput = {
  /** Scroll depth 0-1 or 0-100 (percent). */
  scrollDepth: number;
  /** Click rate 0-1 or 0-100 (percent). */
  clickRate: number;
  /** Optional view count for context. */
  pageViews?: number | null;
  /** Below this (0-1) = low scroll friction. Default 0.4. */
  scrollDepthThreshold?: number | null;
  /** Below this (0-1) = low click friction. Default 0.02. */
  clickRateThreshold?: number | null;
  locale?: "nb" | "en" | null;
};

export type DetectUXFrictionOutput = {
  frictionDetected: boolean;
  signals: ("low_scroll_depth" | "low_click_rate")[];
  severity: "low" | "medium" | "high";
  suggestions: string[];
  summary: string;
  metrics: {
    scrollDepth: number;
    clickRate: number;
    scrollDepthThreshold: number;
    clickRateThreshold: number;
  };
};

function normalizeRatio(v: number): number {
  if (typeof v !== "number" || Number.isNaN(v)) return 0;
  if (v > 1) return Math.min(1, v / 100);
  return Math.max(0, Math.min(1, v));
}

/**
 * Detects UX friction from scroll depth and click rate.
 * Flags low scroll depth and/or low click rate; returns severity and suggestions.
 * Deterministic; no external calls.
 */
export function detectUXFriction(input: DetectUXFrictionInput): DetectUXFrictionOutput {
  const isEn = input.locale === "en";
  const scrollDepth = normalizeRatio(input.scrollDepth);
  const clickRate = normalizeRatio(input.clickRate);
  const scrollThreshold = Math.max(0, Math.min(1, Number(input.scrollDepthThreshold) ?? 0.4));
  const clickThreshold = Math.max(0, Math.min(1, Number(input.clickRateThreshold) ?? 0.02));

  const signals: ("low_scroll_depth" | "low_click_rate")[] = [];
  if (scrollDepth < scrollThreshold) signals.push("low_scroll_depth");
  if (clickRate < clickThreshold) signals.push("low_click_rate");

  const frictionDetected = signals.length > 0;

  let severity: "low" | "medium" | "high" = "low";
  if (signals.length === 2) {
    severity = scrollDepth < scrollThreshold * 0.5 && clickRate < clickThreshold * 0.5 ? "high" : "medium";
  } else if (signals.length === 1) {
    const bad = signals[0] === "low_scroll_depth" ? scrollDepth < scrollThreshold * 0.5 : clickRate < clickThreshold * 0.5;
    severity = bad ? "medium" : "low";
  }

  const suggestions: string[] = [];
  if (signals.includes("low_scroll_depth")) {
    suggestions.push(
      isEn
        ? "Improve scroll depth: shorten above-the-fold content, add clear value proposition, or reduce perceived length."
        : "Forbedre rulledybde: forkort innhold over brettet, tydeliggjør verdi, eller reduser opplevd lengde."
    );
  }
  if (signals.includes("low_click_rate")) {
    suggestions.push(
      isEn
        ? "Improve click rate: make primary CTA more visible, reduce competing links, or clarify next step."
        : "Forbedre klikkrate: gjør hovedhandlingen tydeligere, reduser konkurrerende lenker, eller tydeliggjør neste steg."
    );
  }
  if (!frictionDetected) {
    suggestions.push(
      isEn ? "Scroll depth and click rate are within expected range." : "Rulledybde og klikkrate er innenfor forventet område."
    );
  }

  const summary = frictionDetected
    ? isEn
      ? `UX friction: ${signals.join(", ").replace(/_/g, " ")}. Severity: ${severity}.`
      : `UX-friksjon: ${signals.join(", ").replace(/_/g, " ")}. Alvorlighet: ${severity}.`
    : isEn
      ? "No UX friction detected from scroll depth and click rate."
      : "Ingen UX-friksjon funnet fra rulledybde og klikkrate.";

  return {
    frictionDetected,
    signals,
    severity,
    suggestions,
    summary,
    metrics: {
      scrollDepth,
      clickRate,
      scrollDepthThreshold: scrollThreshold,
      clickRateThreshold: clickThreshold,
    },
  };
}

export { detectUXFrictionCapability, CAPABILITY_NAME };
