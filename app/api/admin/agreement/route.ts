// app/api/admin/agreement/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import "server-only";
import type { NextRequest } from "next/server";

import { jsonOk, jsonErr } from "@/lib/http/respond";
import { scopeOr401, requireRoleOr403, requireCompanyScopeOr403, q, readJson } from "@/lib/http/routeGuard";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { DAY_KEYS, type DayKey, type Tier } from "@/lib/agreements/normalize";
import { normalizeDeliveryDaysStrict } from "@/lib/agreements/deliveryDays";
import { opsLog } from "@/lib/ops/log";
import { osloTodayISODate, OSLO_TZ } from "@/lib/date/oslo";
import type {
  AgreementPageData,
  AgreementStatus,
  AgreementPageCompany,
  AgreementEditorContact,
  AgreementEditorSchedule,
} from "@/lib/admin/agreement/types";

type AgreementEditorBody = {
  companyId?: unknown;
  company_id?: unknown;
  locationId?: unknown;
  location_id?: unknown;
  slotStart?: unknown;
  slot_start?: unknown;
  slotEnd?: unknown;
  slot_end?: unknown;
  schedule?: unknown;
  contact?: unknown;
};

const agreementColumnCache = new Map<string, boolean>();

/* =========================================================
   Helpers
========================================================= */

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}

function normRole(v: unknown): "company_admin" | "superadmin" | null {
  const s = safeStr(v).toLowerCase();
  if (s === "company_admin" || s === "companyadmin" || s === "admin") return "company_admin";
  if (s === "superadmin") return "superadmin";
  return null;
}

function normTier(v: any): Tier | null {
  const s = safeStr(v).toUpperCase();
  if (s === "BASIS" || s === "LUXUS") return s as Tier;
  return null;
}

function normDayKey(v: any): DayKey | null {
  const s = safeStr(v).toLowerCase();
  return (DAY_KEYS as readonly string[]).includes(s) ? (s as DayKey) : null;
}

function normAgreementStatus(v: any): "ACTIVE" | "PAUSED" | "CLOSED" | null {
  const s = safeStr(v).toUpperCase();
  if (s === "ACTIVE" || s === "PAUSED" || s === "CLOSED") return s as any;
  return null;
}

function normCompanyStatus(v: any) {
  const s = safeStr(v).toUpperCase();
  if (s === "ACTIVE") return "ACTIVE";
  if (s === "PAUSED") return "PAUSED";
  if (s === "CLOSED") return "CLOSED";
  if (s === "PENDING") return "PENDING";
  return "UNKNOWN";
}

function remainingDays(fromISO: string, toISO: string) {
  const a = new Date(`${fromISO}T00:00:00Z`);
  const b = new Date(`${toISO}T00:00:00Z`);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return null;
  const diff = Math.ceil((b.getTime() - a.getTime()) / 86400000);
  return Math.max(0, diff);
}

function normPriceNok(v: any): number | null {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n);
}

function toOsloParts(d: Date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: OSLO_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return {
    yyyy: get("year"),
    mm: get("month"),
    dd: get("day"),
    hh: Number(get("hour")),
    mi: Number(get("minute")),
  };
}

function cancelledBeforeCutoff(orderDateISO: string, cancelledAtISO: string | null | undefined): boolean {
  if (!cancelledAtISO) return false;
  const d = new Date(cancelledAtISO);
  if (Number.isNaN(d.getTime())) return false;
  const p = toOsloParts(d);
  const dateLocal = `${p.yyyy}-${p.mm}-${p.dd}`;
  if (dateLocal < orderDateISO) return true;
  if (dateLocal > orderDateISO) return false;
  const minutes = p.hh * 60 + p.mi;
  return minutes < 8 * 60;
}

function planReason(status: AgreementStatus, hasRule: boolean): string | null {
  if (status === "PAUSED") return "Firma pauset";
  if (status === "COMPANY_DISABLED") return "Firma deaktivert";
  if (status === "CLOSED") return "Avtale avsluttet";
  if (status === "MISSING_AGREEMENT") return "Mangler avtale";
  if (!hasRule) return "Ikke i avtalen";
  return null;
}

async function countExact(builder: any): Promise<number | null> {
  try {
    const { count, error } = await builder;
    if (error) return null;
    return Number(count ?? 0);
  } catch {
    return null;
  }
}

function labels(): Record<DayKey, "Man" | "Tir" | "Ons" | "Tor" | "Fre"> {
  return { mon: "Man", tue: "Tir", wed: "Ons", thu: "Tor", fri: "Fre" };
}

function buildWeekPlan(status: AgreementStatus, deliveryDays: string[], rulesByDay: Map<DayKey, { tier: Tier }>) {
  const lab = labels();
  return DAY_KEYS.map((dayKey) => {
    const rule = rulesByDay.get(dayKey) ?? null;
    const hasDelivery = deliveryDays.includes(dayKey);
    const hasTier = Boolean(rule?.tier);
    const hasRule = hasDelivery && hasTier;
    const active = status === "ACTIVE" && hasRule;
    const reason = active
      ? null
      : hasDelivery && !hasTier
      ? "Mangler dagoppsett"
      : planReason(status as AgreementStatus, hasRule);

    return {
      dayKey,
      label: lab[dayKey],
      active,
      tier: hasRule ? rule?.tier ?? null : null,
      reasonIfInactive: reason,
    };
  });
}

