// lib/superadmin/queries.ts
import "server-only";
import { supabaseServer } from "@/lib/supabase/server";
import type {
  CompanyStatus as TCompanyStatus,
  FirmsQueryInput,
  FirmsQueryResult,
  FirmRow,
  FirmsSortKey,
  SortDir,
} from "@/lib/superadmin/types";

/* =========================
   Types
========================= */

export type CompanyStatus = "ACTIVE" | "PAUSED" | "CLOSED";

/**
 * companies-tabellen hos dere er MINIMAL.
 * Derived felter hentes fra:
 * - profiles (ansattcount)
 * - company_current_agreement (plan + binding + delivery_days)
 *
 * 🔒 FASIT: Firmaplan i oversikten = høyeste nivå som finnes i avtalen
 * - Hvis én eneste dag er LUXUS -> firmaplan = LUXUS
 * - Ellers BASIS
 */
export type CompanyRow = {
  id: string;
  name: string;
  status: CompanyStatus;

  plan: "BASIS" | "LUXUS" | string | null;
  employees_count: number | null;
  contract_start: string | null; // YYYY-MM-DD
  contract_end: string | null; // YYYY-MM-DD

  created_at?: string | null;
  updated_at?: string | null;
};

export type AuditSeverity = "info" | "warning" | "critical" | string;

export type AuditLogRow = {
  id: string;
  created_at: string;
  actor_user_id: string | null;
  actor_role: string | null;
  action: string;
  severity: AuditSeverity | null;
  company_id: string | null;
  target_type: string | null;
  target_id: string | null;
  target_label: string | null;
  before: any | null;
  after: any | null;
  meta: any | null;
};

export type QualityRow = {
  id: string;
  company_id: string;
  category: string;
  text: string;
  created_at: string;
};

export type DeliveryRow = {
  date: string; // YYYY-MM-DD
  company_id: string;
  company_name?: string;
  location_id?: string | null;
  location_name?: string | null;
  window_label?: string | null;
  portions: number;
  notes?: string | null;
  status?: string | null;
};

export type ForecastRow = {
  date: string; // YYYY-MM-DD
  company_id: string;
  location_id: string | null;
  window_label: string;
  forecast_portions: number;
  low_portions: number;
  high_portions: number;
  risk_level: "low" | "medium" | "high" | string;
  drivers?: any;
  model_version?: string;
  computed_at?: string;
};

export type WasteSignalRow = {
  date: string;
  company_id: string;
  location_id: string | null;
  window_label: string;
  signal_type: string;
  severity: "info" | "warning" | "critical" | string;
  message: string;
  meta?: any;
  created_at: string;
};

export type CronRunRow = {
  id?: string;
  job: string;
  status: "ok" | "error" | string;
  detail: string | null;
  meta: any;
  ran_at: string;
};

/* =========================
   Utils
========================= */

function monthsBetweenISO(fromISO: string, toISO: string) {
  const a = new Date(`${fromISO}T00:00:00Z`);
  const b = new Date(`${toISO}T00:00:00Z`);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return 0;

  const years = b.getUTCFullYear() - a.getUTCFullYear();
  const months = b.getUTCMonth() - a.getUTCMonth();
  const total = years * 12 + months;

  if (b.getUTCDate() < a.getUTCDate()) return Math.max(0, total - 1);
  return Math.max(0, total);
}

