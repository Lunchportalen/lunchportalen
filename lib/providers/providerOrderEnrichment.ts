import "server-only";

import {
  dayChoiceKey,
  parseAllergensSnapshot,
  type KitchenOrderChoiceContext,
} from "@/lib/providers/kitchenOrderDisplay";
import { supabaseAdmin } from "@/lib/supabase/admin";

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

type RawOrderItem = {
  productNameSnapshot: string | null;
  quantity: number;
  allergens: string[];
};

export type ProviderOrderEnrichmentBundle = {
  profileById: Map<string, { full_name?: string | null; email?: string | null }>;
  locationById: Map<string, { name?: string | null }>;
  dayChoiceMap: Map<string, { choice: KitchenOrderChoiceContext; updatedAt: number }>;
  itemsByOrder: Map<string, RawOrderItem[]>;
};

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}

export function scopedOrderIdSet(orderIds: readonly string[]): Set<string> {
  return new Set(orderIds.map((id) => safeStr(id)).filter(Boolean));
}

/** Drop enrichment rows whose order_id was not in the provider-scoped base query. */
export function ingestScopedOrderItemRow(
  itemsByOrder: Map<string, RawOrderItem[]>,
  scopedOrderIds: Set<string>,
  row: { order_id?: unknown; product_name_snapshot?: unknown; quantity?: unknown; allergens_snapshot?: unknown },
): void {
  const oid = safeStr(row.order_id);
  if (!oid || !scopedOrderIds.has(oid)) return;
  const list = itemsByOrder.get(oid) ?? [];
  list.push({
    productNameSnapshot: safeStr(row.product_name_snapshot) || null,
    quantity: Number(row.quantity) || 1,
    allergens: parseAllergensSnapshot(row.allergens_snapshot),
  });
  itemsByOrder.set(oid, list);
}

/** Keep only day_choices that match a provider-scoped order scope key. */
export function ingestScopedDayChoiceRow(
  dayChoiceMap: Map<string, { choice: KitchenOrderChoiceContext; updatedAt: number }>,
  allowedDayChoiceKeys: ReadonlySet<string>,
  row: DayChoiceRow,
): void {
  const key = dayChoiceKey({
    companyId: safeStr(row.company_id),
    locationId: row.location_id != null ? safeStr(row.location_id) : null,
    userId: safeStr(row.user_id),
    date: safeStr(row.date),
  });
  if (!allowedDayChoiceKeys.has(key)) return;
  const nextT = row.updated_at ? new Date(row.updated_at).getTime() : 0;
  const prev = dayChoiceMap.get(key);
  if (prev && prev.updatedAt > nextT) return;
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

export function buildAllowedDayChoiceKeys(
  orderRows: ReadonlyArray<{
    company_id?: unknown;
    location_id?: unknown;
    user_id?: unknown;
    date?: unknown;
  }>,
): Set<string> {
  const keys = new Set<string>();
  for (const row of orderRows) {
    keys.add(
      dayChoiceKey({
        companyId: safeStr(row.company_id),
        locationId: row.location_id != null ? safeStr(row.location_id) : null,
        userId: safeStr(row.user_id),
        date: safeStr(row.date),
      }),
    );
  }
  return keys;
}

const EMPTY_ENRICHMENT: ProviderOrderEnrichmentBundle = {
  profileById: new Map(),
  locationById: new Map(),
  dayChoiceMap: new Map(),
  itemsByOrder: new Map(),
};

/**
 * Step 2 enrichment: service-role reads scoped strictly to provider-approved order IDs.
 * Caller must pass order IDs from a provider_id-filtered base query only.
 */
export async function fetchProviderOrderEnrichment(input: {
  scopedOrderIds: readonly string[];
  userIds: readonly string[];
  locationIds: readonly string[];
  allowedDayChoiceKeys: ReadonlySet<string>;
  dateFrom: string;
  dateToExclusive: string;
}): Promise<ProviderOrderEnrichmentBundle> {
  const scopedOrderIds = scopedOrderIdSet(input.scopedOrderIds);
  if (scopedOrderIds.size === 0) return { ...EMPTY_ENRICHMENT };

  const userIds = [...new Set(input.userIds.map((id) => safeStr(id)).filter(Boolean))];
  const locationIds = [...new Set(input.locationIds.map((id) => safeStr(id)).filter(Boolean))];
  const orderIds = [...scopedOrderIds];

  const admin = supabaseAdmin();

  const profileById = new Map<string, { full_name?: string | null; email?: string | null }>();
  const locationById = new Map<string, { name?: string | null }>();
  const dayChoiceMap = new Map<string, { choice: KitchenOrderChoiceContext; updatedAt: number }>();
  const itemsByOrder = new Map<string, RawOrderItem[]>();

  const tasks: Promise<void>[] = [];

  if (userIds.length) {
    tasks.push(
      (async () => {
        const { data: profiles } = await admin.from("profiles").select("id, email, full_name").in("id", userIds);
        for (const row of Array.isArray(profiles) ? profiles : []) {
          const id = safeStr((row as { id?: string }).id);
          if (!id) continue;
          profileById.set(id, {
            full_name: (row as { full_name?: string | null }).full_name ?? null,
            email: (row as { email?: string | null }).email ?? null,
          });
        }
      })(),
    );
  }

  if (locationIds.length) {
    tasks.push(
      (async () => {
        const { data: locations } = await admin.from("company_locations").select("id, name").in("id", locationIds);
        for (const row of Array.isArray(locations) ? locations : []) {
          const id = safeStr((row as { id?: string }).id);
          if (!id) continue;
          locationById.set(id, { name: (row as { name?: string | null }).name ?? null });
        }
      })(),
    );
  }

  if (userIds.length) {
    tasks.push(
      (async () => {
        const { data: dayChoices } = await admin
          .from("day_choices")
          .select("company_id, location_id, user_id, date, choice_key, item_key, item_title_snapshot, note, updated_at")
          .in("user_id", userIds)
          .gte("date", input.dateFrom)
          .lt("date", input.dateToExclusive);

        for (const row of Array.isArray(dayChoices) ? (dayChoices as DayChoiceRow[]) : []) {
          ingestScopedDayChoiceRow(dayChoiceMap, input.allowedDayChoiceKeys, row);
        }
      })(),
    );
  }

  if (orderIds.length) {
    tasks.push(
      (async () => {
        const { data: items } = await (admin as unknown as {
          from: (table: string) => {
            select: (cols: string) => { in: (col: string, ids: string[]) => Promise<{ data: unknown[] | null }> };
          };
        })
          .from("order_items")
          .select("order_id, product_name_snapshot, quantity, allergens_snapshot")
          .in("order_id", orderIds);

        for (const row of Array.isArray(items) ? items : []) {
          ingestScopedOrderItemRow(itemsByOrder, scopedOrderIds, row as Record<string, unknown>);
        }
      })(),
    );
  }

  await Promise.all(tasks);

  return { profileById, locationById, dayChoiceMap, itemsByOrder };
}

export type { RawOrderItem };
