import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { requireRule } from "@/lib/agreement/requireRule";
import { weekdayKeyFromOsloISODate } from "@/lib/date/weekdayKeyFromIso";
import { opsLog } from "@/lib/ops/log";
import { supabaseAdmin } from "@/lib/supabase/admin";

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

function operativeClosedDatesOrFilter(companyId: string, locationId: string | null | undefined): string {
  const parts = ["and(scope_type.eq.global,scope_id.is.null)", `and(scope_type.eq.company,scope_id.eq.${companyId})`];
  const lid = safeStr(locationId ?? "");
  if (lid) parts.push(`and(scope_type.eq.location,scope_id.eq.${lid})`);
  return parts.join(",");
}

function dateCellToIso(v: unknown): string | null {
  if (!v) return null;
  if (typeof v === "string") return v.slice(0, 10);
  try {
    return new Date(v as string).toISOString().slice(0, 10);
  } catch {
    return null;
  }
}

/**
 * Samme operative `closed_dates`-filter som order-preflight, én runde for datointervall (f.eks. /week window).
 * Server-only via service_role; scope i query (ikke RLS for authenticated).
 */
export async function loadOperativeClosedDatesReasonsInRange(params: {
  companyId: string;
  locationId?: string | null;
  fromIso: string;
  toIso: string;
  rid: string;
}): Promise<
  | { ok: true; byDate: Map<string, string> }
  | { ok: false; status: number; code: "CLOSED_DATES_LOOKUP_FAILED"; message: string }
> {
  const cid = safeStr(params.companyId);
  const from = safeStr(params.fromIso);
  const to = safeStr(params.toIso);
  if (!cid || !from || !to) return { ok: true, byDate: new Map() };

  let admin;
  try {
    admin = supabaseAdmin();
  } catch (e) {
    opsLog("closed_dates.admin_client_unavailable", {
      rid: params.rid,
      companyId: cid,
      err: safeStr(e instanceof Error ? e.message : e),
    });
    return {
      ok: false,
      status: 500,
      code: "CLOSED_DATES_LOOKUP_FAILED",
      message: "Kunne ikke verifisere stengte datoer.",
    };
  }

  const orFilter = operativeClosedDatesOrFilter(cid, params.locationId);
  const { data, error } = await (admin as any)
    .from("closed_dates")
    .select("date,reason")
    .gte("date", from)
    .lte("date", to)
    .or(orFilter);

  if (error) {
    opsLog("closed_dates.range_lookup_failed", {
      rid: params.rid,
      companyId: cid,
      from,
      to,
      supabase_error: safeStr((error as any)?.message ?? error),
    });
    return {
      ok: false,
      status: 500,
      code: "CLOSED_DATES_LOOKUP_FAILED",
      message: "Kunne ikke verifisere stengte datoer.",
    };
  }

  const byDate = new Map<string, string>();
  const rows = Array.isArray(data) ? data : [];
  for (const row of rows) {
    const ds = dateCellToIso((row as any)?.date);
    if (!ds) continue;
    if (byDate.has(ds)) continue;
    const reason = safeStr((row as any)?.reason);
    byDate.set(ds, reason || "Stengt");
  }

  return { ok: true, byDate };
}

async function assertOperativeClosedDatesAllowOrder(params: {
  companyId: string;
  locationId?: string | null;
  orderIsoDate: string;
  rid: string;
}): Promise<{ ok: true } | { ok: false; status: number; code: string; message: string }> {
  const d = safeStr(params.orderIsoDate);
  const cid = safeStr(params.companyId);
  if (!d || !cid) return { ok: true as const };

  const range = await loadOperativeClosedDatesReasonsInRange({
    companyId: cid,
    locationId: params.locationId,
    fromIso: d,
    toIso: d,
    rid: params.rid,
  });

  if (range.ok === false) {
    return {
      ok: false,
      status: range.status,
      code: range.code,
      message: range.message,
    };
  }

  const reason = range.byDate.get(d);
  if (reason != null) {
    opsLog("order_rejected_closed_date", {
      rid: params.rid,
      companyId: cid,
      date: d,
      has_reason: Boolean(safeStr(reason)),
    });
    return {
      ok: false,
      status: 409,
      code: "CLOSED_DATE",
      message: safeStr(reason) ? `Denne datoen er stengt: ${reason}` : "Denne datoen er stengt for bestilling.",
    };
  }

  return { ok: true as const };
}

/**
 * Ekstra server-lag før lp_order_set:
 * 1) Operativ `closed_dates` (service_role + eksplisitt scope i query)
 * 2) Aktiv avtale + leveringsdag + regelrad (`requireRule` + company_current_agreement*)
 */
export async function assertOrderWithinAgreementPreflight(params: {
  sb: SupabaseClient;
  companyId: string;
  /** company_locations.id når profil har lokasjon — brukes for location-scope i closed_dates. */
  locationId?: string | null;
  orderIsoDate: string;
  /** Avtale-regel-slot (f.eks. "lunch"), ikke nødvendigvis orders.slot "default". */
  agreementRuleSlot: string;
  rid: string;
  action: PreflightAction;
}): Promise<{ ok: true } | { ok: false; status: number; code: string; message: string }> {
  void params.action;

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

  const closed = await assertOperativeClosedDatesAllowOrder({
    companyId: params.companyId,
    locationId: params.locationId,
    orderIsoDate: params.orderIsoDate,
    rid: params.rid,
  });
  if (closed.ok === false) return closed;

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
