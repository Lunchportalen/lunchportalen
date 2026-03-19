/**
 * Behavioral pattern detector capability: detectUserPatterns.
 * Detects user behavioral patterns from aggregated session/event metrics:
 * bouncer, researcher, high_intent, repeat_visitor, short_session, converter, etc.
 * Returns pattern id, label, strength, description, and recommendation. Deterministic; no LLM.
 * Import this module to register the capability.
 */

import type { Capability } from "../capabilityRegistry";
import { registerCapability } from "../capabilityRegistry";

const CAPABILITY_NAME = "detectUserPatterns";

const detectUserPatternsCapability: Capability = {
  name: CAPABILITY_NAME,
  description:
    "Behavioral pattern detector: detects user patterns from aggregated metrics (sessions, pages per session, bounce rate, session duration, return rate, conversion rate). Returns patterns: bouncer, researcher, high_intent, repeat_visitor, short_session, converter, low_engagement, with strength and recommendations. Deterministic; no LLM.",
  requiredContext: [],
  inputSchema: {
    type: "object",
    description: "Detect user patterns input",
    properties: {
      metrics: {
        type: "object",
        description: "Aggregated behavioral metrics",
        properties: {
          sessions: { type: "number", description: "Total sessions or users" },
          pagesPerSession: { type: "number", description: "Average pages per session" },
          bounceRate: { type: "number", description: "0-1, single-page sessions share" },
          avgSessionDurationSeconds: { type: "number", description: "Average session length" },
          returnVisitorRate: { type: "number", description: "0-1, share of returning visitors" },
          conversionRate: { type: "number", description: "0-1, conversions / sessions" },
        },
      },
      eventCounts: {
        type: "array",
        description: "Optional: event type counts e.g. [{ eventType, count }]",
        items: {
          type: "object",
          properties: {
            eventType: { type: "string" },
            count: { type: "number" },
          },
        },
      },
      locale: { type: "string", description: "Locale (nb | en) for messages" },
    },
    required: [],
  },
  outputSchema: {
    type: "object",
    description: "Detected user patterns",
    required: ["patterns", "summary", "detectedAt"],
    properties: {
      patterns: {
        type: "array",
        items: {
          type: "object",
          required: ["patternId", "label", "strength", "description", "recommendation"],
          properties: {
            patternId: { type: "string" },
            label: { type: "string" },
            strength: { type: "string", enum: ["high", "medium", "low"] },
            description: { type: "string" },
            recommendation: { type: "string" },
            segmentHint: { type: "string", description: "Optional segment label for targeting" },
          },
        },
      },
      summary: { type: "string" },
      detectedAt: { type: "string", description: "ISO timestamp" },
    },
  },
  safetyConstraints: [
    { code: "read_only", description: "Output is pattern detection only; no content or system mutation.", enforce: "hard" },
  ],
  targetSurfaces: ["backoffice", "api", "editor"],
};

registerCapability(detectUserPatternsCapability);

export type BehavioralMetrics = {
  sessions?: number | null;
  pagesPerSession?: number | null;
  bounceRate?: number | null;
  avgSessionDurationSeconds?: number | null;
  returnVisitorRate?: number | null;
  conversionRate?: number | null;
};

export type EventCount = {
  eventType: string;
  count: number;
};

export type DetectUserPatternsInput = {
  metrics?: BehavioralMetrics | null;
  eventCounts?: EventCount[] | null;
  locale?: "nb" | "en" | null;
};

export type DetectedPattern = {
  patternId: string;
  label: string;
  strength: "high" | "medium" | "low";
  description: string;
  recommendation: string;
  segmentHint?: string | null;
};

export type DetectUserPatternsOutput = {
  patterns: DetectedPattern[];
  summary: string;
  detectedAt: string;
};

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, typeof v === "number" && !Number.isNaN(v) ? v : 0));
}

/**
 * Detects behavioral patterns from aggregated metrics. Deterministic; no external calls.
 */
