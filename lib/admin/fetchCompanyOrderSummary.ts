import "server-only";

import { supabaseServer } from "@/lib/supabase/server";

import type { CompanyOrderSummaryPayload, CompanyOrderSummaryUserRow } from "./companyOrderSummaryTypes";

function num(v: unknown, fallback = 0): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "bigint") return Number(v);
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return fallback;
}

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}

function normalizeUserRow(raw: Record<string, unknown>): CompanyOrderSummaryUserRow {
  return {
    user_id: safeStr(raw.user_id),
    display_name: safeStr(raw.display_name) || "Ukjent",
    active_order_count: num(raw.active_order_count),
    meal_units: num(raw.meal_units),
    subtotal_cents_ex_vat: num(raw.subtotal_cents_ex_vat),
    vat_cents: num(raw.vat_cents),
    gross_cents_inc_vat: num(raw.gross_cents_inc_vat),
  };
}

function normalizeSummary(inner: Record<string, unknown>): CompanyOrderSummaryPayload {
  const perRaw = inner.per_user;
  const perUser = Array.isArray(perRaw) ? perRaw.map((x) => normalizeUserRow((x ?? {}) as Record<string, unknown>)) : [];

  return {
    company_id: safeStr(inner.company_id),
    period_start: safeStr(inner.period_start),
    period_end: safeStr(inner.period_end),
    total_meal_units: num(inner.total_meal_units),
    active_order_count: num(inner.active_order_count),
    total_subtotal_cents_ex_vat: num(inner.total_subtotal_cents_ex_vat),
    total_vat_cents: num(inner.total_vat_cents),
    total_gross_cents_inc_vat: num(inner.total_gross_cents_inc_vat),
    per_user: perUser,
  };
}

export async function fetchCompanyOrderSummary(p: {
  companyId: string;
  periodStart: string;
  periodEnd: string;
}): Promise<CompanyOrderSummaryPayload> {
  const sb = await supabaseServer();
  const { data, error } = await sb.rpc("lp_company_order_summary", {
    p_company_id: p.companyId,
    p_period_start: p.periodStart,
    p_period_end: p.periodEnd,
  });

  if (error) {
    throw new Error(error.message || "RPC_FAILED");
  }

  const root = (data ?? null) as Record<string, unknown> | null;
  const inner = root && typeof root === "object" ? (root.summary as Record<string, unknown> | undefined) : undefined;
  if (!inner || typeof inner !== "object") {
    throw new Error("INVALID_SUMMARY_SHAPE");
  }

  return normalizeSummary(inner);
}
