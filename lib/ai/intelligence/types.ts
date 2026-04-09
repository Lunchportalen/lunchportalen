/**
 * Unified intelligence types — one canonical event model + derived signals.
 */

import type { GtmLearningSnapshot } from "@/lib/gtm/types";
import type { IntelligenceDomainType } from "@/lib/ai/schema/events";

/** Stored / API event categories (also written as `event_type` in DB for new rows). */
export type { IntelligenceDomainType };

/**
 * Canonical event shape (queryable, explainable).
 * `timestamp` is Unix ms. `payload` may include `kind` for sub-types (e.g. revenue_insights, gtm_outcome).
 */
export type IntelligenceEvent = {
  id: string;
  type: IntelligenceDomainType;
  source: string;
  timestamp: number;
  /** Structured payload; use `kind` for sub-type when type is a bucket (e.g. analytics). */
  payload: Record<string, unknown>;
};

export type LogEventInput = {
  type: IntelligenceDomainType;
  source: string;
  payload: Record<string, unknown>;
  page_id?: string | null;
  company_id?: string | null;
  source_rid?: string | null;
};

/** @deprecated Use {@link LogEventInput} — string type coerced via legacy map in {@link logEvent}. */
export type IntelligenceEventInsert = {
  type: string;
  source: string;
  payload: Record<string, unknown>;
  page_id?: string | null;
  company_id?: string | null;
  source_rid?: string | null;
};

/** Signal bundle consumed by GTM, revenue, design, CEO, decision APIs. */
export type PublicSystemSignals = {
  topCTA: string;
  bestSpacing: string;
  bestChannel: string;
  bestIndustry: string;
};

export type IntelligenceTrends = {
  risingConversions: boolean;
  fallingPerformance: boolean;
  anomalies: string[];
  /** Human-readable audit trail for the trend model. */
  explain: string[];
};

export type LearningHistoryItem = {
  change: string;
  result: string;
  timestamp: number;
  explain?: string;
  source?: string;
};

export type SystemIntelligence = {
  generatedAt: string;
  signals: PublicSystemSignals;
  recentEvents: IntelligenceEvent[];
  trends: IntelligenceTrends;
  learningHistory: LearningHistoryItem[];
  /** Optional diagnostics (counts, patterns, GTM fold) for CEO / audits. */
  meta?: {
    eventCounts: Record<string, number>;
    topPatterns: Array<{ key: string; weight: number }>;
    gtmLearning: GtmLearningSnapshot;
  };
};
