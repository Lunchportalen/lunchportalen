/**
 * STEP 8 — Læring: hvilke budskap / bransjer / tilbud som korrelerer med utfall (aggregert).
 */

import type { GtmLearningSnapshot, GtmLead, GtmReplyClassification } from "./types";

export function emptyGtmLearning(): GtmLearningSnapshot {
  return { version: 1, messageStats: {}, industryStats: {}, offerStats: {} };
}

function industryKey(lead: GtmLead): string {
  return (lead.company.industry ?? "unknown").toLowerCase().trim() || "unknown";
}

/**
 * Kall etter manuelt klassifisert svar eller sendt kanal (ingen auto-send).
 */
export function applyGtmLearningEvent(
  state: GtmLearningSnapshot,
  input: {
    lead: GtmLead;
    templateKey: string;
    channel: "email" | "linkedin";
    classification: GtmReplyClassification;
    offerKey?: string;
  },
): GtmLearningSnapshot {
  const msgKey = `${input.channel}:${input.templateKey}`;
  const msg = state.messageStats[msgKey] ?? { touches: 0, positiveOutcomes: 0 };
  msg.touches += 1;
  if (input.classification.kind === "interest") {
    msg.positiveOutcomes += 1;
  }

  const ind = industryKey(input.lead);
  const indS = state.industryStats[ind] ?? { outreach: 0, interestSignals: 0 };
  indS.outreach += 1;
  if (input.classification.kind === "interest") {
    indS.interestSignals += 1;
  }

  const offerKey = input.offerKey ?? "default";
  const off = state.offerStats[offerKey] ?? { attempts: 0, conversions: 0 };
  off.attempts += 1;
  if (input.classification.kind === "interest") {
    off.conversions += 1;
  }

  return {
    ...state,
    messageStats: { ...state.messageStats, [msgKey]: msg },
    industryStats: { ...state.industryStats, [ind]: indS },
    offerStats: { ...state.offerStats, [offerKey]: off },
  };
}

export function learningTopMessages(state: GtmLearningSnapshot, limit = 5): Array<{ key: string; rate: number; touches: number }> {
  const rows = Object.entries(state.messageStats).map(([key, v]) => ({
    key,
    touches: v.touches,
    rate: v.touches > 0 ? v.positiveOutcomes / v.touches : 0,
  }));
  return rows.sort((a, b) => b.rate - a.rate || b.touches - a.touches).slice(0, limit);
}

export function learningTopIndustries(state: GtmLearningSnapshot, limit = 5): Array<{ key: string; rate: number; touches: number }> {
  const rows = Object.entries(state.industryStats).map(([key, v]) => ({
    key,
    touches: v.outreach,
    rate: v.outreach > 0 ? v.interestSignals / v.outreach : 0,
  }));
  return rows.sort((a, b) => b.rate - a.rate || b.touches - a.touches).slice(0, limit);
}

function isGtmLead(v: unknown): v is GtmLead {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return typeof o.id === "string" && o.company != null && typeof o.company === "object";
}

function isReplyClassification(v: unknown): v is GtmReplyClassification {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return (
    (o.kind === "interest" ||
      o.kind === "rejection" ||
      o.kind === "objection" ||
      o.kind === "neutral") &&
    typeof o.confidence === "number"
  );
}

/**
 * Rebuild {@link GtmLearningSnapshot} from stored `gtm_outcome` payloads (central intelligence store).
 */
export function rebuildGtmLearningFromOutcomePayloads(payloads: readonly unknown[]): GtmLearningSnapshot {
  let state = emptyGtmLearning();
  for (const raw of payloads) {
    if (!raw || typeof raw !== "object") continue;
    const o = raw as Record<string, unknown>;
    const lead = o.lead;
    const templateKey = typeof o.templateKey === "string" ? o.templateKey.trim() : "";
    const channel = o.channel === "linkedin" ? "linkedin" : o.channel === "email" ? "email" : null;
    const classification = o.classification;
    if (!isGtmLead(lead) || !templateKey || !channel || !isReplyClassification(classification)) continue;
    const offerKey = typeof o.offerKey === "string" && o.offerKey.trim() ? o.offerKey.trim() : undefined;
    state = applyGtmLearningEvent(state, {
      lead,
      templateKey,
      channel,
      classification,
      offerKey,
    });
  }
  return state;
}
