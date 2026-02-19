import "server-only";

import { writeAuditEvent } from "@/lib/audit/write";
import { addDaysISO, osloTodayISODate, startOfWeekISO } from "@/lib/date/oslo";
import { supabaseAdmin } from "@/lib/supabase/admin";

export type KitchenReportMode = "day" | "week";

type Tier = "BASIS" | "LUXUS";

type Totals = {
  basis: number;
  luxus: number;
  total: number;
};

type KitchenEmployee = {
  user_id: string;
  name: string;
  department: string | null;
  note: string | null;
};

type KitchenLocation = {
  location_id: string;
  location_name: string;
  employees: KitchenEmployee[];
};

type KitchenCompany = {
  company_id: string;
  company_name: string;
  locations: KitchenLocation[];
};

type KitchenSlot = {
  slot: string;
  totals: Totals;
  companies: KitchenCompany[];
};

type KitchenDay = {
  date: string;
  totals: Totals;
  slots: KitchenSlot[];
};

type LegacyLocation = {
  locationId: string;
  locationName: string;
  address: string;
  windowFrom: string | null;
  windowTo: string | null;
  windowLabel: string | null;
  totals: Totals;
  notes: string | null;
  choices: Array<{ key: string; label: string; total: number; variants?: Array<{ name: string; count: number }> }>;
  flags: string[];
};

type LegacyCompany = {
  companyId: string;
  companyName: string;
  totals: Totals;
  locations: LegacyLocation[];
};

export type KitchenReportData = {
  mode: KitchenReportMode;
  date: string;
  dates: string[];
  period: {
    weekStart: string;
    weekEnd: string;
  };
  totals: Totals;
  grandTotals: Totals;
  days: KitchenDay[];
  excluded: Array<{
    order_id: string;
    company_id: string;
    location_id: string;
    date: string;
    reason: "MISSING_ACTIVE_AGREEMENT" | "INVALID_TIER";
  }>;
  companies: LegacyCompany[];
};

export type BuildKitchenReportInput = {
  mode: KitchenReportMode;
  date: string;
  weekStart: string;
  scope: {
    role: "kitchen" | "superadmin";
    company_id: string | null;
    location_id: string | null;
    user_id: string | null;
    email: string | null;
    rid: string;
  };
};

type OrderRow = {
  id: string;
  user_id: string;
  date: string;
  status: string;
  note: string | null;
  company_id: string;
  location_id: string;
  slot: string | null;
};

type AgreementRow = {
  company_id: string;
  location_id: string;
  tier: string | null;
  starts_at?: string | null;
  ends_at?: string | null;
  updated_at?: string | null;
};

// Fail-closed status allowlist for kitchen report.
// We keep this conservative until status contract is explicitly expanded.
const ORDER_ALLOWLIST = ["ACTIVE"] as const;

function safeStr(v: unknown): string {
  return String(v ?? "").trim();
}

function makeTotals(): Totals {
  return { basis: 0, luxus: 0, total: 0 };
}

function addTierTotals(totals: Totals, tier: Tier): void {
  if (tier === "BASIS") totals.basis += 1;
  if (tier === "LUXUS") totals.luxus += 1;
  totals.total += 1;
}

function normalizeTier(raw: unknown): Tier | null {
  const value = safeStr(raw).toUpperCase();
  if (value === "BASIS") return "BASIS";
  if (value === "LUXUS") return "LUXUS";
  return null;
}

function isMissingSchemaError(error: any): boolean {
  const message = safeStr(error?.message || error?.details || error?.hint).toLowerCase();
  const code = safeStr(error?.code).toLowerCase();
  return (
    code === "42703" ||
    code === "42p01" ||
    code === "pgrst205" ||
    message.includes("column") ||
    message.includes("schema cache") ||
    message.includes("relation")
  );
}

function sortSlot(a: string, b: string): number {
  const normalize = (v: string) =>
    safeStr(v)
      .replace(/[\u2013\u2014]/g, "-")
      .replace(/\s/g, "")
      .replace(/:/g, "");
  return normalize(a).localeCompare(normalize(b), "nb", { sensitivity: "base" });
}

