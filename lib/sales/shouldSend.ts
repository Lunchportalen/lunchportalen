/**
 * Timing + sikkerhet for sekvensutkast (ingen auto-send).
 */
import { resolvePipelineStage } from "@/lib/pipeline/dealNormalize";
import type { SequenceStepDef } from "@/lib/sales/sequence";
import type { LeadLikeWithMeta } from "@/lib/sales/conversationState";
import { readSequenceStepCompleted } from "@/lib/sales/conversationState";

/** Minimum tid mellom to sekvens-utkast per lead (48 t). */
export const SEQUENCE_MIN_MS_BETWEEN_TOUCHES = 48 * 60 * 60 * 1000;

/** Maks antall sekvens-utkast som kan genereres globalt per UTC-døgn. */
export const SEQUENCE_MAX_DRAFTS_PER_UTC_DAY = 10;

const NEGATIVE_PATTERNS = [
  /\bnei takk\b/i,
  /\bikke interessert\b/i,
  /\bavslutt\b/i,
  /\bstopp\b/i,
  /\bunsubscribe\b/i,
  /\bslett meg\b/i,
  /\bikke kontakt\b/i,
  /\bhold opp\b/i,
];

export function detectNegativeInbound(text: string): boolean {
  const t = String(text ?? "").trim();
  if (!t) return false;
  return NEGATIVE_PATTERNS.some((re) => re.test(t));
}

function parseIsoMs(raw: unknown): number | null {
  if (typeof raw !== "string" || !raw.trim()) return null;
  const t = new Date(raw).getTime();
  return Number.isFinite(t) ? t : null;
}

/**
 * Om neste steg kan planlegges nå (tid + pause + terminal + negativ respons).
 * `nextStep` er allerede neste steg-objekt fra getNextStep.
 */
export function shouldSendNext(lead: LeadLikeWithMeta & { id?: string }, nextStep: SequenceStepDef | undefined): boolean {
  if (!nextStep) return false;

  const row = lead as Record<string, unknown>;
  const meta =
    lead.meta && typeof lead.meta === "object" && !Array.isArray(lead.meta)
      ? (lead.meta as Record<string, unknown>)
      : {};

  if (meta.sequence_paused === true) return false;

  const stage = resolvePipelineStage(row);
  if (stage === "won" || stage === "lost") return false;

  const lastResp = meta.sequence_last_response ?? meta.last_response;
  if (typeof lastResp === "string" && detectNegativeInbound(lastResp)) {
    return false;
  }

  /** Kun sekvensens egen tidsstempel — ikke blandes med andre utkast. */
  const lastTouchMs = parseIsoMs(meta.sequence_last_message_at);
  const completed = readSequenceStepCompleted(lead);

  /** Første steg: ingen tidligere sekvens-touch. */
  if (nextStep.step === 1 && lastTouchMs == null && completed === 0) {
    return nextStep.delay_days <= 0;
  }

  if (lastTouchMs == null) {
    return false;
  }

  const diffMs = Date.now() - lastTouchMs;
  if (diffMs < SEQUENCE_MIN_MS_BETWEEN_TOUCHES) {
    return false;
  }

  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  return diffDays >= nextStep.delay_days;
}
