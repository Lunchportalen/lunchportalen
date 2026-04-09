import "server-only";

import { opsLog } from "@/lib/ops/log";

export type LeadConversionEvent = {
  leadId: string;
  value: number;
  timestamp: number;
};

/**
 * Structured lead conversion record for audit / investor pipelines (log-first; persist via existing revenue flows).
 */
export function trackLeadConversion(leadId: string, value: number): LeadConversionEvent {
  const ev: LeadConversionEvent = {
    leadId: String(leadId ?? "").trim() || "unknown",
    value: Number.isFinite(value) ? value : 0,
    timestamp: Date.now(),
  };
  opsLog("sales_lead_conversion", { leadId: ev.leadId, value: ev.value, ts: ev.timestamp });
  return ev;
}
