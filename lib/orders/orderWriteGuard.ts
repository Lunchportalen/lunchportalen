import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { requireRule } from "@/lib/agreement/requireRule";
import { weekdayKeyFromOsloISODate } from "@/lib/date/weekdayKeyFromIso";
import { opsLog } from "@/lib/ops/log";

function safeStr(v: unknown): string {
  return String(v ?? "").trim();
}

/**
 * Ansatte kan ikke sende pris/plan/overstyring i body (server-sannhet = avtale).
 */
export function assertEmployeeOrderBodyHasNoPricingOverrides(
  body: unknown,
  role: string | null | undefined,
): { ok: true } | { ok: false; code: string } {
  const r = safeStr(role).toLowerCase();
  if (r !== "employee") return { ok: true as const };
  if (!body || typeof body !== "object") return { ok: true as const };
  const o = body as Record<string, unknown>;
  const forbidden = ["price", "unit_price", "line_total", "amount", "currency", "tier", "plan", "saas_plan"];
  for (const k of forbidden) {
    if (Object.prototype.hasOwnProperty.call(o, k) && o[k] !== undefined && o[k] !== null) {
      opsLog("unauthorized_payment_attempt", { surface: "order_json_body", field: k, role: r });
      return { ok: false as const, code: "PRICING_OVERRIDE_FORBIDDEN" };
    }
  }
  return { ok: true as const };
}

type PreflightAction = "SET" | "CANCEL" | "ORDER";

/**
 * Ekstra server-lag før lp_order_set: aktiv avtale + leveringsdag + regelrad (company_current_agreement_rules).
 */
export async function assertOrderWithinAgreementPreflight(params: {
  sb: SupabaseClient;
  companyId: string;
  orderIsoDate: string;
  /** Avtale-regel-slot (f.eks. "lunch"), ikke nødvendigvis orders.slot "default". */
  agreementRuleSlot: string;
  rid: string;
  action: PreflightAction;
}): Promise<{ ok: true } | { ok: false; status: number; code: string; message: string }> {
  const act = safeStr(params.action).toUpperCase();
  if (act === "CANCEL") return { ok: true };

  const dayKey = weekdayKeyFromOsloISODate(params.orderIsoDate);
  if (!dayKey) {
    opsLog("order_rejected_outside_agreement", {
      rid: params.rid,
      reason: "weekend_or_invalid_date",
      date: params.orderIsoDate,
      companyId: params.companyId,
    });
    return {
      ok: false,
      status: 409,
      code: "OUTSIDE_DELIVERY_DAYS",
      message: "Bestilling er ikke tilgjengelig denne dagen.",
    };
  }

  const rule = await requireRule({
    sb: params.sb,
    companyId: params.companyId,
    dayKey,
    slot: params.agreementRuleSlot,
    dateISO: params.orderIsoDate,
    rid: params.rid,
  });

  if (rule.ok === false) {
    const errCode = rule.error;
    if (
      errCode === "AGREEMENT_DAY_NOT_DELIVERY" ||
      errCode === "AGREEMENT_MISSING" ||
      errCode === "AGREEMENT_RULE_MISSING"
    ) {
      opsLog("order_rejected_outside_agreement", {
        rid: params.rid,
        companyId: params.companyId,
        code: errCode,
        date: params.orderIsoDate,
      });
    }
    return { ok: false, status: rule.status, code: errCode, message: rule.message };
  }

  return { ok: true };
}
