import "server-only";

import type { CompanyTripletexInvoiceStatus } from "@/lib/integrations/tripletexStatusEngine";

export type CreditRiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" | "UNKNOWN";

/**
 * Deterministisk risiko fra Tripletex-drevet status (ingen lokal fakturamath).
 */
export function evaluateCreditRisk(status: CompanyTripletexInvoiceStatus | null | undefined): CreditRiskLevel {
  if (!status) return "UNKNOWN";

  if (status.source === "no_customer_mapping" || status.source === "tripletex_error" || status.source === "parse_gap") {
    return "UNKNOWN";
  }
  if (status.source === "disabled") return "LOW";

  if (status.status === "unknown") return "UNKNOWN";

  if (status.status === "severe_overdue" || status.daysOverdue >= 30) return "CRITICAL";
  if (status.daysOverdue >= 14) return "HIGH";
  if (status.daysOverdue > 0 || status.status === "overdue") return "MEDIUM";
  return "LOW";
}
