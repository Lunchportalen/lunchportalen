// lib/admin/fetchAgreementPageDataServer.ts
/** Delt server-loader for AgreementPageData. */
import "server-only";

import { loadAdminContext, isAdminContextBlocked } from "@/lib/admin/loadAdminContext";
import type { AgreementDayTiers, AgreementPageCompany, AgreementPageData, AgreementStatus, DayKey, Tier } from "@/lib/admin/agreement/types";
import { getAgreementStatus } from "@/lib/auth/agreementStatus";
import { normalizeDeliveryDaysStrict } from "@/lib/agreements/deliveryDays";
import { osloTodayISODate, OSLO_TZ } from "@/lib/date/oslo";
import { supabaseAdmin } from "@/lib/supabase/admin";

export type AgreementPageFetchResult =
  | { kind: "ok"; data: AgreementPageData; rid: string }
  | { kind: "error"; message: string; rid: string; errorCode?: string | null };

function makeRid(prefix = "admin_agreement") {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}

function normTier(v: unknown): Tier | null {
  const s = safeStr(v).toUpperCase();
  if (s === "BASIS" || s === "LUXUS" || s === "ENTERPRISE") return s as Tier;
  return null;
}

function normAgreementStatus(v: unknown): "ACTIVE" | "PAUSED" | "CLOSED" | null {
  const s = safeStr(v).toUpperCase();
  if (s === "ACTIVE" || s === "PAUSED" || s === "CLOSED") return s as any;
  return null;
}

function normCompanyStatus(v: unknown) {
  const s = safeStr(v).toUpperCase();
  if (s === "ACTIVE") return "ACTIVE";
  if (s === "PAUSED") return "PAUSED";
  if (s === "CLOSED") return "CLOSED";
  if (s === "PENDING") return "PENDING";
  return "UNKNOWN";
}

function normPriceNok(v: unknown): number | null {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n);
}

