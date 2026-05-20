// lib/providers/loadKitchenOrders.ts
import "server-only";

import { addDaysISO, osloTodayISODate, startOfWeekISO } from "@/lib/date/oslo";
import { supabaseServer } from "@/lib/supabase/server";

import { normalizeKitchenOrderStatus, type KitchenOrderStatus } from "@/lib/providers/kitchenOrderStatus";

export type KitchenOrderItem = {
  productName: string;
  quantity: number;
};

export type KitchenOrderRow = {
  id: string;
  date: string;
  slot: string | null;
  status: KitchenOrderStatus;
  note: string | null;
  companyId: string;
  companyName: string;
  locationId: string | null;
  items: KitchenOrderItem[];
};

export type KitchenOrdersBundle = {
  dateFrom: string;
  dateTo: string;
  orders: KitchenOrderRow[];
  companies: Array<{ id: string; name: string }>;
};

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}

function parseDateRange(mode: string, anchor: string) {
  const today = anchor || osloTodayISODate();
  if (mode === "tomorrow") {
    const d = addDaysISO(today, 1);
    return { from: d, toExclusive: addDaysISO(d, 1), displayTo: d };
  }
  if (mode === "week") {
    const from = startOfWeekISO(today);
    return { from, toExclusive: addDaysISO(from, 7), displayTo: addDaysISO(from, 6) };
  }
  return { from: today, toExclusive: addDaysISO(today, 1), displayTo: today };
}

/**
 * Provider-scoped kitchen orders for a date window.
 */
export async function loadKitchenOrders(
  providerId: string,
  opts?: {
    dateMode?: "today" | "tomorrow" | "week";
    statusFilter?: string | null;
    companyId?: string | null;
  },
): Promise<KitchenOrdersBundle> {
  const pid = safeStr(providerId);
  const { from, toExclusive, displayTo } = parseDateRange(opts?.dateMode ?? "today", osloTodayISODate());
  if (!pid) return { dateFrom: from, dateTo: displayTo, orders: [], companies: [] };

  const sb = await supabaseServer();
  let q = sb
    .from("orders")
    .select("id, date, slot, status, note, company_id, location_id")
    .eq("provider_id", pid)
    .gte("date", from)
    .lt("date", toExclusive)
    .order("date", { ascending: true })
    .order("slot", { ascending: true });

  const statusFilter = safeStr(opts?.statusFilter).toUpperCase();
  if (statusFilter) q = q.eq("status", statusFilter);

  const companyFilter = safeStr(opts?.companyId);
  if (companyFilter) q = q.eq("company_id", companyFilter);

  const { data: orderRows, error } = await q;
  if (error || !Array.isArray(orderRows)) {
    return { dateFrom: from, dateTo: displayTo, orders: [], companies: [] };
  }

  const companyIds = [...new Set(orderRows.map((r) => safeStr((r as { company_id?: string }).company_id)).filter(Boolean))];
  const companyNames = new Map<string, string>();

  if (companyIds.length) {
    const { data: companies } = await sb.from("companies").select("id, name").in("id", companyIds);
    for (const c of Array.isArray(companies) ? companies : []) {
      const id = safeStr((c as { id?: string }).id);
      if (id) companyNames.set(id, safeStr((c as { name?: string }).name) || id);
    }
  }

  const orderIds = orderRows.map((r) => safeStr((r as { id?: string }).id)).filter(Boolean);
  const itemsByOrder = new Map<string, KitchenOrderItem[]>();

  if (orderIds.length) {
    const { data: items } = await (sb as unknown as {
      from: (table: string) => {
        select: (cols: string) => { in: (col: string, ids: string[]) => Promise<{ data: unknown[] | null }> };
      };
    })
      .from("order_items")
      .select("order_id, product_name_snapshot, quantity")
      .in("order_id", orderIds);

    for (const row of Array.isArray(items) ? items : []) {
      const oid = safeStr((row as { order_id?: string }).order_id);
      if (!oid) continue;
      const list = itemsByOrder.get(oid) ?? [];
      list.push({
        productName: safeStr((row as { product_name_snapshot?: string }).product_name_snapshot) || "Retten",
        quantity: Number((row as { quantity?: number }).quantity) || 1,
      });
      itemsByOrder.set(oid, list);
    }
  }

  const orders: KitchenOrderRow[] = orderRows.map((row) => {
    const r = row as Record<string, unknown>;
    const id = safeStr(r.id);
    const companyId = safeStr(r.company_id);
    return {
      id,
      date: safeStr(r.date),
      slot: r.slot != null ? safeStr(r.slot) : null,
      status: normalizeKitchenOrderStatus(r.status),
      note: r.note != null ? String(r.note) : null,
      companyId,
      companyName: companyNames.get(companyId) ?? companyId,
      locationId: r.location_id != null ? safeStr(r.location_id) : null,
      items: itemsByOrder.get(id) ?? [],
    };
  });

  const companies = companyIds.map((id) => ({ id, name: companyNames.get(id) ?? id })).sort((a, b) => a.name.localeCompare(b.name, "nb"));

  return { dateFrom: from, dateTo: displayTo, orders, companies };
}
