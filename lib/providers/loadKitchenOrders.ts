// lib/providers/loadKitchenOrders.ts
import "server-only";

import { addDaysISO, osloTodayISODate } from "@/lib/date/oslo";
import { getCurrentWeekDates } from "@/lib/date/week";
import { buildVariantTitleLookup } from "@/lib/kitchen/kitchenMealNote";
import {
  buildKitchenOrderItemDisplay,
  dayChoiceKey,
  locationDisplayName,
  parseAllergensSnapshot,
  profileDisplayName,
  profileEmail,
  type KitchenOrderChoiceContext,
} from "@/lib/providers/kitchenOrderDisplay";
import { supabaseServer } from "@/lib/supabase/server";

import { normalizeKitchenOrderStatus, type KitchenOrderStatus } from "@/lib/providers/kitchenOrderStatus";
import { buildKitchenStatusCounts, type KitchenStatusCounts } from "@/lib/providers/providerOrdersSurface";

export type KitchenOrderItem = {
  productName: string;
  quantity: number;
  choiceLabel: string | null;
  variantTitle: string | null;
  displayLine: string;
  allergens: string[];
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
  locationName: string | null;
  employeeDisplayName: string;
  employeeEmail: string | null;
  items: KitchenOrderItem[];
};

export type KitchenOrdersBundle = {
  dateFrom: string;
  dateTo: string;
  orders: KitchenOrderRow[];
  companies: Array<{ id: string; name: string }>;
  /** Statuschip-tellinger for valgt periode (+ evt. bedriftsfilter), uavhengig av aktivt statusfilter. */
  statusCounts: KitchenStatusCounts;
};

const EMPTY_STATUS_COUNTS: KitchenStatusCounts = { "": 0, ACTIVE: 0, PREPARED: 0, DISPATCHED: 0, DELIVERED: 0 };

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
    const dates = getCurrentWeekDates(new Date(`${today}T12:00:00`));
    const from = dates[0] ?? today;
    const last = dates[dates.length - 1] ?? from;
    return { from, toExclusive: addDaysISO(last, 1), displayTo: last };
  }
  return { from: today, toExclusive: addDaysISO(today, 1), displayTo: today };
}