function datesForWeek(weekStart: string): string[] {
  return [0, 1, 2, 3, 4].map((offset) => addDaysISO(weekStart, offset));
}

async function fetchOrders(input: BuildKitchenReportInput, dates: string[]): Promise<OrderRow[]> {
  const admin = supabaseAdmin();

  let query = admin
    .from("orders")
    .select("id,user_id,date,status,note,company_id,location_id,slot")
    .in("date", dates)
    .in("status", [...ORDER_ALLOWLIST]);

  if (input.scope.role === "kitchen") {
    query = query.eq("company_id", safeStr(input.scope.company_id));
    if (safeStr(input.scope.location_id)) {
      query = query.eq("location_id", safeStr(input.scope.location_id));
    }
  }

  const { data, error } = await query;
  if (error) throw new Error(`ORDERS_QUERY_FAILED:${safeStr(error.message) || "unknown"}`);

  const rows = (data ?? []) as OrderRow[];
  return rows.filter((row) => {
    const status = safeStr(row.status).toUpperCase();
    return ORDER_ALLOWLIST.includes(status as (typeof ORDER_ALLOWLIST)[number]);
  });
}

async function fetchCompanyNames(companyIds: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (!companyIds.length) return out;

  const admin = supabaseAdmin();
  const { data, error } = await admin.from("companies").select("id,name").in("id", companyIds);
  if (error) throw new Error(`COMPANIES_QUERY_FAILED:${safeStr(error.message) || "unknown"}`);

  for (const row of data ?? []) {
    const id = safeStr((row as any).id);
    if (!id) continue;
    out.set(id, safeStr((row as any).name) || id);
  }

  return out;
}

async function fetchLocationNames(locationIds: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (!locationIds.length) return out;

  const admin = supabaseAdmin();
  const { data, error } = await admin.from("company_locations").select("id,name").in("id", locationIds);
  if (error) throw new Error(`LOCATIONS_QUERY_FAILED:${safeStr(error.message) || "unknown"}`);

  for (const row of data ?? []) {
    const id = safeStr((row as any).id);
    if (!id) continue;
    out.set(id, safeStr((row as any).name) || id);
  }

  return out;
}

async function fetchProfiles(userIds: string[]): Promise<Map<string, { name: string; department: string | null }>> {
  const out = new Map<string, { name: string; department: string | null }>();
  if (!userIds.length) return out;

  const admin = supabaseAdmin();
  const attempts: Array<{ select: string; key: "user_id" | "id" }> = [
    { select: "user_id,full_name,department,email", key: "user_id" },
    { select: "id,full_name,department,email", key: "id" },
    { select: "user_id,full_name,department", key: "user_id" },
    { select: "id,full_name,department", key: "id" },
    { select: "user_id,full_name,email", key: "user_id" },
    { select: "id,full_name,email", key: "id" },
    { select: "user_id,email", key: "user_id" },
    { select: "id,email", key: "id" },
    { select: "user_id", key: "user_id" },
    { select: "id", key: "id" },
  ];

  for (const attempt of attempts) {
    const { data, error } = await admin.from("profiles").select(attempt.select).in(attempt.key, userIds);
    if (error) {
      if (isMissingSchemaError(error)) continue;
      throw new Error(`PROFILES_QUERY_FAILED:${safeStr(error.message) || "unknown"}`);
    }

    for (const row of (data ?? []) as any[]) {
      const userId = safeStr(row?.[attempt.key]);
      if (!userId) continue;
      const name = safeStr(row?.full_name) || safeStr(row?.email) || userId;
      const department = safeStr(row?.department) || null;
      out.set(userId, { name, department });
    }

    return out;
  }

  return out;
}

