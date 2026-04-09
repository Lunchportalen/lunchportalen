/**
 * Svar / status på utgående — manuelt registrert (ingen skjult innboks-API).
 */

import { createLeadFromCapture } from "@/lib/leads/createLead";
import type { Lead } from "@/lib/leads/types";
import { toIndustryFromOutbound, toRoleFromOutbound } from "@/lib/outbound/normalizeSegment";

export type OutboundReplyStatus =
  | "interested"
  | "interested_catering"
  | "not_interested"
  | "no_response";

export type OutboundReplyLog = {
  leadId: string;
  status: OutboundReplyStatus;
  channel?: "email" | "linkedin";
  industry: string;
  role: string;
  at: number;
};

const STORAGE_KEY = "lp_outbound_replies";

function readAll(): OutboundReplyLog[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const v = JSON.parse(raw ?? "[]") as unknown;
    return Array.isArray(v) ? (v as OutboundReplyLog[]) : [];
  } catch {
    return [];
  }
}

function writeAll(rows: OutboundReplyLog[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(rows.slice(-3000)));
  } catch {
    /* ignore */
  }
}

export function logReply(input: {
  leadId: string;
  status: OutboundReplyStatus;
  channel?: "email" | "linkedin";
  industry?: string;
  role?: string;
}): void {
  if (typeof window === "undefined") return;
  const rows = readAll();
  rows.push({
    leadId: input.leadId,
    status: input.status,
    channel: input.channel,
    industry: String(input.industry ?? "office"),
    role: String(input.role ?? "office"),
    at: Date.now(),
  });
  writeAll(rows);
}

export function readOutboundReplyLogs(): OutboundReplyLog[] {
  return readAll();
}

/** Aggreger positive signaler til vekstlæring (forklarbar). */
export function aggregateOutboundReplySignals(): {
  outboundIndustriesByReply: string[];
  outboundRolesByReply: string[];
  outboundMessageTypesByReply: string[];
} {
  if (typeof window === "undefined") {
    return { outboundIndustriesByReply: [], outboundRolesByReply: [], outboundMessageTypesByReply: [] };
  }
  const logs = readAll().filter((l) => l.status === "interested" || l.status === "interested_catering");
  const ind = new Map<string, number>();
  const role = new Map<string, number>();
  const ch = new Map<string, number>();
  for (const l of logs) {
    const ik = toIndustryFromOutbound(l.industry, l.role);
    const rk = toRoleFromOutbound(l.role, l.industry);
    ind.set(ik, (ind.get(ik) ?? 0) + 1);
    role.set(rk, (role.get(rk) ?? 0) + 1);
    const c = l.channel ?? "unknown";
    ch.set(c, (ch.get(c) ?? 0) + 1);
  }
  const sortKeys = (m: Map<string, number>) =>
    [...m.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([k]) => k);
  return {
    outboundIndustriesByReply: sortKeys(ind),
    outboundRolesByReply: sortKeys(role),
    outboundMessageTypesByReply: sortKeys(ch),
  };
}

/**
 * Når svar = interessert: bygg CRM-lead (ingen auto-send — brukeren må fortsatt godkjenne CRM-kall separat).
 */
export function buildCrmLeadFromInterestedOutbound(input: {
  leadId: string;
  companyName: string;
  industry: string;
  role: string;
  companySize?: string;
  /** catering = Melhus-pivot, ellers standard lunsj-kontekst */
  productIntent?: "lunch" | "catering";
}): Lead {
  const intentNote = input.productIntent === "catering" ? " — catering (Melhus)" : "";
  return createLeadFromCapture({
    source: `outbound_${input.leadId}`,
    contextText: `${input.companyName} ${input.industry} ${input.role}${intentNote}`,
    companySize: input.companySize,
    industryOverride: toIndustryFromOutbound(input.industry, input.companyName),
    roleOverride: toRoleFromOutbound(input.role, input.companyName),
  });
}