type DayChoiceRow = {
  company_id: string;
  location_id: string | null;
  user_id: string;
  date: string;
  choice_key: string;
  item_key?: string | null;
  item_title_snapshot?: string | null;
  note?: string | null;
  updated_at?: string | null;
};

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
  if (!pid) return { dateFrom: from, dateTo: displayTo, orders: [], companies: [], statusCounts: EMPTY_STATUS_COUNTS };

  const sb = await supabaseServer();
  let q = sb
    .from("orders")
    .select("id, date, slot, status, note, company_id, location_id, user_id")
    .eq("provider_id", pid)
    .gte("date", from)
    .lt("date", toExclusive)
    .order("date", { ascending: true })
    .order("slot", { ascending: true });

  const companyFilter = safeStr(opts?.companyId);
  if (companyFilter) q = q.eq("company_id", companyFilter);

  const { data: allRows, error } = await q;
  if (error || !Array.isArray(allRows)) {
    return { dateFrom: from, dateTo: displayTo, orders: [], companies: [], statusCounts: EMPTY_STATUS_COUNTS };
  }

  const statusCounts = buildKitchenStatusCounts(allRows.map((r) => safeStr((r as { status?: string }).status)));

  const statusFilter = safeStr(opts?.statusFilter).toUpperCase();
  const orderRows = statusFilter
    ? allRows.filter((r) => safeStr((r as { status?: string }).status).toUpperCase() === statusFilter)
    : allRows;

  const companyIds = [...new Set(allRows.map((r) => safeStr((r as { company_id?: string }).company_id)).filter(Boolean))];
  const companyNames = new Map<string, string>();

  if (companyIds.length) {
    const { data: companies } = await sb.from("companies").select("id, name").in("id", companyIds);
    for (const c of Array.isArray(companies) ? companies : []) {
      const id = safeStr((c as { id?: string }).id);
      if (id) companyNames.set(id, safeStr((c as { name?: string }).name) || id);
    }
  }

  const userIds = [...new Set(orderRows.map((r) => safeStr((r as { user_id?: string }).user_id)).filter(Boolean))];
  const profileById = new Map<string, { full_name?: string | null; email?: string | null }>();
  if (userIds.length) {
    const { data: profiles } = await sb.from("profiles").select("id, email, full_name").in("id", userIds);
    for (const row of Array.isArray(profiles) ? profiles : []) {
      const id = safeStr((row as { id?: string }).id);
      if (!id) continue;
      profileById.set(id, {
        full_name: (row as { full_name?: string | null }).full_name ?? null,
        email: (row as { email?: string | null }).email ?? null,
      });
    }
  }

  const locationIds = [
    ...new Set(orderRows.map((r) => safeStr((r as { location_id?: string }).location_id)).filter(Boolean)),
  ];
  const locationById = new Map<string, { name?: string | null }>();
  if (locationIds.length) {
    const { data: locations } = await sb.from("company_locations").select("id, name").in("id", locationIds);
    for (const row of Array.isArray(locations) ? locations : []) {
      const id = safeStr((row as { id?: string }).id);
      if (!id) continue;
      locationById.set(id, { name: (row as { name?: string | null }).name ?? null });
    }
  }

  const dayChoiceMap = new Map<string, { choice: KitchenOrderChoiceContext; updatedAt: number }>();
  if (userIds.length) {
    const { data: dayChoices } = await sb
      .from("day_choices")
      .select("company_id, location_id, user_id, date, choice_key, item_key, item_title_snapshot, note, updated_at")
      .in("user_id", userIds)
      .gte("date", from)
      .lt("date", toExclusive);

    for (const row of Array.isArray(dayChoices) ? (dayChoices as DayChoiceRow[]) : []) {
      const key = dayChoiceKey({
        companyId: safeStr(row.company_id),
        locationId: row.location_id != null ? safeStr(row.location_id) : null,
        userId: safeStr(row.user_id),
        date: safeStr(row.date),
      });
      const nextT = row.updated_at ? new Date(row.updated_at).getTime() : 0;
      const prev = dayChoiceMap.get(key);
      if (prev && prev.updatedAt > nextT) continue;
      dayChoiceMap.set(key, {
        updatedAt: nextT,
        choice: {
          choiceKey: row.choice_key,
          itemKey: row.item_key ?? null,
          itemTitleSnapshot: row.item_title_snapshot ?? null,
          note: row.note ?? null,
        },
      });
    }
  }

  let variantLookup = new Map<string, string>();
  try {
    variantLookup = await buildVariantTitleLookup();
  } catch {
    /* CMS enrichment optional */
  }

  const orderIds = orderRows.map((r) => safeStr((r as { id?: string }).id)).filter(Boolean);
  type RawOrderItem = { productNameSnapshot: string | null; quantity: number; allergens: string[] };
  const itemsByOrder = new Map<string, RawOrderItem[]>();

  if (orderIds.length) {
    const { data: items } = await (sb as unknown as {
      from: (table: string) => {
        select: (cols: string) => { in: (col: string, ids: string[]) => Promise<{ data: unknown[] | null }> };
      };
    })
      .from("order_items")
      .select("order_id, product_name_snapshot, quantity, allergens_snapshot")
      .in("order_id", orderIds);

    for (const row of Array.isArray(items) ? items : []) {
      const oid = safeStr((row as { order_id?: string }).order_id);
      if (!oid) continue;
      const list = itemsByOrder.get(oid) ?? [];
      list.push({
        productNameSnapshot: safeStr((row as { product_name_snapshot?: string }).product_name_snapshot) || null,
        quantity: Number((row as { quantity?: number }).quantity) || 1,
        allergens: parseAllergensSnapshot((row as { allergens_snapshot?: unknown }).allergens_snapshot),
      });
      itemsByOrder.set(oid, list);
    }
  }

  const orders: KitchenOrderRow[] = orderRows.map((row) => {
    const r = row as Record<string, unknown>;
    const id = safeStr(r.id);
    const companyId = safeStr(r.company_id);
    const locationId = r.location_id != null ? safeStr(r.location_id) : null;
    const userId = safeStr(r.user_id);
    const date = safeStr(r.date);
    const profile = userId ? profileById.get(userId) : null;
    const choiceKey = dayChoiceKey({ companyId, locationId, userId, date });
    const choiceCtx = dayChoiceMap.get(choiceKey)?.choice ?? null;

    const rawItems = itemsByOrder.get(id) ?? [];
    const items: KitchenOrderItem[] =
      rawItems.length > 0
        ? rawItems.map((raw) => {
            const display = buildKitchenOrderItemDisplay({
              productNameSnapshot: raw.productNameSnapshot,
              quantity: raw.quantity,
              choice: choiceCtx,
              variantLookup,
            });
            return { ...display, allergens: raw.allergens };
          })
        : choiceCtx
          ? [
              {
                ...buildKitchenOrderItemDisplay({
                  productNameSnapshot: null,
                  quantity: 1,
                  choice: choiceCtx,
                  variantLookup,
                }),
                allergens: [],
              },
            ]
          : [];

    return {
      id,
      date,
      slot: r.slot != null ? safeStr(r.slot) : null,
      status: normalizeKitchenOrderStatus(r.status),
      note: r.note != null ? String(r.note) : null,
      companyId,
      companyName: companyNames.get(companyId) ?? companyId,
      locationId,
      locationName: locationId ? locationDisplayName(locationById.get(locationId)) : null,
      employeeDisplayName: profileDisplayName(profile),
      employeeEmail: profileEmail(profile),
      items,
    };
  });

  const companies = companyIds.map((id) => ({ id, name: companyNames.get(id) ?? id })).sort((a, b) => a.name.localeCompare(b.name, "nb"));

  return { dateFrom: from, dateTo: displayTo, orders, companies, statusCounts };
}
