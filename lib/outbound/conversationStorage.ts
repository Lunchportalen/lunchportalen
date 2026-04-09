/**
 * Per-lead samtaletilstand (nettleser). Én registrert pivot — ingen gjentatt auto-pivot.
 */

import type { ConversationState } from "@/lib/outbound/conversation";
import { nextState } from "@/lib/outbound/conversation";
import type { OutboundObjectionId } from "@/lib/outbound/objections";

const KEY = "lp_outbound_conversation_v1";

export type LeadConversationRecord = {
  state: ConversationState;
  /** True etter første bekreftede pivot (f.eks. kantine → catering). */
  pivotUsed: boolean;
};

function readAll(): Record<string, LeadConversationRecord> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(KEY);
    const v = JSON.parse(raw ?? "{}") as unknown;
    if (!v || typeof v !== "object") return {};
    return v as Record<string, LeadConversationRecord>;
  } catch {
    return {};
  }
}

function writeAll(m: Record<string, LeadConversationRecord>): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(m));
  } catch {
    /* ignore */
  }
}

const defaultRecord = (): LeadConversationRecord => ({
  state: "lunch_pitch",
  pivotUsed: false,
});

export function getLeadConversation(leadId: string): LeadConversationRecord {
  const m = readAll();
  return m[leadId] ?? defaultRecord();
}

export function setLeadConversation(leadId: string, patch: Partial<LeadConversationRecord>): void {
  const m = readAll();
  const cur = m[leadId] ?? defaultRecord();
  m[leadId] = { ...cur, ...patch };
  writeAll(m);
}

/**
 * Utfør pivot én gang: lunsj-pitch stoppes for denne kontakten, catering blir aktiv kanal.
 * Returnerer false hvis pivot allerede er brukt.
 */
export function applyCateringPivotOnce(leadId: string, objection: OutboundObjectionId): boolean {
  const cur = getLeadConversation(leadId);
  if (cur.pivotUsed) return false;
  const state = nextState(cur.state, objection);
  setLeadConversation(leadId, { state, pivotUsed: true });
  return true;
}

/** Etter avslag / ferdig — ingen flere forslag. */
export function closeConversation(leadId: string): void {
  setLeadConversation(leadId, { state: "closed" });
}

/** Fjerner lagret tilstand (ny prosess / feilregistrering). */
export function resetLeadConversation(leadId: string): void {
  const m = readAll();
  delete m[leadId];
  writeAll(m);
}

/** True kun før pivot — aldri lunsj-pitch etter bekreftet kantine-pivot. */
export function shouldUseLunchProductCopy(leadId: string): boolean {
  const { state, pivotUsed } = getLeadConversation(leadId);
  if (state === "closed") return false;
  if (pivotUsed || state === "catering_pitch") return false;
  return state === "lunch_pitch";
}