function buildCompanies(companyId: string, companyRow: any | null, locationName: string | null): AgreementPageCompany[] {
  return [
    {
      id: String(companyRow?.id ?? companyId),
      name: companyRow?.name ?? null,
      orgnr: companyRow?.orgnr ?? null,
      locationName,
    },
  ];
}

/* =========================================================
   GET
========================================================= */

export async function GET(req: NextRequest) {
  const gate = await scopeOr401(req);
  if (gate.ok === false) return gate.res;
  const ctx = gate.ctx;

  const denyRole = requireRoleOr403(ctx, "admin.agreement.read", ["company_admin", "superadmin"]);
  if (denyRole) return denyRole;

  const role = normRole(ctx.scope.role);
  if (!role) return jsonErr(ctx.rid, "Ingen tilgang.", 403, "FORBIDDEN");

  const requestedCompanyId = safeStr(q(req, "companyId") ?? q(req, "company_id"));
  const scopedCompanyId = safeStr(ctx.scope.companyId);
  const companyId = role === "company_admin" ? scopedCompanyId : requestedCompanyId;

  if (role === "company_admin") {
    const denyScope = requireCompanyScopeOr403(ctx);
    if (denyScope) return denyScope;
  }

  if (!companyId) {
    return jsonErr(ctx.rid, "Mangler firmascope.", 403, "MISSING_COMPANY_SCOPE");
  }

  const admin = supabaseAdmin();
  const todayISO = osloTodayISODate();

  // ---------------------------------------------------------
  // Company (FAIL-SOFT)
  // ---------------------------------------------------------
  let companyRow: any | null = null;
  let companyStatus: ReturnType<typeof normCompanyStatus> = "UNKNOWN";

  try {
    const c = await admin
      .from("companies")
      .select("id,name,orgnr,status")
      .eq("id", companyId)
      .maybeSingle();

    if (c.error) {
      opsLog("incident", { rid: ctx.rid, scope: "admin.agreement.company", companyId, error: c.error });
    } else {
      companyRow = c.data ?? null;
      companyStatus = normCompanyStatus(companyRow?.status);
    }
  } catch (e: any) {
    opsLog("incident", { rid: ctx.rid, scope: "admin.agreement.company.throw", companyId, error: String(e?.message ?? e) });
  }

  // Location name (best effort)
  const locationId = safeStr(ctx.scope.locationId);
  let locationName: string | null = null;
  if (locationId) {
    try {
      const locRes = await admin
        .from("company_locations")
        .select("id,name,company_id")
        .eq("id", locationId)
        .eq("company_id", companyId)
        .maybeSingle();
      if (!locRes.error && locRes.data) {
        locationName = String((locRes.data as any).name ?? "") || null;
      }
    } catch {
      // ignore
    }
  }

  // ---------------------------------------------------------
  // Agreement (FAIL-SOFT)
  // Try company_current_agreement first, fallback to agreements table
  // ---------------------------------------------------------
  let agreementRow: any | null = null;
  let agreementStatus: AgreementStatus = "MISSING_AGREEMENT";

  try {
    const a = await admin
      .from("company_current_agreement")
      .select("id,company_id,status,plan_tier,price_per_cuvert_nok,delivery_days,start_date,end_date,updated_at")
      .eq("company_id", companyId)
      .maybeSingle();

    if (a.error) {
      opsLog("incident", { rid: ctx.rid, scope: "admin.agreement.cc_agreement", companyId, error: a.error });

      // Fallback: agreements table
      const fb = await admin
        .from("agreements")
        .select("id,company_id,status,tier as plan_tier,price_per_cuvert_nok,delivery_days,start_date,end_date,updated_at,weekplan")
        .eq("company_id", companyId)
        .order("start_date", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (fb.error) {
        opsLog("incident", { rid: ctx.rid, scope: "admin.agreement.fallback_agreements", companyId, error: fb.error });
      } else {
        agreementRow = fb.data ?? null;
      }
    } else {
      agreementRow = a.data ?? null;
    }
  } catch (e: any) {
    opsLog("incident", { rid: ctx.rid, scope: "admin.agreement.agreement.throw", companyId, error: String(e?.message ?? e) });
  }

  if (companyStatus !== "ACTIVE") {
    agreementStatus = "COMPANY_DISABLED";
  } else if (!agreementRow) {
    agreementStatus = "MISSING_AGREEMENT";
  } else {
    agreementStatus = (normAgreementStatus(agreementRow?.status) ?? "PAUSED") as AgreementStatus;
  }

  // delivery days normalize (safe)
  const deliveryNorm = normalizeDeliveryDaysStrict(agreementRow?.delivery_days);
  if (deliveryNorm.unknown?.length) {
    opsLog("agreement.delivery_days.warning", {
      rid: ctx.rid,
      company_id: companyId,
      agreement_id: agreementRow?.id ?? null,
      unknown: deliveryNorm.unknown,
      days: deliveryNorm.days,
      raw: agreementRow?.delivery_days ?? null,
    });
  }

  // ---------------------------------------------------------
  // Daymap rules (FAIL-SOFT)
  // ---------------------------------------------------------
  const rulesByDay = new Map<DayKey, { tier: Tier }>();
  try {
    const rulesRes = await admin
      .from("v_company_current_agreement_daymap")
      .select("day_key,tier,slot,company_id")
      .eq("company_id", companyId)
      .eq("slot", "lunch");

    if (rulesRes.error) {
      opsLog("incident", { rid: ctx.rid, scope: "admin.agreement.daymap", companyId, error: rulesRes.error });
    } else {
      const unknown_days: string[] = [];
      const unknown_tiers: string[] = [];

      for (const r of rulesRes.data ?? []) {
        const dayKey = normDayKey((r as any)?.day_key);
        const tier = normTier((r as any)?.tier);
        if (!dayKey) {
          const rawDay = (r as any)?.day_key;
          if (rawDay != null) unknown_days.push(String(rawDay));
          continue;
        }
        if (!tier) {
          const rawTier = (r as any)?.tier;
          if (rawTier != null) unknown_tiers.push(String(rawTier));
          continue;
        }
        rulesByDay.set(dayKey, { tier });
      }

      if (unknown_days.length || unknown_tiers.length) {
        opsLog("agreement.daymap.warning", {
          rid: ctx.rid,
          company_id: companyId,
          agreement_id: agreementRow?.id ?? null,
          unknown_days,
          unknown_tiers,
          raw: rulesRes.data ?? null,
        });
      }
    }
  } catch (e: any) {
    opsLog("incident", { rid: ctx.rid, scope: "admin.agreement.daymap.throw", companyId, error: String(e?.message ?? e) });
  }

  const weekPlan = buildWeekPlan(agreementStatus, deliveryNorm.days, rulesByDay);

  // ---------------------------------------------------------
  // Metrics (best effort)
  // ---------------------------------------------------------
  const employeesTotal = await countExact(
    admin.from("profiles").select("user_id", { count: "exact", head: true }).eq("company_id", companyId).eq("role", "employee")
  );
  const employeesActive = await countExact(
    admin.from("profiles").select("user_id", { count: "exact", head: true }).eq("company_id", companyId).eq("role", "employee").is("disabled_at", null)
  );
  const employeesDeactivated = await countExact(
    admin.from("profiles").select("user_id", { count: "exact", head: true }).eq("company_id", companyId).eq("role", "employee").not("disabled_at", "is", null)
  );
  const ordersToday = await countExact(
    admin.from("orders").select("id", { count: "exact", head: true }).eq("company_id", companyId).eq("date", todayISO).eq("status", "ACTIVE")
  );

  let cancelsBeforeCutoff7d: number | null = null;
  try {
    const fromISO = new Date(`${todayISO}T00:00:00Z`);
    fromISO.setUTCDate(fromISO.getUTCDate() - 6);
    const from = fromISO.toISOString().slice(0, 10);

    const { data: cancelledRows, error: cancelledErr } = await admin
      .from("orders")
      .select("date,status,cancelled_at,updated_at,created_at")
      .eq("company_id", companyId)
      .eq("status", "CANCELLED")
      .gte("date", from)
      .lte("date", todayISO);

    if (!cancelledErr) {
      const rows = (cancelledRows ?? []) as Array<{
        date: string;
        status: string | null;
        cancelled_at: string | null;
        updated_at: string | null;
        created_at: string | null;
      }>;

      cancelsBeforeCutoff7d = rows.filter((r) =>
        cancelledBeforeCutoff(r.date, r.cancelled_at ?? r.updated_at ?? r.created_at)
      ).length;
    }
  } catch {
    cancelsBeforeCutoff7d = null;
  }

  const companies = buildCompanies(companyId, companyRow, locationName);

  const data: AgreementPageData = {
    rid: ctx.rid,
    company: companies[0],
    companies,
    role,
    status: agreementStatus as AgreementStatus,
    pricing: {
      planTier: normTier(agreementRow?.plan_tier ?? null),
      pricePerCuvertNok: normPriceNok(agreementRow?.price_per_cuvert_nok ?? null),
      currency: "NOK",
    },
    binding: {
      startDate: agreementRow?.start_date ?? null,
      endDate: agreementRow?.end_date ?? null,
      remainingDays: agreementRow?.end_date ? remainingDays(todayISO, String(agreementRow.end_date)) : null,
    },
    weekPlan,
    metrics: {
      employeesTotal,
      employeesActive,
      employeesDeactivated,
      cancelsBeforeCutoff7d,
      ordersToday,
    },
    updatedAt: agreementRow?.updated_at ?? null,
    cutoff: { time: "08:00", timezone: "Europe/Oslo" },
    sourceOfTruth: {
      companyId,
      agreementId: agreementRow?.id ?? null,
      updatedAt: agreementRow?.updated_at ?? null,
    },
  };

  // ✅ ALWAYS OK for admin UI
  return jsonOk(ctx.rid, data, 200);
}
