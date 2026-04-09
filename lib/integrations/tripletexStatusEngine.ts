import "server-only";

import { classifyTripletexError, requestTripletex } from "@/lib/integrations/tripletex/client";
import { INTEGRATIONS } from "@/lib/integrations/config";
import { osloTodayISODate } from "@/lib/date/oslo";
import { opsLog } from "@/lib/ops/log";
import { supabaseAdmin } from "@/lib/supabase/admin";

function safeStr(v: unknown): string {
  return String(v ?? "").trim();
}

function safeNum(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/** Tripletex list payload: values array or bare array */
function extractInvoiceRows(value: unknown): Record<string, unknown>[] {
  const v = value as { values?: unknown } | unknown[] | null;
  if (Array.isArray(v)) return v as Record<string, unknown>[];
  if (v && typeof v === "object" && Array.isArray((v as { values?: unknown }).values)) {
    return ((v as { values: unknown[] }).values ?? []) as Record<string, unknown>[];
  }
  return [];
}

function parseIsoDateToUtcMidnightMs(iso: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(safeStr(iso));
  if (!m) return null;
  const t = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(t) ? null : t;
}

/** Whole days late vs Oslo calendar today (due date end-of-day semantics: overdue if today > dueDate). */
function daysOverdueFromDueDate(dueIso: string, todayIso: string): number {
  const dueMs = parseIsoDateToUtcMidnightMs(dueIso);
  const todayMs = parseIsoDateToUtcMidnightMs(todayIso);
  if (dueMs === null || todayMs === null) return 0;
  const diff = Math.floor((todayMs - dueMs) / 86_400_000);
  return diff > 0 ? diff : 0;
}

function outstandingAmount(row: Record<string, unknown>): number {
  const candidates = [
    row.amountOutstanding,
    row.amountOutstandingNok,
    row.balance,
    row.amountBalance,
    row.restAmount,
    row.restAmountCurrency,
  ];
  for (const c of candidates) {
    const n = safeNum(c);
    if (n > 0) return n;
  }
  return 0;
}

export type CompanyTripletexInvoiceStatus = {
  source: "tripletex" | "disabled" | "no_customer_mapping" | "tripletex_error" | "parse_gap";
  /** ok = ingen forfalt saldo etter Tripletex-svar */
  status: "ok" | "overdue" | "severe_overdue" | "unknown";
  daysOverdue: number;
  amountDue: number;
  detail?: string;
};

/**
 * Leser åpne/forfalte kundefakturaer fra Tripletex (liste-GET). Ingen lokal fakturaberegning.
 * Krever TRIPLETEX_CREDIT_CHECK_ENABLED=true + Tripletex-session + tripletex_customers-mapping.
 */
export async function getCompanyInvoiceStatus(
  companyId: string,
  ctx: { rid: string },
): Promise<CompanyTripletexInvoiceStatus> {
  const cid = safeStr(companyId);
  if (!cid) {
    return { source: "parse_gap", status: "unknown", daysOverdue: 0, amountDue: 0, detail: "missing_company_id" };
  }

  const creditReadEnabled = safeStr(process.env.TRIPLETEX_CREDIT_CHECK_ENABLED).toLowerCase() === "true";
  if (!creditReadEnabled || !INTEGRATIONS.tripletex.enabled) {
    return { source: "disabled", status: "ok", daysOverdue: 0, amountDue: 0 };
  }

  const admin = supabaseAdmin();
  const { data: mapRow, error: mapErr } = await admin
    .from("tripletex_customers")
    .select("tripletex_customer_id")
    .eq("company_id", cid)
    .maybeSingle();

  if (mapErr) {
    opsLog("tripletex_credit_status_mapping_error", { rid: ctx.rid, companyId: cid, message: safeStr(mapErr.message) });
    return { source: "tripletex_error", status: "unknown", daysOverdue: 0, amountDue: 0, detail: "mapping_query_failed" };
  }

  const tripletexCustomerId = safeStr((mapRow as { tripletex_customer_id?: unknown })?.tripletex_customer_id);
  if (!tripletexCustomerId) {
    return { source: "no_customer_mapping", status: "unknown", daysOverdue: 0, amountDue: 0 };
  }

  try {
    const res = await requestTripletex({
      method: "GET",
      path: "/invoice",
      query: {
        customerId: tripletexCustomerId,
        from: 0,
        count: 200,
      },
    });

    const rows = extractInvoiceRows(res.value);
    const today = osloTodayISODate();
    let maxDaysLate = 0;
    let totalDue = 0;

    for (const row of rows) {
      const due = safeStr(row.dueDate ?? row.due_date);
      const out = outstandingAmount(row);
      if (out <= 0 || !due) continue;
      totalDue += out;
      maxDaysLate = Math.max(maxDaysLate, daysOverdueFromDueDate(due, today));
    }

    const status: CompanyTripletexInvoiceStatus["status"] =
      maxDaysLate >= 30 ? "severe_overdue" : maxDaysLate > 0 ? "overdue" : "ok";

    return {
      source: "tripletex",
      status,
      daysOverdue: maxDaysLate,
      amountDue: Number(totalDue.toFixed(4)),
    };
  } catch (e) {
    const te = classifyTripletexError(e);
    opsLog("tripletex_credit_status_error", {
      rid: ctx.rid,
      companyId: cid,
      code: te.code,
      message: te.message,
    });
    return {
      source: "tripletex_error",
      status: "unknown",
      daysOverdue: 0,
      amountDue: 0,
      detail: te.code,
    };
  }
}