function remainingDays(fromISO: string, toISO: string) {
  const a = new Date(`${fromISO}T00:00:00Z`);
  const b = new Date(`${toISO}T00:00:00Z`);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return null;
  const diff = Math.ceil((b.getTime() - a.getTime()) / 86400000);
  return Math.max(0, diff);
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

async function countExact(builder: any): Promise<number | null> {
  try {
    const { count, error } = await builder;
    if (error) return null;
    return Number(count ?? 0);
  } catch {
    return null;
  }
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

const DAY_KEYS: DayKey[] = ["mon", "tue", "wed", "thu", "fri"];

const DAY_LABELS: Record<DayKey, "Man" | "Tir" | "Ons" | "Tor" | "Fre"> = {
  mon: "Man",
  tue: "Tir",
  wed: "Ons",
  thu: "Tor",
  fri: "Fre",
};

function planReason(status: AgreementStatus, active: boolean): string | null {
  if (active) return null;
  if (status === "PAUSED") return "Firma pauset";
  if (status === "COMPANY_DISABLED") return "Firma deaktivert";
  if (status === "CLOSED") return "Avtale avsluttet";
  if (status === "MISSING_AGREEMENT") return "Mangler avtale";
  return "Ikke i avtalen";
}

function buildWeekPlan(status: AgreementStatus, deliveryDays: string[], dayTiers: AgreementDayTiers): AgreementPageData["weekPlan"] {
  return DAY_KEYS.map((dayKey) => {
    const active = deliveryDays.includes(dayKey);
    return {
      dayKey,
      label: DAY_LABELS[dayKey],
      active,
      tier: active ? dayTiers[dayKey] ?? null : null,
      reasonIfInactive: planReason(status, active),
    };
  });
}

async function resolveCompanyId(companyId?: string | null) {
  const scopedCompanyId = safeStr(companyId);
  if (scopedCompanyId) return scopedCompanyId;

  const ctx = await loadAdminContext({
    nextPath: "/admin/agreement",
    enforceCompanyAdmin: true,
    returnBlockedState: true,
  });

  if (isAdminContextBlocked(ctx)) return null;
  return ctx.companyId;
}

/**
 * Henter AgreementPageData direkte på server.
 * For company_admin skal caller enten sende server-truth companyId fra loadAdminContext,
 * eller la loaderen resolve samme kontekst selv.
 */
export async function fetchAgreementPageDataForAdmin(companyId?: string | null): Promise<AgreementPageFetchResult> {
  const rid = makeRid();

  try {
    const resolvedCompanyId = await resolveCompanyId(companyId);
    if (!resolvedCompanyId) {
      return { kind: "error", message: "Mangler firmascope.", rid, errorCode: "MISSING_COMPANY_SCOPE" };
    }

    const admin = supabaseAdmin();
    const todayISO = osloTodayISODate();

    let companyRow: any | null = null;
    let companyStatus: ReturnType<typeof normCompanyStatus> = "UNKNOWN";
    const companyRes = await admin
      .from("companies")
      .select("id,name,orgnr,status")
      .eq("id", resolvedCompanyId)
      .maybeSingle();

    if (!companyRes.error) {
      companyRow = companyRes.data ?? null;
      companyStatus = normCompanyStatus(companyRow?.status);
    }

    let locationName: string | null = null;
    try {
      const ctx = await loadAdminContext({
        nextPath: "/admin/agreement",
        enforceCompanyAdmin: true,
        returnBlockedState: true,
      });
      const locationId = isAdminContextBlocked(ctx) ? null : ctx.profile.location_id;
      if (locationId) {
        const locRes = await admin
          .from("company_locations")
          .select("id,name,company_id")
          .eq("id", locationId)
          .eq("company_id", resolvedCompanyId)
          .maybeSingle();
        if (!locRes.error && locRes.data) {
          locationName = safeStr((locRes.data as any).name) || null;
        }
      }
    } catch {
      locationName = null;
    }

    let agreementRow: any | null = null;
    const currentAgreementRes = await admin
      .from("company_current_agreement")
      .select("id,company_id,status,plan_tier,price_per_cuvert_nok,delivery_days,start_date,end_date,updated_at")
      .eq("company_id", resolvedCompanyId)
      .maybeSingle();

    if (!currentAgreementRes.error) {
      agreementRow = currentAgreementRes.data ?? null;
    } else {
      const fallbackRes = await admin
        .from("agreements")
        .select("id,company_id,status,tier,price_per_meal_nok,delivery_days,starts_at,ends_at,created_at,updated_at")
        .eq("company_id", resolvedCompanyId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!fallbackRes.error && fallbackRes.data) {
        const row = fallbackRes.data as any;
        agreementRow = {
          ...row,
          plan_tier: row.tier ?? null,
          price_per_cuvert_nok: row.price_per_meal_nok ?? null,
          start_date: row.starts_at ?? (safeStr(row.created_at).slice(0, 10) || null),
          end_date: row.ends_at ?? null,
        };
      }
    }

    const agreementStatusResult = await getAgreementStatus(admin as any, resolvedCompanyId);
    let agreementStatus: AgreementStatus = "MISSING_AGREEMENT";
    if (companyStatus !== "ACTIVE") {
      agreementStatus = "COMPANY_DISABLED";
    } else if (!agreementRow) {
      agreementStatus = "MISSING_AGREEMENT";
    } else {
      agreementStatus = (normAgreementStatus(agreementRow?.status) ?? "PAUSED") as AgreementStatus;
    }

    const deliveryNorm = normalizeDeliveryDaysStrict(agreementRow?.delivery_days);
    const dayTiers = agreementStatusResult.dayTiers;
    const weekPlan = buildWeekPlan(agreementStatus, deliveryNorm.days, dayTiers);

    const employeesTotal = await countExact(
      admin.from("profiles").select("id", { count: "exact", head: true }).eq("company_id", resolvedCompanyId).eq("role", "employee")
    );
    const employeesActive = await countExact(
      admin
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("company_id", resolvedCompanyId)
        .eq("role", "employee")
        .is("disabled_at", null)
    );
    const employeesDeactivated = await countExact(
      admin
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("company_id", resolvedCompanyId)
        .eq("role", "employee")
        .not("disabled_at", "is", null)
    );
    const ordersToday = await countExact(
      admin.from("orders").select("id", { count: "exact", head: true }).eq("company_id", resolvedCompanyId).eq("date", todayISO).eq("status", "ACTIVE")
    );

    let cancelsBeforeCutoff7d: number | null = null;
    try {
      const fromISO = new Date(`${todayISO}T00:00:00Z`);
      fromISO.setUTCDate(fromISO.getUTCDate() - 6);
      const from = fromISO.toISOString().slice(0, 10);

      const { data: cancelledRows, error: cancelledErr } = await admin
        .from("orders")
        .select("date,status,cancelled_at,updated_at,created_at")
        .eq("company_id", resolvedCompanyId)
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

    let bindingMonths: number | null = null;
    let noticeMonths: number | null = null;
    if (agreementRow?.id) {
      try {
        const { data: termRow } = await admin
          .from("agreements")
          .select("binding_months, notice_months")
          .eq("id", agreementRow.id)
          .maybeSingle();
        if (termRow) {
          const bm = Number((termRow as any).binding_months);
          const nm = Number((termRow as any).notice_months);
          bindingMonths = Number.isFinite(bm) && bm > 0 ? bm : null;
          noticeMonths = Number.isFinite(nm) && nm > 0 ? nm : null;
        }
      } catch {
        // best-effort only
      }
    }

    const companies = buildCompanies(resolvedCompanyId, companyRow, locationName);
    const data: AgreementPageData = {
      rid,
      company: companies[0],
      companies,
      role: "company_admin",
      status: agreementStatus,
      pricing: {
        planTier: agreementStatusResult.tier,
        dayTiers,
        pricePerCuvertNok: normPriceNok(agreementRow?.price_per_cuvert_nok ?? null),
        currency: "NOK",
      },
      binding: {
        startDate: agreementRow?.start_date ?? null,
        endDate: agreementRow?.end_date ?? null,
        remainingDays: agreementRow?.end_date ? remainingDays(todayISO, String(agreementRow.end_date)) : null,
      },
      terms: { bindingMonths, noticeMonths },
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
        companyId: resolvedCompanyId,
        agreementId: agreementRow?.id ?? agreementStatusResult.agreementId ?? null,
        updatedAt: agreementRow?.updated_at ?? null,
      },
    };

    return { kind: "ok", data, rid };
  } catch {
    return { kind: "error", message: "Kunne ikke hente avtalen. Prøv igjen.", rid, errorCode: "FETCH_FAILED" };
  }
}