function addMonthsToISODate(startISO: string, months: number) {
  const [y, m, d] = String(startISO).split("-").map(Number);
  if (!y || !m || !d) return null;

  const dt = new Date(Date.UTC(y, m - 1 + months, d));
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

export function bindingMonthsLeft(company: Pick<CompanyRow, "contract_end">, todayISO: string) {
  if (!company.contract_end) return null;
  return monthsBetweenISO(todayISO, company.contract_end);
}

/**
 * Konsistent error-håndtering (beholdes)
 */
function assertOk<T>(res: { data: T | null; error: any }, fallbackMessage = "Databasefeil") {
  if (res.error) throw new Error(res.error.message || fallbackMessage);
  return (res.data ?? null) as T | null;
}

function clampInt(v: number, min: number, max: number) {
  if (!Number.isFinite(v)) return min;
  return Math.max(min, Math.min(max, Math.floor(v)));
}

function normQ(q?: string) {
  return String(q ?? "").trim().slice(0, 80);
}

function normStatus(s?: string): TCompanyStatus | "ALL" {
  const v = String(s ?? "ALL").toUpperCase();
  if (v === "ACTIVE" || v === "PAUSED" || v === "CLOSED") return v as TCompanyStatus;
  return "ALL";
}

function normSortKey(k?: string): FirmsSortKey {
  const v = String(k ?? "created_at");
  if (v === "name" || v === "status" || v === "created_at") return v;
  return "created_at";
}

function normSortDir(d?: string): SortDir {
  const v = String(d ?? "desc").toLowerCase();
  return v === "asc" ? "asc" : "desc";
}

/**
 * ✅ MINIMAL companies select (matcher DB)
 */
const COMPANIES_SELECT_MIN = "id,name,status,created_at,updated_at";

function mapCompanyMinToRow(c: any): CompanyRow {
  return {
    id: String(c?.id ?? ""),
    name: String(c?.name ?? ""),
    status: (String(c?.status ?? "ACTIVE").toUpperCase() as CompanyStatus) || "ACTIVE",
    created_at: c?.created_at ?? null,
    updated_at: c?.updated_at ?? null,

    plan: null,
    employees_count: null,
    contract_start: null,
    contract_end: null,
  };
}

/* =========================
   Derived: Employees count (profiles)
========================= */

type ProfileMini = {
  company_id: string | null;
  role?: string | null;
  is_active?: boolean | null;
};

async function fetchEmployeeCounts(companyIds: string[]) {
  const map = new Map<string, number>();
  if (!companyIds.length) return map;

  const supabase = await supabaseServer();
  const res = await supabase.from("profiles").select("company_id, role, is_active").in("company_id", companyIds);
  if (res.error) return map;

  const rows = (res.data || []) as ProfileMini[];
  for (const r of rows) {
    const cid = r.company_id ? String(r.company_id) : null;
    if (!cid) continue;

    const role = String(r.role ?? "employee").toLowerCase();
    const active = r.is_active !== false;

    if (!active) continue;
    if (role !== "employee" && role !== "company_admin") continue;

    map.set(cid, (map.get(cid) ?? 0) + 1);
  }

  return map;
}

/* =========================
   Derived: Agreement (company_current_agreement)
   - Velg deterministisk hvis flere rader per company_id:
     1) status=ACTIVE
     2) høyest updated_at
   - Beregn end_date hvis mangler (start_date + binding_months)
   - 🔒 Firmaplan i oversikt = høyeste nivå i delivery_days
========================= */

type AgreementMeta = {
  plan: string | null; // firmaplan (BASIS/LUXUS)
  contract_start: string | null;
  contract_end: string | null;
  binding_months: number | null;
};

function computeFirmPlan(planTier: string | null, deliveryDays: any): string | null {
  // Hvis delivery_days inneholder LUXUS -> LUXUS, ellers BASIS.
  // Vi bruker base-tier kun som fallback hvis delivery_days mangler helt.
  const base = String(planTier ?? "").toUpperCase();
  const raw = JSON.stringify(deliveryDays ?? {});
  if (raw.includes("LUXUS")) return "LUXUS";
  if (raw.includes("BASIS")) return "BASIS";
  return base || null;
}

async function fetchAgreements(companyIds: string[]) {
  const map = new Map<string, AgreementMeta>();
  if (!companyIds.length) return map;

  const supabase = await supabaseServer();

  const res = await supabase
    .from("company_current_agreement")
    .select("company_id, status, plan_tier, delivery_days, binding_months, start_date, end_date, updated_at")
    .in("company_id", companyIds);

  if (res.error) return map;

  const best = new Map<string, any>();

  const rank = (r: any) => {
    const st = String(r?.status ?? "").toUpperCase();
    const w = st === "ACTIVE" ? 2 : st === "PAUSED" ? 1 : 0;
    const ts = r?.updated_at ? Date.parse(String(r.updated_at)) : 0;
    return w * 1_000_000_000_000 + ts;
  };

  for (const r of res.data || []) {
    const cid = String((r as any).company_id);
    const cur = best.get(cid);
    if (!cur || rank(r) > rank(cur)) best.set(cid, r);
  }

  for (const [cid, r] of best.entries()) {
    const planTier = (r as any).plan_tier ? String((r as any).plan_tier) : null;
    const firmPlan = computeFirmPlan(planTier, (r as any).delivery_days);

    const start = (r as any).start_date ? String((r as any).start_date) : null;
    let end = (r as any).end_date ? String((r as any).end_date) : null;

    const bmRaw = (r as any).binding_months;
    const bindingMonths = Number.isFinite(Number(bmRaw)) ? Number(bmRaw) : null;

    if (!end && start && bindingMonths !== null) {
      end = addMonthsToISODate(start, bindingMonths);
    }

    map.set(cid, {
      plan: firmPlan ? String(firmPlan).toUpperCase() : null,
      contract_start: start,
      contract_end: end,
      binding_months: bindingMonths,
    });
  }

  return map;
}

/* =========================
   DASHBOARD
========================= */

export async function getSuperadminCounts(todayISO: string) {
  const supabase = await supabaseServer();

  const [active, paused, closed] = await Promise.all([
    supabase.from("companies").select("id", { count: "exact", head: true }).eq("status", "ACTIVE"),
    supabase.from("companies").select("id", { count: "exact", head: true }).eq("status", "PAUSED"),
    supabase.from("companies").select("id", { count: "exact", head: true }).eq("status", "CLOSED"),
  ]);

  if (active.error) throw new Error(active.error.message);
  if (paused.error) throw new Error(paused.error.message);
  if (closed.error) throw new Error(closed.error.message);

  const deliveries = await supabase.from("deliveries").select("portions", { count: "exact" }).eq("date", todayISO);
  if (deliveries.error) throw new Error(deliveries.error.message);

  const totalPortions = (deliveries.data || []).reduce((sum, r: any) => sum + (r?.portions ?? 0), 0) || 0;

  return {
    activeCompanies: active.count ?? 0,
    pausedCompanies: paused.count ?? 0,
    closedCompanies: closed.count ?? 0,
    deliveriesToday: deliveries.count ?? 0,
    portionsToday: totalPortions,
  };
}

export async function getSuperadminAlerts(limit = 25) {
  const supabase = await supabaseServer();

  const firms = await supabase
    .from("companies")
    .select("id,name,status,updated_at")
    .in("status", ["PAUSED", "CLOSED"])
    .order("updated_at", { ascending: false })
    .limit(10);

  if (firms.error) throw new Error(firms.error.message);

  const quality = await supabase
    .from("quality_reports")
    .select("id,company_id,category,text,created_at")
    .order("created_at", { ascending: false })
    .limit(15);

  if (quality.error) throw new Error(quality.error.message);

  const companyIds = Array.from(new Set((quality.data || []).map((q: any) => q.company_id).filter(Boolean)));

  const companyMap = new Map<string, string>();
  if (companyIds.length) {
    const comps = await supabase.from("companies").select("id,name").in("id", companyIds);
    if (comps.error) throw new Error(comps.error.message);
    (comps.data || []).forEach((c: any) => companyMap.set(c.id, c.name));
  }

  const firmAlerts =
    (firms.data || []).map((c: any) => ({
      severity: c.status === "CLOSED" ? "critical" : "warning",
      type: "COMPANY_STATUS",
      companyId: c.id,
      companyName: c.name,
      message: c.status === "CLOSED" ? "Firma er stengt" : "Firma er satt på pause",
      at: c.updated_at ?? null,
    })) || [];

  const qualityAlerts =
    (quality.data || []).map((q: any) => ({
      severity: "info",
      type: "QUALITY_REPORT",
      companyId: q.company_id,
      companyName: companyMap.get(q.company_id) ?? "Ukjent firma",
      message: `${q.category}: ${q.text}`,
      at: q.created_at,
      qualityId: q.id,
    })) || [];

  return [...firmAlerts, ...qualityAlerts].sort((a, b) => (b.at || "").localeCompare(a.at || "")).slice(0, limit);
}

/* =========================
   FIRMA LISTE (enkelt)
========================= */

export async function listCompaniesForSuperadmin(todayISO: string, limit = 200) {
  const supabase = await supabaseServer();

  const res = await supabase.from("companies").select(COMPANIES_SELECT_MIN).order("created_at", { ascending: false }).limit(limit);
  if (res.error) throw new Error(res.error.message);

  const base = (res.data || []).map(mapCompanyMinToRow) as CompanyRow[];
  const companyIds = base.map((c) => c.id);

  const [empMap, agrMap] = await Promise.all([fetchEmployeeCounts(companyIds), fetchAgreements(companyIds)]);

  const rows = base.map((c) => {
    const agr = agrMap.get(c.id) ?? { plan: null, contract_start: null, contract_end: null, binding_months: null };

    const enriched: CompanyRow = {
      ...c,
      employees_count: empMap.get(c.id) ?? 0,
      plan: agr.plan ?? null,
      contract_start: agr.contract_start ?? null,
      contract_end: agr.contract_end ?? null,
    };

    return {
      ...enriched,
      bindingMonthsLeft: bindingMonthsLeft(enriched, todayISO),
    };
  });

  return rows;
}

/* =========================
   FIRMA DETALJ
========================= */

export async function getCompanyById(companyId: string) {
  const supabase = await supabaseServer();

  const res = await supabase.from("companies").select(COMPANIES_SELECT_MIN).eq("id", companyId).single();
  if (res.error) throw new Error(res.error.message);

  const base = mapCompanyMinToRow(res.data) as CompanyRow;

  const [empMap, agrMap] = await Promise.all([fetchEmployeeCounts([companyId]), fetchAgreements([companyId])]);

  const agr = agrMap.get(companyId) ?? { plan: null, contract_start: null, contract_end: null, binding_months: null };

  return {
    ...base,
    employees_count: empMap.get(companyId) ?? 0,
    plan: agr.plan ?? null,
    contract_start: agr.contract_start ?? null,
    contract_end: agr.contract_end ?? null,
  } as CompanyRow;
}

export async function listCompanyDeliveries(companyId: string, fromISO: string, toISO: string) {
  const supabase = await supabaseServer();

  const res = await supabase
    .from("deliveries")
    .select("date,company_id,location_id,location_name,window_label,portions,notes,status")
    .eq("company_id", companyId)
    .gte("date", fromISO)
    .lte("date", toISO)
    .order("date", { ascending: false });

  if (res.error) throw new Error(res.error.message);
  return (res.data || []) as DeliveryRow[];
}

export async function listCompanyQuality(companyId: string, limit = 50) {
  const supabase = await supabaseServer();

  const res = await supabase
    .from("quality_reports")
    .select("id,company_id,category,text,created_at")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (res.error) throw new Error(res.error.message);
  return (res.data || []) as QualityRow[];
}

export async function listCompanyAudit(companyId: string, limit = 100) {
  const supabase = await supabaseServer();

  const res = await supabase
    .from("audit_log")
    .select(
      "id,created_at,actor_user_id,actor_role,action,severity,company_id,target_type,target_id,target_label,before,after,meta"
    )
    .eq("company_id", companyId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (res.error) throw new Error(res.error.message);
  return (res.data || []) as AuditLogRow[];
}

/* =========================
   GLOBAL: OPERATIONS / AUDIT
========================= */

export async function listDeliveriesForDate(dateISO: string) {
  const supabase = await supabaseServer();

  const res = await supabase
    .from("deliveries")
    .select("date,company_id,company_name,location_id,location_name,window_label,portions,notes,status")
    .eq("date", dateISO)
    .order("company_name", { ascending: true });

  if (res.error) throw new Error(res.error.message);
  return (res.data || []) as DeliveryRow[];
}

export async function listAuditGlobal(limit = 200) {
  const supabase = await supabaseServer();

  const res = await supabase
    .from("audit_log")
    .select(
      "id,created_at,actor_user_id,actor_role,action,severity,company_id,target_type,target_id,target_label,before,after,meta"
    )
    .order("created_at", { ascending: false })
    .limit(limit);

  if (res.error) throw new Error(res.error.message);
  return (res.data || []) as AuditLogRow[];
}

/* =========================
   FORECAST + WASTE SIGNALS
========================= */

export async function listForecastForDate(dateISO: string) {
  const supabase = await supabaseServer();

  const res = await supabase
    .from("forecast_daily")
    .select(
      "date,company_id,location_id,window_label,forecast_portions,low_portions,high_portions,risk_level,drivers,model_version,computed_at"
    )
    .eq("date", dateISO);

  if (res.error) throw new Error(res.error.message);
  return (res.data || []) as ForecastRow[];
}

export async function listWasteSignalsForDate(dateISO: string) {
  const supabase = await supabaseServer();

  const res = await supabase
    .from("waste_signals")
    .select("date,company_id,location_id,window_label,signal_type,severity,message,meta,created_at")
    .eq("date", dateISO)
    .order("severity", { ascending: false })
    .order("created_at", { ascending: false });

  if (res.error) throw new Error(res.error.message);
  return (res.data || []) as WasteSignalRow[];
}

/* =========================
   HEALTH / CRON RUNS (enterprise)
========================= */

export async function listCronRuns(limit = 50) {
  const supabase = await supabaseServer();

  const res = await supabase
    .from("cron_runs")
    .select("id,job,status,detail,meta,ran_at")
    .order("ran_at", { ascending: false })
    .limit(limit);

  if (res.error) throw new Error(res.error.message);
  return (res.data || []) as CronRunRow[];
}

export async function getSuperadminHealth() {
  const supabase = await supabaseServer();

  const ping = await supabase.from("companies").select("id").limit(1);

  const runs = await supabase
    .from("cron_runs")
    .select("job,status,detail,ran_at,meta")
    .order("ran_at", { ascending: false })
    .limit(30);

  const byJob = new Map<string, any>();
  (runs.data || []).forEach((r: any) => {
    if (!byJob.has(r.job)) byJob.set(r.job, r);
  });

  return {
    supabaseOk: !ping.error,
    supabaseError: ping.error?.message ?? null,
    cron: {
      forecast: byJob.get("forecast") ?? null,
      preprod: byJob.get("preprod") ?? null,
      "week-visibility": byJob.get("week-visibility") ?? null,
    },
  };
}

/* =========================
   FIRMA LISTE (enterprise paginert)
========================= */

export async function listFirms(input: FirmsQueryInput): Promise<FirmsQueryResult> {
  const supabase = await supabaseServer();

  const page = clampInt(Number(input.page ?? 1), 1, 1_000_000);
  const pageSize = clampInt(Number(input.pageSize ?? 50), 10, 100);

  const q = normQ(input.q);
  const status = normStatus(input.status);
  const sortKey = normSortKey(input.sortKey);
  const sortDir = normSortDir(input.sortDir);

  let query = supabase.from("companies").select("id,name,status,created_at", { count: "exact" });

  if (status !== "ALL") query = query.eq("status", status);
  if (q.length) query = query.ilike("name", `%${q}%`);

  const ascending = sortDir === "asc";
  query = query.order(sortKey, { ascending, nullsFirst: false }).order("id", { ascending: true });

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  query = query.range(from, to);

  const res = await query;
  if (res.error) throw new Error(res.error.message);

  const total = Number(res.count ?? 0);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = clampInt(page, 1, totalPages);

  const rowsRaw = (res.data || []) as any[];
  const companyIds = rowsRaw.map((r) => String(r.id)).filter(Boolean);

  const [empMap, agrMap] = await Promise.all([fetchEmployeeCounts(companyIds), fetchAgreements(companyIds)]);

  const todayISO = input.todayISO ?? null;

  const rows: FirmRow[] = rowsRaw.map((c) => {
    const id = String(c.id);
    const agr = agrMap.get(id) ?? { plan: null, contract_start: null, contract_end: null, binding_months: null };

    const contract_end = agr.contract_end ?? null;
    const bindingLeft = todayISO && contract_end ? monthsBetweenISO(todayISO, contract_end) : null;

    return {
      id,
      name: c.name,
      status: c.status,
      created_at: c.created_at ?? null,

      employees_count: empMap.get(id) ?? 0,
      plan: agr.plan ?? null,
      contract_start: agr.contract_start ?? null,
      contract_end,
      bindingMonthsLeft: bindingLeft,
    };
  });

  return {
    rows,
    page: safePage,
    pageSize,
    total,
    totalPages,
    q,
    status,
    sortKey,
    sortDir,
    todayISO: input.todayISO,
  };
}
