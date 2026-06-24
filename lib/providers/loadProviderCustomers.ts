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
import { buildProviderInvoiceSettings, invoiceMethodPresentationKey } from "@/lib/providers/providerCustomerBilling";
import { loadProviderCustomerCountsForCompanies } from "@/lib/providers/providerCustomerCounts";
import { isProviderSelfCustomer } from "@/lib/providers/providerCustomerScope";
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
  providerId: string,
  companyIds: string[],
  weekStart: string,
  weekEnd: string,
) {
  return loadProviderCustomerCountsForCompanies(providerId, companyIds, weekStart, weekEnd);
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

  const { data: providerRow } = await sb
    .from("providers")
    .select("id,name,org_number")
    .eq("id", pid)
    .maybeSingle();

  const providerIdentity = providerRow
    ? {
        id: pid,
        name: safeStr((providerRow as { name?: string }).name) || null,
        orgNumber: (providerRow as { org_number?: string | null }).org_number ?? null,
      }
    : { id: pid, name: null, orgNumber: null };

  // Deleted-gaten håndteres i minne (matchesFilter) med identisk visningssemantikk,
  // slik at statuschip-tellinger kan beregnes fra samme resultatsett uten ekstra query.
  let query = (sb as any)
    .from("companies")
    .select(
      "id, name, orgnr, organization_number, updated_at, deleted_at, suspended_at, paused_at, billing_email, ehf_enabled, ehf_endpoint",
      { count: "exact" },
    )
    .eq("provider_id", pid)
    .order("updated_at", { ascending: false });

  if (term) {
    query = query.ilike("name", `%${term}%`);
  }

  const { data: allRows, error } = await query;
  if (error || !Array.isArray(allRows)) {
    return { customers: [], totalCount: 0, currentPage, totalPages: 1, pageSize: PAGE_SIZE, statusCounts: emptyCounts };
  }

  const mapped = allRows
    .map((row: Record<string, unknown>) => {
      const status = deriveStatus(row as { deleted_at?: string | null; suspended_at?: string | null; paused_at?: string | null });
      const invoice = buildProviderInvoiceSettings({
        orgnr: row.orgnr,
        organizationNumber: row.organization_number,
        billingEmail: row.billing_email,
        ehfEnabled: row.ehf_enabled,
        ehfEndpoint: row.ehf_endpoint,
      });
      return {
        id: safeStr(row.id),
        name: safeStr(row.name) || "Uten navn",
        orgnr: invoice.orgnr,
        status,
        updatedAt: row.updated_at != null ? String(row.updated_at) : null,
        employeesCount: null as number | null,
        ordersThisWeek: null as number | null,
        historicalOrdersCount: null as number | null,
        invoiceMethodKey: invoiceMethodPresentationKey(invoice.method),
      };
    })
    .filter((row) =>
      !isProviderSelfCustomer(
        { id: row.id, name: row.name, orgnr: row.orgnr },
        providerIdentity,
      ),
    );

  const statusCounts = buildCustomerStatusCounts(mapped.map((c) => c.status));
  const filtered = mapped.filter((c) => matchesFilter(c.status, filter));
  const totalCount = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const sliceStart = (safePage - 1) * PAGE_SIZE;
  const pageRows = filtered.slice(sliceStart, sliceStart + PAGE_SIZE);

  const ids = pageRows.map((c) => c.id).filter(Boolean);
  const { byCompanyId } = await enrichCounts(pid, ids, weekStart, weekEnd);

  const customers = pageRows.map((c) => {
    const counts = byCompanyId.get(c.id);
    return {
      ...c,
      employeesCount: counts?.employeesCount ?? null,
      ordersThisWeek: counts?.ordersThisWeek ?? null,
      historicalOrdersCount: counts?.historicalOrdersCount ?? null,
    };
  });

  return {
    customers,
    totalCount,
    currentPage: safePage,
    totalPages,
    pageSize: PAGE_SIZE,
    statusCounts,
  };
}
