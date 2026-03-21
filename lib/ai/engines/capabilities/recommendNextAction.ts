/**
 * Real-time recommendation engine capability: recommendNextAction.
 * Recommends next action (CTA, navigation, content) from current context: page, session, available actions.
 * Deterministic; no LLM. Output for personalization and conversion prompts.
 * Import this module to register the capability.
 */

import type { Capability } from "../capabilityRegistry";
import { registerCapability } from "../capabilityRegistry";

const CAPABILITY_NAME = "recommendNextAction";

const recommendNextActionCapability: Capability = {
  name: CAPABILITY_NAME,
  description:
    "Recommends next action from current context: current page, session metrics, and available actions. Returns prioritized recommendations (CTA, navigate, content) with reason and confidence. Deterministic; no LLM.",
  requiredContext: [],
  inputSchema: {
    type: "object",
    description: "Next-action recommendation input",
    properties: {
      currentPage: { type: "string", description: "Page or screen id/path" },
      sessionContext: {
        type: "object",
        description: "Current session context",
        properties: {
          pageViewCount: { type: "number" },
          sessionDurationSeconds: { type: "number" },
          scrollDepth: { type: "number", description: "0-1 or 0-100" },
          lastActionType: { type: "string", description: "e.g. view, click, scroll" },
          intentHint: { type: "string", description: "e.g. browse, signup, order" },
        },
      },
      availableActions: {
        type: "array",
        description: "Actions that can be recommended",
        items: {
          type: "object",
          properties: {
            id: { type: "string" },
            type: { type: "string", enum: ["cta", "navigate", "content"] },
            label: { type: "string" },
            target: { type: "string", description: "e.g. URL or content id" },
            priority: { type: "number", description: "Base priority 1-10" },
          },
        },
      },
      locale: { type: "string", enum: ["nb", "en"] },
    },
    required: ["currentPage"],
  },
  outputSchema: {
    type: "object",
    description: "Next-action recommendation result",
    required: ["recommendations", "primaryRecommendation", "generatedAt"],
    properties: {
      recommendations: {
        type: "array",
        items: {
          type: "object",
          required: ["actionId", "type", "priority", "reason", "confidence"],
          properties: {
            actionId: { type: "string" },
            label: { type: "string" },
            type: { type: "string", enum: ["cta", "navigate", "content"] },
            target: { type: "string" },
            priority: { type: "number" },
            reason: { type: "string" },
            confidence: { type: "number", description: "0-1" },
          },
        },
      },
      primaryRecommendation: { type: "object", description: "Top recommendation or null" },
      summary: { type: "string" },
      generatedAt: { type: "string", description: "ISO timestamp" },
    },
  },
  safetyConstraints: [
    { code: "read_only", description: "Output is recommendation only; no user or system mutation.", enforce: "hard" },
  ],
  targetSurfaces: ["backoffice", "api", "editor"],
};

registerCapability(recommendNextActionCapability);

const SCROLL_LOW = 0.35;
const SCROLL_HIGH = 0.7;
const SHORT_SESSION_SEC = 20;
const LONG_SESSION_SEC = 120;
const DEFAULT_CONFIDENCE = 0.7;