async function fetchAgreements(companyIds: string[], locationIds: string[]): Promise<Map<string, AgreementRow[]>> {
  const out = new Map<string, AgreementRow[]>();
  if (!companyIds.length || !locationIds.length) return out;

  const admin = supabaseAdmin();
  const attempts = [
    "company_id,location_id,tier,starts_at,ends_at,updated_at",
    "company_id,location_id,tier,starts_at,ends_at",
    "company_id,location_id,tier",
  ];

  let rows: AgreementRow[] = [];
  for (const select of attempts) {
    const { data, error } = await admin
      .from("agreements")
      .select(select)
      .in("company_id", companyIds)
      .in("location_id", locationIds)
      .in("status", ["ACTIVE", "active"]);

    if (error) {
      if (isMissingSchemaError(error)) continue;
      throw new Error(`AGREEMENTS_QUERY_FAILED:${safeStr(error.message) || "unknown"}`);
    }

    rows = (data ?? []) as unknown as AgreementRow[];
    break;
  }

  for (const row of rows) {
    const companyId = safeStr(row.company_id);
    const locationId = safeStr(row.location_id);
    if (!companyId || !locationId) continue;

    const key = `${companyId}:${locationId}`;
    if (!out.has(key)) out.set(key, []);
    out.get(key)!.push(row);
  }

  for (const [key, list] of out.entries()) {
    const sorted = [...list].sort((a, b) => {
      const sa = safeStr(a.starts_at);
      const sb = safeStr(b.starts_at);
      if (sa !== sb) return sb.localeCompare(sa);
      return safeStr(b.updated_at).localeCompare(safeStr(a.updated_at));
    });
    out.set(key, sorted);
  }

  return out;
}

function pickAgreementTier(
  agreementsByScope: Map<string, AgreementRow[]>,
  order: OrderRow
): { tier: Tier | null; reason: "MISSING_ACTIVE_AGREEMENT" | "INVALID_TIER" } {
  const key = `${safeStr(order.company_id)}:${safeStr(order.location_id)}`;
  const list = agreementsByScope.get(key) ?? [];
  if (!list.length) return { tier: null, reason: "MISSING_ACTIVE_AGREEMENT" };

  for (const agreement of list) {
    const startsAt = safeStr(agreement.starts_at);
    const endsAt = safeStr(agreement.ends_at);

    const startOk = !startsAt || startsAt <= order.date;
    const endOk = !endsAt || endsAt >= order.date;
    if (!startOk || !endOk) continue;

    const tier = normalizeTier(agreement.tier);
    if (tier) return { tier, reason: "MISSING_ACTIVE_AGREEMENT" };
    return { tier: null, reason: "INVALID_TIER" };
  }

  return { tier: null, reason: "MISSING_ACTIVE_AGREEMENT" };
}

async function logExcludedOrders(input: BuildKitchenReportInput, excluded: KitchenReportData["excluded"]): Promise<void> {
  if (!excluded.length) return;

  try {
    await writeAuditEvent({
      scope: {
        role: input.scope.role,
        user_id: input.scope.user_id,
        email: input.scope.email,
      },
      action: "kitchen.report.excluded_missing_agreement",
      entity_type: "kitchen_report",
      entity_id: `${input.mode}:${input.date}`,
      summary: `${excluded.length} bestillinger uten aktiv avtale ble ikke tatt med i rapporten.`,
      detail: {
        rid: input.scope.rid,
        mode: input.mode,
        excluded: excluded.slice(0, 200),
      },
    });
  } catch {
    // Best effort only.
  }
}

export function defaultKitchenDate(mode: KitchenReportMode): { date: string; weekStart: string } {
  const today = osloTodayISODate();
  const monday = startOfWeekISO(today);
  if (mode === "day") return { date: today, weekStart: monday };
  return { date: monday, weekStart: monday };
}

