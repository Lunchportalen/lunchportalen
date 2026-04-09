/**
 * User intent prediction AI capability: predictUserIntent.
 * Predicts user intent from current page, session, search query, and recent actions.
 * Deterministic; no LLM. Returns intents with confidence and signals.
 * Import this module to register the capability.
 */

import type { Capability } from "../../capabilityRegistry";
import { registerCapability } from "../../capabilityRegistry";

const CAPABILITY_NAME = "predictUserIntent";

const predictUserIntentCapability: Capability = {
  name: CAPABILITY_NAME,
  description:
    "Predicts user intent from context: current page, session metrics, search query, and recent actions. Returns ranked intents (browse, signup, order, support, compare, exit) with confidence and signals. Deterministic; no LLM.",
  requiredContext: [],
  inputSchema: {
    type: "object",
    description: "User intent prediction input",
    properties: {
      currentPage: { type: "string", description: "Page path or id" },
      sessionContext: {
        type: "object",
        properties: {
          pageViewCount: { type: "number" },
          sessionDurationSeconds: { type: "number" },
          scrollDepth: { type: "number", description: "0-1 or 0-100" },
          pagesVisited: { type: "array", items: { type: "string" } },
        },
      },
      searchQuery: { type: "string", description: "Current or recent search query" },
      recentActions: {
        type: "array",
        items: {
          type: "object",
          properties: {
            type: { type: "string", description: "e.g. view, click, search" },
            target: { type: "string" },
          },
        },
      },
      referrer: { type: "string" },
      locale: { type: "string", enum: ["nb", "en"] },
    },
    required: ["currentPage"],
  },
  outputSchema: {
    type: "object",
    description: "Intent prediction result",
    required: ["intents", "primaryIntent", "summary", "generatedAt"],
    properties: {
      intents: {
        type: "array",
        items: {
          type: "object",
          required: ["intent", "confidence", "signals"],
          properties: {
            intent: { type: "string", enum: ["browse", "signup", "order", "support", "compare", "exit"] },
            confidence: { type: "number", description: "0-1" },
            signals: { type: "array", items: { type: "string" } },
          },
        },
      },
      primaryIntent: { type: "object", description: "Top intent or null" },
      summary: { type: "string" },
      generatedAt: { type: "string", description: "ISO timestamp" },
    },
  },
  safetyConstraints: [
    { code: "read_only", description: "Output is prediction only; no user or system mutation.", enforce: "hard" },
  ],
  targetSurfaces: ["backoffice", "api", "editor"],
};

registerCapability(predictUserIntentCapability);

export type IntentLabel = "browse" | "signup" | "order" | "support" | "compare" | "exit";

const INTENT_KEYWORDS: Record<IntentLabel, string[]> = {
  browse: ["menu", "uke", "week", "lunch", "oversikt", "info", "about", "se", "view"],
  signup: ["registrer", "signup", "onboarding", "logg inn", "login", "konto", "account"],
  order: ["bestill", "order", "handle", "cart", "checkout", "legg til", "add"],
  support: ["hjelp", "support", "kontakt", "contact", "faq", "spørsmål"],
  compare: ["sammenlign", "compare", "pris", "price", "pakker", "plans"],
  exit: ["logout", "avslutt", "leave"],
};

function safeStr(v: unknown): string {
  return typeof v === "string" ? v.trim().toLowerCase() : "";
}

function pageMatchesIntent(page: string, intent: IntentLabel): boolean {
  const p = safeStr(page);
  const keywords = INTENT_KEYWORDS[intent];
  return keywords.some((k) => p.includes(k));
}

export type SessionContextInput = {
  pageViewCount?: number | null;
  sessionDurationSeconds?: number | null;
  scrollDepth?: number | null;
  pagesVisited?: string[] | null;
};

export type RecentActionInput = {
  type?: string | null;
  target?: string | null;
};

export type PredictUserIntentInput = {
  currentPage: string;
  sessionContext?: SessionContextInput | null;
  searchQuery?: string | null;
  recentActions?: RecentActionInput[] | null;
  referrer?: string | null;
  locale?: "nb" | "en" | null;
};

export type IntentPrediction = {
  intent: IntentLabel;
  confidence: number;
  signals: string[];
};

export type PredictUserIntentOutput = {
  intents: IntentPrediction[];
  primaryIntent: IntentPrediction | null;
  summary: string;
  generatedAt: string;
};

/**
 * Predicts user intent from context. Deterministic; no external calls.
 */
