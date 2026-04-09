/**
 * Global intelligence read-model — one brain for GTM, revenue, design, CEO, decision APIs.
 */

import "server-only";

import { loadPatternWeights } from "@/lib/ai/learning";
import { rebuildGtmLearningFromOutcomePayloads } from "@/lib/gtm/learning";

import { deriveSystemSignalsFromEvents, type ComputeSystemSignalsOpts } from "./signals";
import { extractLearningHistory } from "./learning";
import { getEvents } from "./store";
import { deriveTrendsFromEvents } from "./trends";
import type { IntelligenceEvent, LearningHistoryItem, SystemIntelligence } from "./types";

export type GetSystemIntelligenceOpts = ComputeSystemSignalsOpts & {
  /** Max recent events returned (trimmed for payloads). Default 60. */
  recentEventLimit?: number;
};

function isGtmOutcomePayload(e: IntelligenceEvent): boolean {
  if (e.type !== "gtm") return false;
  return e.payload.kind === "gtm_outcome" || e.payload.kind == null;
}

/**
 * Shared intelligence: signals + recent events + trends + learning history (+ meta for audits).
 */
export async function getSystemIntelligence(opts?: GetSystemIntelligenceOpts): Promise<SystemIntelligence> {
  const generatedAt = new Date().toISOString();
  const limit = Math.max(opts?.limit ?? 800, 100);
  const events = await getEvents({ ...opts, limit });
  const signals = await deriveSystemSignalsFromEvents(events);
  const trends = deriveTrendsFromEvents(events, signals);

  const recentCap = Math.min(120, Math.max(10, opts?.recentEventLimit ?? 60));
  const recentEvents = events.slice(0, recentCap);

  const learningHistory = extractLearningHistory(events, 40);

  const eventCounts: Record<string, number> = {};
  for (const e of events) {
    const t = e.type || "unknown";
    eventCounts[t] = (eventCounts[t] ?? 0) + 1;
  }

  const chrono = [...events].sort((a, b) => a.timestamp - b.timestamp);
  const gtmPayloads = chrono.filter(isGtmOutcomePayload).map((e) => e.payload);
  const gtmLearning = rebuildGtmLearningFromOutcomePayloads(gtmPayloads);

  const weights = await loadPatternWeights();
  const topPatterns = Object.entries(weights)
    .map(([key, weight]) => ({ key, weight: Number(weight) || 0 }))
    .filter((r) => r.weight > 0)
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 16);

  return {
    generatedAt,
    signals,
    recentEvents,
    trends,
    learningHistory,
    meta: {
      eventCounts,
      topPatterns,
      gtmLearning,
    },
  };
}
