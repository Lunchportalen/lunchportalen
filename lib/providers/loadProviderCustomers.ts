// lib/providers/loadProviderCustomers.ts
import "server-only";

import { addDaysISO, osloTodayISODate, startOfWeekISO } from "@/lib/date/oslo";
import type {
  ProviderCustomerFilter,
  ProviderCustomerRow,
  ProviderCustomerStatus,
  ProviderCustomersPage,
} from "@/lib/providers/customerTypes";
import { buildCustomerStatusCounts } from "@/lib/providers/providerCustomersSurface";
import { supabaseServer } from "@/lib/supabase/server";

export type { ProviderCustomerFilter, ProviderCustomerRow, ProviderCustomerStatus, ProviderCustomersPage } from "@/lib/providers/customerTypes";
export { providerCustomerStatusLabel } from "@/lib/providers/customerTypes";

const PAGE_SIZE = 20;

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}

function deriveStatus(row: {
  deleted_at?: string | null;
  suspended_at?: string | null;
  paused_at?: string | null;
}): ProviderCustomerStatus {
  if (row.deleted_at) return "DELETED";
  if (row.suspended_at) return "SUSPENDED";
  if (row.paused_at) return "PAUSED";
  return "ACTIVE";
}

/**
 * Visningssemantikk (uendret fra tidligere DB-gate):
 * «all» viser kun ikke-slettede; «deleted» viser kun slettede; øvrige matcher eksakt status.
 */
function matchesFilter(status: ProviderCustomerStatus, filter: ProviderCustomerFilter): boolean {
  if (filter === "all") return status !== "DELETED";
  if (filter === "active") return status === "ACTIVE";
  if (filter === "suspended") return status === "SUSPENDED";
  if (filter === "paused") return status === "PAUSED";
  if (filter === "deleted") return status === "DELETED";
  return status !== "DELETED";
}

async function enrichCounts(
  sb: Awaited<ReturnType<typeof supabaseServer>>,
  companyIds: string[],
  weekStart: string,
  weekEnd: string,
) {
  const employees = new Map<string, number>();
  const orders = new Map<string, number>();
  if (!companyIds.length) return { employees, orders };

  const [{ data: profs }, { data: ords }] = await Promise.all([
    sb
      .from("profiles")
      .select("company_id")
      .in("company_id", companyIds)
      .is("disabled_at", null),
    sb
      .from("orders")
      .select("company_id")
      .in("company_id", companyIds)
      .gte("date", weekStart)
      .lt("date", weekEnd)
      .eq("status", "ACTIVE"),
  ]);

  for (const id of companyIds) {
    employees.set(id, 0);
    orders.set(id, 0);
  }

  for (const row of Array.isArray(profs) ? profs : []) {
    const cid = safeStr((row as { company_id?: string }).company_id);
    if (cid) employees.set(cid, (employees.get(cid) ?? 0) + 1);
  }

  for (const row of Array.isArray(ords) ? ords : []) {
    const cid = safeStr((row as { company_id?: string }).company_id);
    if (cid) orders.set(cid, (orders.get(cid) ?? 0) + 1);
  }

  return { employees, orders };
}

/**
 * Provider-scoped company list with filter, search, pagination.
 */
export async function loadProviderCustomers(
  providerId: string,
  filter: ProviderCustomerFilter = "all",
  search = "",
  page = 1,
): Promise<ProviderCustomersPage> {
  const pid = safeStr(providerId);
  const currentPage = Math.max(1, Math.floor(page) || 1);
  const term = safeStr(search).toLowerCase();

  const emptyCounts = buildCustomerStatusCounts([]);

  if (!pid) {
    return { customers: [], totalCount: 0, currentPage: 1, totalPages: 1, pageSize: PAGE_SIZE, statusCounts: emptyCounts };
  }

  const sb = await supabaseServer();
  const today = osloTodayISODate();
  const weekStart = startOfWeekISO(today);
  const weekEnd = addDaysISO(weekStart, 7);

  // Deleted-gaten håndteres i minne (matchesFilter) med identisk visningssemantikk,
  // slik at statuschip-tellinger kan beregnes fra samme resultatsett uten ekstra query.
  let query = (sb as any)
    .from("companies")
    .select("id, name, updated_at, deleted_at, suspended_at, paused_at", { count: "exact" })
    .eq("provider_id", pid)
    .order("updated_at", { ascending: false });

  if (term) {
    query = query.ilike("name", `%${term}%`);
  }

  const { data: allRows, error } = await query;
  if (error || !Array.isArray(allRows)) {
    return { customers: [], totalCount: 0, currentPage, totalPages: 1, pageSize: PAGE_SIZE, statusCounts: emptyCounts };
  }

  const mapped = allRows.map((row: Record<string, unknown>) => {
    const status = deriveStatus(row as { deleted_at?: string | null; suspended_at?: string | null; paused_at?: string | null });
    return {
      id: safeStr(row.id),
      name: safeStr(row.name) || "Uten navn",
      status,
      updatedAt: row.updated_at != null ? String(row.updated_at) : null,
      employeesCount: 0,
      ordersThisWeek: 0,
    };
  });

  const statusCounts = buildCustomerStatusCounts(mapped.map((c) => c.status));
  const filtered = mapped.filter((c) => matchesFilter(c.status, filter));
  const totalCount = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const sliceStart = (safePage - 1) * PAGE_SIZE;
  const pageRows = filtered.slice(sliceStart, sliceStart + PAGE_SIZE);

  const ids = pageRows.map((c) => c.id).filter(Boolean);
  const { employees, orders } = await enrichCounts(sb, ids, weekStart, weekEnd);

  const customers = pageRows.map((c) => ({
    ...c,
    employeesCount: employees.get(c.id) ?? 0,
    ordersThisWeek: orders.get(c.id) ?? 0,
  }));

  return {
    customers,
    totalCount,
    currentPage: safePage,
    totalPages,
    pageSize: PAGE_SIZE,
    statusCounts,
  };
}
