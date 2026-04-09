/**
 * Sekvens-tilstand utledet fra meta (deterministisk).
 */
import type { SequenceStepDef } from "@/lib/sales/sequence";
import { SEQUENCE_STEPS } from "@/lib/sales/sequence";

export type LeadLikeWithMeta = {
  id?: string;
  meta?: Record<string, unknown> | null;
};

export function readSequenceStepCompleted(lead: LeadLikeWithMeta): number {
  const m = lead.meta && typeof lead.meta === "object" && !Array.isArray(lead.meta) ? lead.meta : {};
  const raw = m.sequence_step;
  if (typeof raw === "number" && Number.isFinite(raw) && raw >= 0) return Math.floor(raw);
  if (typeof raw === "string" && raw.trim()) {
    const n = Number(raw);
    if (Number.isFinite(n) && n >= 0) return Math.floor(n);
  }
  return 0;
}

/** Neste steg som skal kjøres (siste fullførte steg + 1), eller undefined hvis sekvensen er ferdig. */
export function getNextStep(lead: LeadLikeWithMeta): SequenceStepDef | undefined {
  const lastStep = readSequenceStepCompleted(lead);
  return SEQUENCE_STEPS.find((s) => s.step === lastStep + 1);
}
