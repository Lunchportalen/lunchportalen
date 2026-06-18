// lib/providers/providerCustomerCounts.ts
// Shared provider-scoped customer counts (list + detail must match).

import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";

export type ProviderCustomerCounts = {
  employeesCount: number | null;
  ordersThisWeek: number | null;
  historicalOrdersCount: number | null;
};

export type ProviderCustomerCountsResult = {
  byCompanyId: Map<string, ProviderCustomerCounts>;
  employeesQueryFailed: boolean;
  ordersQueryFailed: boolean;
};

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}

function emptyCounts(companyIds: string[]): ProviderCustomerCountsResult {
  const byCompanyId = new Map<string, ProviderCustomerCounts>();
  for (const id of companyIds) {
    byCompanyId.set(id, {
      employeesCount: null,
      ordersThisWeek: null,
      historicalOrdersCount: null,
    });
  }
  return { byCompanyId, employeesQueryFailed: true, ordersQueryFailed: true };
}

/**
 * Provider-scoped employee + order counts via service role.
 * Matches detail employee loader semantics (active profiles, disabled_at is null).
 */
export async function loadProviderCustomerCountsForCompanies(
  providerId: string,
  companyIds: string[],
  weekStart: string,
  weekEnd: string,
): Promise<ProviderCustomerCountsResult> {
  const pid = safeStr(providerId);
  const ids = companyIds.map((id) => safeStr(id)).filter(Boolean);
  if (!pid || ids.length === 0) return emptyCounts(ids);

  const byCompanyId = new Map<string, ProviderCustomerCounts>();
  for (const id of ids) {
    byCompanyId.set(id, {
      employeesCount: null,
      ordersThisWeek: null,
      historicalOrdersCount: null,
    });
  }

  let employeesQueryFailed = false;
  let ordersQueryFailed = false;

  try {
    const admin = supabaseAdmin();
    const { data: profs, error: profErr } = await admin
      .from("profiles")
      .select("company_id")
      .in("company_id", ids)
      .is("disabled_at", null);

    if (profErr || !Array.isArray(profs)) {
      employeesQueryFailed = true;
    } else {
      for (const row of profs) {
        const cid = safeStr((row as { company_id?: string }).company_id);
        if (!cid || !byCompanyId.has(cid)) continue;
        const current = byCompanyId.get(cid)!;
        byCompanyId.set(cid, {
          ...current,
          employeesCount: (current.employeesCount ?? 0) + 1,
        });
      }
      for (const [cid, counts] of byCompanyId) {
        if (counts.employeesCount === null) {
          byCompanyId.set(cid, { ...counts, employeesCount: 0 });
        }
      }
    }

    const [{ data: weekOrders, error: weekErr }, { data: allOrders, error: allErr }] = await Promise.all([
      admin
        .from("orders")
        .select("company_id")
        .eq("provider_id", pid)
        .in("company_id", ids)
        .gte("date", weekStart)
        .lt("date", weekEnd),
      admin.from("orders").select("company_id").eq("provider_id", pid).in("company_id", ids),
    ]);

    if (weekErr || !Array.isArray(weekOrders)) {
      ordersQueryFailed = true;
    } else {
      for (const row of weekOrders) {
        const cid = safeStr((row as { company_id?: string }).company_id);
        if (!cid || !byCompanyId.has(cid)) continue;
        const current = byCompanyId.get(cid)!;
        byCompanyId.set(cid, {
          ...current,
          ordersThisWeek: (current.ordersThisWeek ?? 0) + 1,
        });
      }
      for (const [cid, counts] of byCompanyId) {
        if (counts.ordersThisWeek === null) {
          byCompanyId.set(cid, { ...counts, ordersThisWeek: 0 });
        }
      }
    }

    if (allErr || !Array.isArray(allOrders)) {
      ordersQueryFailed = true;
    } else {
      for (const row of allOrders) {
        const cid = safeStr((row as { company_id?: string }).company_id);
        if (!cid || !byCompanyId.has(cid)) continue;
        const current = byCompanyId.get(cid)!;
        byCompanyId.set(cid, {
          ...current,
          historicalOrdersCount: (current.historicalOrdersCount ?? 0) + 1,
        });
      }
      for (const [cid, counts] of byCompanyId) {
        if (counts.historicalOrdersCount === null) {
          byCompanyId.set(cid, { ...counts, historicalOrdersCount: 0 });
        }
      }
    }
  } catch {
    return emptyCounts(ids);
  }

  if (employeesQueryFailed) {
    for (const [cid, counts] of byCompanyId) {
      byCompanyId.set(cid, { ...counts, employeesCount: null });
    }
  }
  if (ordersQueryFailed) {
    for (const [cid, counts] of byCompanyId) {
      byCompanyId.set(cid, { ...counts, ordersThisWeek: null, historicalOrdersCount: null });
    }
  }

  return { byCompanyId, employeesQueryFailed, ordersQueryFailed };
}
