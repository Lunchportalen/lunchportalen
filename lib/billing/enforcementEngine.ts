import "server-only";

import type { CreditRiskLevel } from "@/lib/billing/creditRiskEngine";
import { opsLog } from "@/lib/ops/log";
import { supabaseAdmin } from "@/lib/supabase/admin";

function safeStr(v: unknown): string {
  return String(v ?? "").trim();
}

const HOLD_REASON =
  "Kreditt: utestående faktura registrert via Tripletex. Bestilling er stengt til opprydding manuelt.";

/**
 * Reagerer på risiko: kun logging for HIGH; CRITICAL setter billing_hold (ikke automatisk opphevet her).
 * Aktiveres med CREDIT_RISK_ENFORCEMENT_ENABLED=true for faktiske DB-skrivinger.
 */
export async function enforceCompanyStatus(
  companyId: string,
  risk: CreditRiskLevel,
  ctx: { rid: string },
): Promise<{ applied: boolean; detail?: string }> {
  const cid = safeStr(companyId);
  if (!cid) return { applied: false, detail: "missing_company_id" };

  const enforceWrites = safeStr(process.env.CREDIT_RISK_ENFORCEMENT_ENABLED).toLowerCase() === "true";

  if (risk === "HIGH") {
    opsLog("company_warning_credit", { rid: ctx.rid, companyId: cid, risk });
    return { applied: false, detail: "warning_only" };
  }

  if (risk === "CRITICAL") {
    opsLog("company_warning_credit", { rid: ctx.rid, companyId: cid, risk, phase: "pre_hold" });
    if (!enforceWrites) {
      opsLog("company_paused_due_to_credit", {
        rid: ctx.rid,
        companyId: cid,
        risk,
        applied: false,
        reason: "CREDIT_RISK_ENFORCEMENT_DISABLED",
      });
      return { applied: false, detail: "enforcement_disabled" };
    }

    const admin = supabaseAdmin();
    const now = new Date().toISOString();
    const { error } = await admin
      .from("companies")
      .update({
        billing_hold: true,
        billing_hold_reason: HOLD_REASON,
        updated_at: now,
      })
      .eq("id", cid);

    if (error) {
      opsLog("company_paused_due_to_credit", {
        rid: ctx.rid,
        companyId: cid,
        risk,
        applied: false,
        error: safeStr(error.message),
      });
      return { applied: false, detail: safeStr(error.message) };
    }

    opsLog("company_paused_due_to_credit", { rid: ctx.rid, companyId: cid, risk, applied: true, mode: "billing_hold" });
    return { applied: true, detail: "billing_hold_set" };
  }

  return { applied: false, detail: "no_action" };
}