export async function buildKitchenReport(input: BuildKitchenReportInput): Promise<KitchenReportData> {
  const weekStart = input.mode === "week" ? input.weekStart : startOfWeekISO(input.date);
  const dates = input.mode === "week" ? datesForWeek(weekStart) : [input.date];
  const weekEnd = addDaysISO(weekStart, 4);

  const rows = await fetchOrders(input, dates);

  const companyIds = Array.from(new Set(rows.map((r) => safeStr(r.company_id)).filter(Boolean)));
  const locationIds = Array.from(new Set(rows.map((r) => safeStr(r.location_id)).filter(Boolean)));
  const userIds = Array.from(new Set(rows.map((r) => safeStr(r.user_id)).filter(Boolean)));

  const [companyNames, locationNames, profiles, agreementsByScope] = await Promise.all([
    fetchCompanyNames(companyIds),
    fetchLocationNames(locationIds),
    fetchProfiles(userIds),
    fetchAgreements(companyIds, locationIds),
  ]);

  const excluded: KitchenReportData["excluded"] = [];

  const dayMap = new Map<string, Map<string, Map<string, Map<string, KitchenEmployee[]>>>>();
  const slotTotalsMap = new Map<string, Totals>();
  const dayTotalsMap = new Map<string, Totals>();
  const legacyCompanyMap = new Map<string, LegacyCompany>();

  const overall = makeTotals();

  const ensureLegacyCompany = (companyId: string): LegacyCompany => {
    const existing = legacyCompanyMap.get(companyId);
    if (existing) return existing;

    const company: LegacyCompany = {
      companyId,
      companyName: companyNames.get(companyId) ?? companyId,
      totals: makeTotals(),
      locations: [],
    };

    legacyCompanyMap.set(companyId, company);
    return company;
  };

  const ensureLegacyLocation = (company: LegacyCompany, locationId: string): LegacyLocation => {
    const found = company.locations.find((loc) => loc.locationId === locationId);
    if (found) return found;

    const next: LegacyLocation = {
      locationId,
      locationName: locationNames.get(locationId) ?? locationId,
      address: "",
      windowFrom: null,
      windowTo: null,
      windowLabel: null,
      totals: makeTotals(),
      notes: null,
      choices: [],
      flags: [],
    };

    company.locations.push(next);
    return next;
  };

  for (const row of rows) {
    const companyId = safeStr(row.company_id);
    const locationId = safeStr(row.location_id);
    const orderId = safeStr(row.id);

    if (!companyId || !locationId || !safeStr(row.user_id) || !safeStr(row.date)) continue;

    const tierRes = pickAgreementTier(agreementsByScope, row);
    if (!tierRes.tier) {
      excluded.push({
        order_id: orderId,
        company_id: companyId,
        location_id: locationId,
        date: row.date,
        reason: tierRes.reason,
      });
      continue;
    }

    const day = row.date;
    const slot = safeStr(row.slot) || "Uten tidsrom";

    if (!dayMap.has(day)) dayMap.set(day, new Map());
    const slotMap = dayMap.get(day)!;

    if (!slotMap.has(slot)) slotMap.set(slot, new Map());
    const companyMap = slotMap.get(slot)!;

    if (!companyMap.has(companyId)) companyMap.set(companyId, new Map());
    const locationMap = companyMap.get(companyId)!;

    if (!locationMap.has(locationId)) locationMap.set(locationId, []);

    const profile = profiles.get(safeStr(row.user_id));
    const employee: KitchenEmployee = {
      user_id: safeStr(row.user_id),
      name: safeStr(profile?.name) || safeStr(row.user_id),
      department: profile?.department ?? null,
      note: safeStr(row.note) || null,
    };

    locationMap.get(locationId)!.push(employee);

    const slotTotalsKey = `${day}:${slot}`;
    if (!slotTotalsMap.has(slotTotalsKey)) slotTotalsMap.set(slotTotalsKey, makeTotals());
    if (!dayTotalsMap.has(day)) dayTotalsMap.set(day, makeTotals());

    addTierTotals(slotTotalsMap.get(slotTotalsKey)!, tierRes.tier);
    addTierTotals(dayTotalsMap.get(day)!, tierRes.tier);
    addTierTotals(overall, tierRes.tier);

    const legacyCompany = ensureLegacyCompany(companyId);
    const legacyLocation = ensureLegacyLocation(legacyCompany, locationId);

    addTierTotals(legacyCompany.totals, tierRes.tier);
    addTierTotals(legacyLocation.totals, tierRes.tier);
  }

  const days: KitchenDay[] = Array.from(dayMap.keys())
    .sort((a, b) => a.localeCompare(b))
    .map((day) => {
      const slotMap = dayMap.get(day)!;
      const slots: KitchenSlot[] = Array.from(slotMap.keys())
        .sort(sortSlot)
        .map((slot) => {
          const companyMap = slotMap.get(slot)!;

          const companies: KitchenCompany[] = Array.from(companyMap.keys())
            .sort((a, b) => (companyNames.get(a) ?? a).localeCompare(companyNames.get(b) ?? b, "nb", { sensitivity: "base" }))
            .map((companyId) => {
              const locationMap = companyMap.get(companyId)!;

              const locations: KitchenLocation[] = Array.from(locationMap.keys())
                .sort((a, b) => (locationNames.get(a) ?? a).localeCompare(locationNames.get(b) ?? b, "nb", { sensitivity: "base" }))
                .map((locationId) => {
                  const employees = [...(locationMap.get(locationId) ?? [])].sort(
                    (a, b) => a.name.localeCompare(b.name, "nb", { sensitivity: "base" }) || a.user_id.localeCompare(b.user_id)
                  );

                  return {
                    location_id: locationId,
                    location_name: locationNames.get(locationId) ?? locationId,
                    employees,
                  };
                });

              return {
                company_id: companyId,
                company_name: companyNames.get(companyId) ?? companyId,
                locations,
              };
            });

          return {
            slot,
            totals: slotTotalsMap.get(`${day}:${slot}`) ?? makeTotals(),
            companies,
          };
        });

      return {
        date: day,
        totals: dayTotalsMap.get(day) ?? makeTotals(),
        slots,
      };
    });

  const companies = Array.from(legacyCompanyMap.values())
    .sort((a, b) => a.companyName.localeCompare(b.companyName, "nb", { sensitivity: "base" }))
    .map((company) => ({
      ...company,
      locations: [...company.locations].sort((a, b) => a.locationName.localeCompare(b.locationName, "nb", { sensitivity: "base" })),
    }));

  await logExcludedOrders(input, excluded);

  return {
    mode: input.mode,
    date: input.mode === "day" ? input.date : weekStart,
    dates,
    period: {
      weekStart,
      weekEnd,
    },
    totals: overall,
    grandTotals: overall,
    days,
    excluded,
    companies,
  };
}

