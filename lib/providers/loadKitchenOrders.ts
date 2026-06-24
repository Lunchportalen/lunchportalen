import "server-only";

import { addDaysISO, osloTodayISODate } from "@/lib/date/oslo";
import { getCurrentWeekDates } from "@/lib/date/week";
import { buildVariantTitleLookup } from "@/lib/kitchen/kitchenMealNote";
import {
  buildKitchenOrderItemDisplay,
  dayChoiceKey,
  locationDisplayName,
  profileDisplayName,
  profileEmail,
} from "@/lib/providers/kitchenOrderDisplay";
import {
  buildAllowedDayChoiceKeys,
  fetchProviderOrderEnrichment,
} from "@/lib/providers/providerOrderEnrichment";
import { supabaseServer } from "@/lib/supabase/server";

import { normalizeKitchenOrderStatus, type KitchenOrderStatus } from "@/lib/providers/kitchenOrderStatus";
import { buildKitchenStatusCounts, type KitchenStatusCounts } from "@/lib/providers/providerOrdersSurface";

export type KitchenOrderItem = {
  productName: string;
  quantity: number;
  choiceLabel: string | null;
  variantTitle: string | null;
  displayLine: string | null;
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
  employeeDisplayName: string | null;
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

/**
 * Provider-scoped kitchen orders for a date window.
 * Step 1: provider session reads orders (RLS provider_id scope).
 * Step 2: service-role enrichment only for those order IDs.
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

  const scopedOrderIds = orderRows.map((r) => safeStr((r as { id?: string }).id)).filter(Boolean);
  const userIds = [...new Set(orderRows.map((r) => safeStr((r as { user_id?: string }).user_id)).filter(Boolean))];
  const locationIds = [
    ...new Set(orderRows.map((r) => safeStr((r as { location_id?: string }).location_id)).filter(Boolean)),
  ];

  const { profileById, locationById, dayChoiceMap, itemsByOrder } = await fetchProviderOrderEnrichment({
    scopedOrderIds,
    userIds,
    locationIds,
    allowedDayChoiceKeys: buildAllowedDayChoiceKeys(orderRows),
    dateFrom: from,
    dateToExclusive: toExclusive,
  });

  let variantLookup = new Map<string, string>();
  try {
    variantLookup = await buildVariantTitleLookup();
  } catch {
    /* CMS enrichment optional */
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
