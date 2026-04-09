/**
 * Loggførte utgående touchpoints (kun etter bruker bekrefter «sendt»).
 */

export type OutboundSentRecord = {
  leadId: string;
  channel: "email" | "linkedin";
  bodyHash: string;
  at: number;
};

const STORAGE_KEY = "lp_outbound_sent";

function readAll(): OutboundSentRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const v = JSON.parse(raw ?? "[]") as unknown;
    return Array.isArray(v) ? (v as OutboundSentRecord[]) : [];
  } catch {
    return [];
  }
}

function writeAll(records: OutboundSentRecord[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(records.slice(-2000)));
  } catch {
    /* quota */
  }
}

export function readOutboundSent(): OutboundSentRecord[] {
  return readAll();
}

export function appendOutboundSent(record: OutboundSentRecord): void {
  const all = readAll();
  all.push(record);
  writeAll(all);
}

export function startOfLocalDayMs(): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function countSentToday(channel: "email" | "linkedin"): number {
  const day = startOfLocalDayMs();
  return readAll().filter((r) => r.channel === channel && r.at >= day).length;
}

export function wasSentToday(leadId: string, channel: "email" | "linkedin", bodyHash: string): boolean {
  const day = startOfLocalDayMs();
  return readAll().some(
    (r) => r.leadId === leadId && r.channel === channel && r.bodyHash === bodyHash && r.at >= day,
  );
}