export function predictUserIntent(input: PredictUserIntentInput): PredictUserIntentOutput {
  const isEn = input.locale === "en";
  const page = safeStr(input.currentPage);
  const ctx = input.sessionContext && typeof input.sessionContext === "object" ? input.sessionContext : {};
  const query = safeStr(input.searchQuery);
  const actions = Array.isArray(input.recentActions) ? input.recentActions : [];
  const referrer = safeStr(input.referrer);

  const pageViews = typeof ctx.pageViewCount === "number" ? ctx.pageViewCount : 1;
  const durationSec = typeof ctx.sessionDurationSeconds === "number" ? ctx.sessionDurationSeconds : 0;
  const scrollDepth = typeof ctx.scrollDepth === "number" ? (ctx.scrollDepth > 1 ? ctx.scrollDepth / 100 : ctx.scrollDepth) : 0.5;
  const pagesVisited = Array.isArray(ctx.pagesVisited) ? ctx.pagesVisited.map(safeStr) : [];

  const scores: Record<IntentLabel, { confidence: number; signals: string[] }> = {
    browse: { confidence: 0.3, signals: [] },
    signup: { confidence: 0, signals: [] },
    order: { confidence: 0, signals: [] },
    support: { confidence: 0, signals: [] },
    compare: { confidence: 0, signals: [] },
    exit: { confidence: 0, signals: [] },
  };

  if (pageMatchesIntent(page, "signup")) {
    scores.signup.confidence += 0.4;
    scores.signup.signals.push(isEn ? "current_page_signup" : "nåværende_side_signup");
  }
  if (pageMatchesIntent(page, "order")) {
    scores.order.confidence += 0.4;
    scores.order.signals.push(isEn ? "current_page_order" : "nåværende_side_order");
  }
  if (pageMatchesIntent(page, "support")) {
    scores.support.confidence += 0.4;
    scores.support.signals.push(isEn ? "current_page_support" : "nåværende_side_support");
  }
  if (pageMatchesIntent(page, "compare")) {
    scores.compare.confidence += 0.35;
    scores.compare.signals.push(isEn ? "current_page_compare" : "nåværende_side_compare");
  }

  INTENT_KEYWORDS.browse.forEach((k) => {
    if (query.includes(k)) {
      scores.browse.confidence += 0.2;
      scores.browse.signals.push(isEn ? "search_query_browse" : "søkebrowse");
    }
  });
  INTENT_KEYWORDS.order.forEach((k) => {
    if (query.includes(k)) {
      scores.order.confidence += 0.25;
      scores.order.signals.push(isEn ? "search_query_order" : "søkeorder");
    }
  });
  INTENT_KEYWORDS.support.forEach((k) => {
    if (query.includes(k)) {
      scores.support.confidence += 0.25;
      scores.support.signals.push(isEn ? "search_query_support" : "søkesupport");
    }
  });

  if (scrollDepth >= 0.6 && pageViews >= 2) {
    scores.browse.confidence += 0.2;
    scores.browse.signals.push(isEn ? "high_engagement_browse" : "høy_engasjement_browse");
  }
  if (scrollDepth >= 0.5 && pageMatchesIntent(page, "order")) {
    scores.order.confidence += 0.2;
    scores.order.signals.push(isEn ? "engagement_on_order_page" : "engasjement_på_bestillingsside");
  }
  if (durationSec < 15 && pageViews <= 1) {
    scores.exit.confidence += 0.3;
    scores.exit.signals.push(isEn ? "short_session_exit_risk" : "kort_økt_avslutningsrisiko");
  }
  if (pageViews >= 4) {
    scores.order.confidence += 0.15;
    scores.order.signals.push(isEn ? "multi_page_exploration" : "flerside_utforsking");
  }

  const lastAction = actions[actions.length - 1];
  if (lastAction && safeStr(lastAction.type) === "click") {
    const t = safeStr(lastAction.target);
    if (INTENT_KEYWORDS.order.some((k) => t.includes(k))) {
      scores.order.confidence += 0.25;
      scores.order.signals.push(isEn ? "recent_click_order" : "nylig_klikk_order");
    }
    if (INTENT_KEYWORDS.signup.some((k) => t.includes(k))) {
      scores.signup.confidence += 0.25;
      scores.signup.signals.push(isEn ? "recent_click_signup" : "nylig_klikk_signup");
    }
  }

  const intents: IntentPrediction[] = (Object.keys(scores) as IntentLabel[]).map((intent) => {
    const c = Math.min(1, scores[intent].confidence);
    const signals = [...new Set(scores[intent].signals)];
    return { intent, confidence: Math.round(c * 100) / 100, signals };
  });

  intents.sort((a, b) => b.confidence - a.confidence);
  const primaryIntent = intents[0]?.confidence > 0 ? intents[0] : null;

  const summary = isEn
    ? `Intent prediction: primary ${primaryIntent?.intent ?? "unknown"} (${primaryIntent?.confidence ?? 0}). ${intents.filter((i) => i.confidence > 0).length} intent(s) with signals.`
    : `Intensjonsprediksjon: primær ${primaryIntent?.intent ?? "ukjent"} (${primaryIntent?.confidence ?? 0}). ${intents.filter((i) => i.confidence > 0).length} intensjon(er) med signaler.`;

  return {
    intents,
    primaryIntent,
    summary,
    generatedAt: new Date().toISOString(),
  };
}

export { predictUserIntentCapability, CAPABILITY_NAME };