export function detectUserPatterns(input: DetectUserPatternsInput = {}): DetectUserPatternsOutput {
  const m = input.metrics ?? {};
  const sessions = Math.max(0, Number(m.sessions) ?? 0);
  const pagesPerSession = Number(m.pagesPerSession) ?? 0;
  const bounceRate = clamp01(Number(m.bounceRate));
  const avgDurationSec = Math.max(0, Number(m.avgSessionDurationSeconds) ?? 0);
  const returnRate = clamp01(Number(m.returnVisitorRate));
  const conversionRate = clamp01(Number(m.conversionRate));
  const isEn = input.locale === "en";
  const eventCounts = Array.isArray(input.eventCounts) ? input.eventCounts : [];

  const patterns: DetectedPattern[] = [];

  const add = (
    patternId: string,
    label: string,
    strength: "high" | "medium" | "low",
    description: string,
    recommendation: string,
    segmentHint?: string
  ) => {
    patterns.push({
      patternId,
      label,
      strength,
      description,
      recommendation,
      segmentHint: segmentHint ?? undefined,
    });
  };

  if (bounceRate >= 0.6 && pagesPerSession <= 1.5) {
    add(
      "bouncer",
      isEn ? "Bouncer" : "Hoppere",
      bounceRate >= 0.75 ? "high" : "medium",
      isEn
        ? `High bounce (${Math.round(bounceRate * 100)}%); many single-page sessions.`
        : `Høy bounce (${Math.round(bounceRate * 100)}%); mange én-sidessjoner.`,
      isEn
        ? "Improve first impression: clearer value prop, faster load, or better match to intent (e.g. landing page alignment)."
        : "Forbedre første inntrykk: tydeligere verdiforslag, raskere lasting, eller bedre match mot intensjon (f.eks. landingsside).",
      "bouncers"
    );
  }

  if (pagesPerSession >= 4 && avgDurationSec >= 120) {
    add(
      "researcher",
      isEn ? "Researcher" : "Forsker",
      pagesPerSession >= 6 ? "high" : "medium",
      isEn
        ? `Many pages (${pagesPerSession.toFixed(1)}/session) and long sessions (${Math.round(avgDurationSec)}s).`
        : `Mange sider (${pagesPerSession.toFixed(1)}/økt) og lange økter (${Math.round(avgDurationSec)}s).`,
      isEn
        ? "Support research: clear navigation, related content, comparison tools, or lead capture before exit."
        : "Støtt forskning: tydelig navigasjon, relatert innhold, sammenligningsverktøy eller lead-fangst før utgang.",
      "researchers"
    );
  }

  if (returnRate >= 0.3) {
    add(
      "repeat_visitor",
      isEn ? "Repeat visitor" : "Gjentakende besøkende",
      returnRate >= 0.5 ? "high" : "medium",
      isEn
        ? `${Math.round(returnRate * 100)}% return visitors; recurring engagement.`
        : `${Math.round(returnRate * 100)}% tilbakevendende besøkende; gjentatt engasjement.`,
      isEn
        ? "Personalize for returners: saved preferences, recommendations, or targeted messaging."
        : "Personaliser for tilbakevendere: lagrede preferanser, anbefalinger eller målrettet budskap.",
      "returning"
    );
  }

  if (avgDurationSec > 0 && avgDurationSec < 30 && pagesPerSession <= 1.5) {
    add(
      "short_session",
      isEn ? "Short session" : "Kort økt",
      "high",
      isEn
        ? `Very short sessions (${Math.round(avgDurationSec)}s avg); likely quick exit or mismatch.`
        : `Veldig korte økter (${Math.round(avgDurationSec)}s snitt); sannsynligvis rask utgang eller dårlig match.`,
      isEn
        ? "Capture attention faster: stronger headline, above-fold CTA, or reduce clutter."
        : "Fang oppmerksomhet raskere: sterkere overskrift, CTA over fold, eller reduser støy.",
      "short_session"
    );
  }

  if (conversionRate > 0 && conversionRate < 0.05 && sessions >= 10) {
    add(
      "low_converter",
      isEn ? "Low conversion" : "Lav konvertering",
      conversionRate < 0.02 ? "high" : "medium",
      isEn
        ? `Conversion rate ${Math.round(conversionRate * 100)}%; room to improve path to conversion.`
        : `Konverteringsrate ${Math.round(conversionRate * 100)}%; rom for å forbedre veien til konvertering.`,
      isEn
        ? "Reduce friction: fewer steps, clearer CTA, trust signals, or A/B test checkout/lead flow."
        : "Reduser friksjon: færre steg, tydeligere CTA, tillitssignaler eller A/B-test av kasse/lead-flyt.",
      "conversion_opportunity"
    );
  }

  if (conversionRate >= 0.05) {
    add(
      "converter",
      isEn ? "Converter" : "Konverterer",
      conversionRate >= 0.1 ? "high" : "medium",
      isEn
        ? `${Math.round(conversionRate * 100)}% conversion; converting segment present.`
        : `${Math.round(conversionRate * 100)}% konvertering; konverterende segment til stede.`,
      isEn
        ? "Protect and scale: maintain clarity and trust; consider upsell or retention messaging post-conversion."
        : "Beskytt og skaler: behold tydelighet og tillit; vurder upsell eller retensjonsbudskap etter konvertering.",
      "converters"
    );
  }

  if (pagesPerSession <= 2 && avgDurationSec < 60 && bounceRate >= 0.5) {
    add(
      "low_engagement",
      isEn ? "Low engagement" : "Lavt engasjement",
      "medium",
      isEn
        ? "Low pages and short duration; engagement could be improved."
        : "Få sider og kort varighet; engasjement kan forbedres.",
      isEn
        ? "Increase relevance: better targeting, clearer value above fold, or more compelling next step."
        : "Øk relevans: bedre målretting, tydeligere verdi over fold, eller mer overbevisende neste steg.",
      "low_engagement"
    );
  }

  const ctaClicks = eventCounts.find((e) => /cta|click|button/i.test(e.eventType ?? ""))?.count ?? 0;
  if (sessions > 0 && ctaClicks >= sessions * 0.1 && conversionRate < 0.05) {
    add(
      "high_intent_no_convert",
      isEn ? "High intent, no convert" : "Høy intensjon, ingen konvertering",
      "high",
      isEn
        ? "CTA engagement present but conversion low; friction likely between click and goal."
        : "CTA-engasjement til stede men lav konvertering; friksjon sannsynlig mellom klikk og mål.",
      isEn
        ? "Audit post-click flow: form length, payment step, or confirmation; reduce drop-off."
        : "Gjennomgå post-klikk-flyt: skjemalengde, betalingssteg eller bekreftelse; reduser frafall.",
      "high_intent"
    );
  }

  if (patterns.length === 0 && (sessions > 0 || pagesPerSession > 0)) {
    add(
      "neutral",
      isEn ? "Neutral" : "Nøytral",
      "low",
      isEn ? "Metrics within typical range; no strong pattern flagged." : "Mål innenfor typisk område; ingen sterk mønster flagget.",
      isEn ? "Keep monitoring; segment by traffic source or device for deeper patterns." : "Fortsett å overvåke; segmenter på trafikkkilde eller enhet for dypere mønstre.",
      "all"
    );
  }

  const summary = isEn
    ? `Detected ${patterns.length} behavioral pattern(s). Use segment hints for targeting or messaging.`
    : `Oppdaget ${patterns.length} atferdsmønster. Bruk segment-hint for målretting eller budskap.`;

  return {
    patterns,
    summary,
    detectedAt: new Date().toISOString(),
  };
}

export { detectUserPatternsCapability, CAPABILITY_NAME };