function safeStr(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function norm01(v: number | null | undefined, asPercent = false): number {
  if (v == null || typeof v !== "number" || !Number.isFinite(v)) return 0.5;
  if (asPercent && v > 1) return Math.min(1, v / 100);
  return Math.max(0, Math.min(1, v));
}

export type SessionContextInput = {
  pageViewCount?: number | null;
  sessionDurationSeconds?: number | null;
  scrollDepth?: number | null;
  lastActionType?: string | null;
  intentHint?: string | null;
};

export type AvailableActionInput = {
  id: string;
  type?: "cta" | "navigate" | "content" | null;
  label?: string | null;
  target?: string | null;
  priority?: number | null;
};

export type RecommendNextActionInput = {
  currentPage: string;
  sessionContext?: SessionContextInput | null;
  availableActions?: AvailableActionInput[] | null;
  locale?: "nb" | "en" | null;
};

export type NextActionRecommendation = {
  actionId: string;
  label?: string;
  type: "cta" | "navigate" | "content";
  target?: string;
  priority: number;
  reason: string;
  confidence: number;
};

export type RecommendNextActionOutput = {
  recommendations: NextActionRecommendation[];
  primaryRecommendation: NextActionRecommendation | null;
  summary?: string;
  generatedAt: string;
};

/**
 * Recommends next actions from context and available actions. Deterministic; no external calls.
 */
export function recommendNextAction(input: RecommendNextActionInput): RecommendNextActionOutput {
  const isEn = input.locale === "en";
  const page = safeStr(input.currentPage);
  const ctx = input.sessionContext && typeof input.sessionContext === "object" ? input.sessionContext : {};
  const scrollDepth = norm01(ctx.scrollDepth, true);
  const sessionDuration = typeof ctx.sessionDurationSeconds === "number" ? ctx.sessionDurationSeconds : 0;
  const pageViewCount = typeof ctx.pageViewCount === "number" ? ctx.pageViewCount : 1;
  const intentHint = safeStr(ctx.intentHint).toLowerCase();

  const actions = Array.isArray(input.availableActions)
    ? input.availableActions.filter((a) => a && typeof a === "object" && safeStr(a.id))
    : [];

  const recommendations: NextActionRecommendation[] = [];

  for (const a of actions) {
    const id = safeStr(a.id);
    const type = (a.type === "cta" || a.type === "navigate" || a.type === "content" ? a.type : "cta") as "cta" | "navigate" | "content";
    const basePriority = typeof a.priority === "number" ? Math.max(1, Math.min(10, a.priority)) : 5;
    let priority = basePriority;
    let reason = isEn ? "Available action." : "Tilgjengelig handling.";
    let confidence = DEFAULT_CONFIDENCE;

    if (scrollDepth < SCROLL_LOW && type === "content") {
      priority += 1;
      reason = isEn ? "Low scroll depth; suggest more content." : "Lav scrolldypde; foreslå mer innhold.";
      confidence = 0.75;
    }
    if (scrollDepth >= SCROLL_HIGH && type === "cta") {
      priority += 2;
      reason = isEn ? "Good engagement; suggest primary CTA." : "Godt engasjement; foreslå primær CTA.";
      confidence = 0.8;
    }
    if (sessionDuration < SHORT_SESSION_SEC && type === "cta") {
      priority += 1;
      reason = isEn ? "Short session; surface primary action." : "Kort økt; vis primær handling.";
    }
    if (sessionDuration >= LONG_SESSION_SEC && type === "navigate") {
      priority += 1;
      reason = isEn ? "Engaged session; suggest next step." : "Engasjert økt; foreslå neste steg.";
    }
    if (intentHint && (intentHint === "signup" || intentHint === "order") && type === "cta") {
      priority += 2;
      reason = isEn ? "Intent aligned; recommend conversion CTA." : "Intensjon tilpasset; anbefal konverterings-CTA.";
      confidence = 0.85;
    }
    if (pageViewCount >= 3 && type === "cta") {
      priority += 1;
      reason = isEn ? "Multi-page visit; conversion opportunity." : "Flersidebesøk; konverteringsmulighet.";
    }

    recommendations.push({
      actionId: id,
      label: safeStr(a.label) || id,
      type,
      target: safeStr(a.target) || undefined,
      priority,
      reason,
      confidence,
    });
  }

  recommendations.sort((x, y) => y.priority - x.priority);

  const primaryRecommendation = recommendations.length > 0 ? recommendations[0] : null;
  const summary = isEn
    ? `${recommendations.length} recommendation(s); primary: ${primaryRecommendation?.actionId ?? "none"}.`
    : `${recommendations.length} anbefaling(er); primær: ${primaryRecommendation?.actionId ?? "ingen"}.`;

  return {
    recommendations,
    primaryRecommendation,
    summary,
    generatedAt: new Date().toISOString(),
  };
}

export { recommendNextActionCapability, CAPABILITY_NAME };