function csvEscape(v: unknown): string {
  const s = String(v ?? "");
  if (/[",\n\r]/.test(s)) return `"${s.replaceAll('"', '""')}"`;
  return s;
}

export function kitchenReportToCsv(report: KitchenReportData): string {
  const lines: string[] = [];

  lines.push(
    [
      "Dato",
      "Slot",
      "Firma",
      "Lokasjon",
      "Ansatt",
      "Avdeling",
      "Notat",
      "Basis slot",
      "Luxus slot",
      "Totalt slot",
      "Basis dag",
      "Luxus dag",
      "Totalt dag",
    ]
      .map(csvEscape)
      .join(",")
  );

  for (const day of report.days) {
    for (const slot of day.slots) {
      for (const company of slot.companies) {
        for (const location of company.locations) {
          if (!location.employees.length) {
            lines.push(
              [
                day.date,
                slot.slot,
                company.company_name,
                location.location_name,
                "",
                "",
                "",
                slot.totals.basis,
                slot.totals.luxus,
                slot.totals.total,
                day.totals.basis,
                day.totals.luxus,
                day.totals.total,
              ]
                .map(csvEscape)
                .join(",")
            );
            continue;
          }

          for (const employee of location.employees) {
            lines.push(
              [
                day.date,
                slot.slot,
                company.company_name,
                location.location_name,
                employee.name,
                employee.department ?? "",
                employee.note ?? "",
                slot.totals.basis,
                slot.totals.luxus,
                slot.totals.total,
                day.totals.basis,
                day.totals.luxus,
                day.totals.total,
              ]
                .map(csvEscape)
                .join(",")
            );
          }
        }
      }
    }
  }

  return "\uFEFF" + lines.join("\n") + "\n";
}

export function parseKitchenMode(raw: string | null): KitchenReportMode | null {
  const mode = safeStr(raw).toLowerCase();
  if (!mode) return "day";
  if (mode === "day" || mode === "week") return mode;
  return null;
}

export function parseKitchenDate(raw: string | null): string {
  return safeStr(raw) || osloTodayISODate();
}

export function parseKitchenWeekStart(raw: string | null): string {
  const base = safeStr(raw) || startOfWeekISO(osloTodayISODate());
  return startOfWeekISO(base);
}
