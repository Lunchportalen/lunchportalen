/**
 * Learning engine — pairs “change → result” as analytics events (queryable, explainable).
 */

import "server-only";

import { getEvents, logEvent } from "./store";
import type { IntelligenceEvent, LearningHistoryItem } from "./types";

export type RecordLearningOutcomeInput = {
  change: string;
  result: string;
  explain?: string;
  source?: string;
  page_id?: string | null;
  company_id?: string | null;
  source_rid?: string | null;
};

/**
 * Persist a single change/result pair (no duplicate store — same `ai_intelligence_events` table).
 */
export async function recordLearningOutcome(input: RecordLearningOutcomeInput): Promise<{ ok: true } | { ok: false; error: string }> {
  const change = String(input.change ?? "").trim();
  const result = String(input.result ?? "").trim();
  if (!change || !result) return { ok: false, error: "Missing change or result" };

  const res = await logEvent({
    type: "analytics",
    source: input.source ?? "learning_engine",
    payload: {
      kind: "learning_pair",
      change: change.slice(0, 500),
      result: result.slice(0, 500),
      ...(input.explain ? { explain: String(input.explain).slice(0, 2000) } : {}),
    },
    page_id: input.page_id,
    company_id: input.company_id,
    source_rid: input.source_rid,
  });
  return res.ok === true ? { ok: true } : { ok: false, error: res.error };
}

/**
 * Pull learning_pair rows from an already-fetched event list (newest-first input).
 */
export function extractLearningHistory(events: readonly IntelligenceEvent[], limit = 40): LearningHistoryItem[] {
  const rows: LearningHistoryItem[] = [];
  for (const e of events) {
    if (e.type !== "analytics" || e.payload.kind !== "learning_pair") continue;
    const ch = e.payload.change;
    const res = e.payload.result;
    if (typeof ch !== "string" || typeof res !== "string") continue;
    rows.push({
      change: ch,
      result: res,
      timestamp: e.timestamp,
      explain: typeof e.payload.explain === "string" ? e.payload.explain : undefined,
      source: e.source,
    });
    if (rows.length >= limit) break;
  }
  return rows;
}

/**
 * Recent structured learning rows (newest first).
 */
export async function getRecentLearningHistory(limit = 40): Promise<LearningHistoryItem[]> {
  const events = await getEvents({ types: ["analytics"], limit: Math.min(500, limit * 8) });
  return extractLearningHistory(events, limit);
}
