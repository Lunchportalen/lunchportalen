/**
 * Regelbasert beslutning — forklarbar, deterministisk.
 */
import { resolvePipelineStage } from "@/lib/pipeline/dealNormalize";
import { readSignalsFromMeta } from "@/lib/pipeline/prioritize";

export type PipelineSuggestedAction = {
  type: "follow_up_now" | "revive" | "deprioritize" | "observe" | "book_meeting";
  message: string;
  priority: number;
};

export function decideAction(lead: {
  id?: string;
  meta?: Record<string, unknown> | null;
}): PipelineSuggestedAction {
  const meta =
    lead.meta && typeof lead.meta === "object" && !Array.isArray(lead.meta)
      ? (lead.meta as Record<string, unknown>)
      : {};

  const prob = typeof meta.predicted_probability === "number" && Number.isFinite(meta.predicted_probability)
    ? meta.predicted_probability
    : 0;

  const sig = readSignalsFromMeta(meta);
  const days = sig.days_since_last_activity;

  const stage = resolvePipelineStage(lead as Record<string, unknown>);

  if (prob > 70 && stage === "proposal") {
    return {
      type: "book_meeting",
      message: "Book møte – høy closing sannsynlighet",
      priority: 1,
    };
  }

  if (prob > 70 && stage !== "won" && stage !== "lost") {
    return {
      type: "follow_up_now",
      message: "Følg opp denne dealen nå",
      priority: 1,
    };
  }

  if (days > 5 && prob > 40 && stage !== "won" && stage !== "lost") {
    return {
      type: "revive",
      message: "Send oppfølging – kald lead",
      priority: 2,
    };
  }

  if (prob < 30 && days > 10 && stage !== "won" && stage !== "lost") {
    return {
      type: "deprioritize",
      message: "Lav sannsynlighet – vurder å droppe",
      priority: 3,
    };
  }

  return {
    type: "observe",
    message: "Ingen handling nødvendig",
    priority: 99,
  };
}
