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

export type CompanyRow = {
  id: string;
  name: string;
  status: CompanyStatus;
  plan: "BASIS" | "LUXUS" | string;
  employees_count: number | null;
  contract_start: string | null; // YYYY-MM-DD
  contract_end: string | null; // YYYY-MM-DD
  created_at?: string | null;
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
  window_label?: string | null; // e.g. "lunch"
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
  // Enkel og stabil "binding igjen" (mnd): avrundet ned
  // Begge som UTC-datoer for stabilitet
  const a = new Date(`${fromISO}T00:00:00Z`);
  const b = new Date(`${toISO}T00:00:00Z`);

  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return 0;

  const years = b.getUTCFullYear() - a.getUTCFullYear();
  const months = b.getUTCMonth() - a.getUTCMonth();
  const total = years * 12 + months;

  // hvis slutt-dag < start-dag → trekk 1 måned (konservativ)
  if (b.getUTCDate() < a.getUTCDate()) return Math.max(0, total - 1);
  return Math.max(0, total);
}

export function bindingMonthsLeft(company: Pick<CompanyRow, "contract_end">, todayISO: string) {
  if (!company.contract_end) return null;
  return monthsBetweenISO(todayISO, company.contract_end);
}

/**
 * Liten helper for konsistent error-håndtering.
 * (Beholdes fordi du allerede bruker den flere steder.)
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

  // Dagens leveranser (fra public.deliveries-viewet)
  const deliveries = await supabase
    .from("deliveries")
    .select("portions", { count: "exact" })
    .eq("date", todayISO);

  if (deliveries.error) throw new Error(deliveries.error.message);

  const totalPortions =
    (deliveries.data || []).reduce((sum, r: any) => sum + (r?.portions ?? 0), 0) || 0;

  return {
    activeCompanies: active.count ?? 0,
    pausedCompanies: paused.count ?? 0,
    closedCompanies: closed.count ?? 0,
    deliveriesToday: deliveries.count ?? 0,
    portionsToday: totalPortions,
  };
}

/**
 * “Alerts”: konservativ MVP—bygg fra:
 *  - status PAUSED/CLOSED (kritisk / warning)
 *  - siste quality_reports (info)
 */
export async function getSuperadminAlerts(limit = 25) {
  const supabase = await supabaseServer();

  // 1) Firma med PAUSED / CLOSED
  const firms = await supabase
    .from("companies")
    .select("id,name,status,updated_at")
    .in("status", ["PAUSED", "CLOSED"])
    .order("updated_at", { ascending: false })
    .limit(10);

  if (firms.error) throw new Error(firms.error.message);

  // 2) Siste kvalitetsmeldinger
  const quality = await supabase
    .from("quality_reports")
    .select("id,company_id,category,text,created_at")
    .order("created_at", { ascending: false })
    .limit(15);

  if (quality.error) throw new Error(quality.error.message);

  const companyIds = Array.from(
    new Set((quality.data || []).map((q: any) => q.company_id).filter(Boolean))
  );

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

  return [...firmAlerts, ...qualityAlerts]
    .sort((a, b) => (b.at || "").localeCompare(a.at || ""))
    .slice(0, limit);
}

/* =========================
   FIRMA LISTE
========================= */

/**
 * NB: Dette er en enkel liste-variant (limit),
 * og er ok for MVP/utvikling. For enterprise-skala bør vi
 * heller bruke paginering (range) + søk + sort.
 */
export async function listCompaniesForSuperadmin(todayISO: string, limit = 200) {
  const supabase = await supabaseServer();

  const res = await supabase
    .from("companies")
    .select("id,name,status,plan,employees_count,contract_start,contract_end,created_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (res.error) throw new Error(res.error.message);

  const rows = (res.data || []) as CompanyRow[];

  return rows.map((c) => ({
    ...c,
    bindingMonthsLeft: bindingMonthsLeft(c, todayISO),
  }));
}

/* =========================
   FIRMA DETALJ
========================= */

export async function getCompanyById(companyId: string) {
  const supabase = await supabaseServer();

  const res = await supabase
    .from("companies")
    .select("id,name,status,plan,employees_count,contract_start,contract_end,created_at")
    .eq("id", companyId)
    .single();

  if (res.error) throw new Error(res.error.message);
  return res.data as CompanyRow;
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

  // ✅ matcher din audit_log-tabell (company_id, action, severity, before/after, etc.)
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

  // ✅ global audit list (superadmin)
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

  // 1) Supabase ping (beviser auth + db)
  const ping = await supabase.from("companies").select("id").limit(1);

  // 2) Cron last runs
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

/**
 * Paginert firms-list brukt av /superadmin/firms (FirmsTable client).
 * Viktig:
 * - Alltid range() (skalerer)
 * - count: "exact" (kan endres til "estimated" senere)
 * - q: ilike(name)
 */
export async function listFirms(input: FirmsQueryInput): Promise<FirmsQueryResult> {
  const supabase = await supabaseServer();

  const page = clampInt(Number(input.page ?? 1), 1, 1_000_000);
  const pageSize = clampInt(Number(input.pageSize ?? 50), 10, 100);

  const q = normQ(input.q);
  const status = normStatus(input.status);
  const sortKey = normSortKey(input.sortKey);
  const sortDir = normSortDir(input.sortDir);

  let query = supabase
    .from("companies")
    .select("id,name,status,plan,employees_count,contract_start,contract_end,created_at", { count: "exact" });

  if (status !== "ALL") query = query.eq("status", status);

  if (q.length) {
    query = query.ilike("name", `%${q}%`);
  }

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

  const todayISO = input.todayISO ?? null;

  const rowsRaw = (res.data || []) as CompanyRow[];

  const rows: FirmRow[] = rowsRaw.map((c) => ({
    id: c.id,
    name: c.name,
    status: c.status,
    created_at: c.created_at ?? null,

    plan: c.plan ?? null,
    employees_count: c.employees_count,
    contract_start: c.contract_start,
    contract_end: c.contract_end,

    bindingMonthsLeft: todayISO ? bindingMonthsLeft(c, todayISO) : null,
  }));

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
