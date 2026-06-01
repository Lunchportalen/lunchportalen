import { expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

import { foldOrdersByDate } from "@/lib/orders/pickCanonicalOrderPerDate";
import { loadOperativeKitchenOrders } from "@/lib/server/kitchen/loadOperativeKitchenOrders";

export type LifecycleDbOrder = {
  id: string;
  status: string;
  updated_at: string | null;
  slot: string | null;
  date: string;
};

export type LifecycleDbDayChoice = {
  status: string | null;
  choice_key: string | null;
  item_key: string | null;
  updated_at: string | null;
};

export type LifecycleDbOrderItem = {
  order_id: string;
  product_id: string;
};

export type LifecycleSnapshot = {
  orders: LifecycleDbOrder[];
  dayChoices: LifecycleDbDayChoice[];
  orderItems: LifecycleDbOrderItem[];
  window: {
    orderStatus: string | null;
    wantsLunch: boolean;
    selectedChoiceKey: string | null;
    selectedItemKey: string | null;
  };
  kitchenOrderIds: string[];
  kitchenVariantKey: string | null;
};

export type LastOpKind = "SET" | "CANCEL" | null;

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}

function statusNorm(raw: unknown): string {
  const s = safeStr(raw).toUpperCase();
  if (s === "ACTIVE" || s === "ORDERED") return "ACTIVE";
  if (s === "CANCELLED" || s === "CANCELED") return "CANCELLED";
  return s || "UNKNOWN";
}

/** Naive last-wins (pre-#74 window bug) for prove-fire. */
export function deriveWindowFieldsNaive(
  orders: LifecycleDbOrder[],
  dayChoice: LifecycleDbDayChoice | null,
): LifecycleSnapshot["window"] {
  const last = orders.length ? orders[orders.length - 1] : null;
  const sNorm = statusNorm(last?.status);
  const wantsLunch = sNorm === "ACTIVE";
  const dcChoice = dayChoice?.choice_key ? safeStr(dayChoice.choice_key).toLowerCase() : null;
  return {
    orderStatus: sNorm === "ACTIVE" ? "ACTIVE" : sNorm === "CANCELLED" ? "CANCELLED" : null,
    wantsLunch,
    selectedChoiceKey: wantsLunch && dcChoice ? dcChoice : null,
    selectedItemKey:
      wantsLunch && dayChoice?.item_key != null && safeStr(dayChoice.item_key)
        ? safeStr(dayChoice.item_key)
        : null,
  };
}

export function deriveWindowFieldsCanonical(
  orders: LifecycleDbOrder[],
  dayChoice: LifecycleDbDayChoice | null,
  dateISO: string,
): LifecycleSnapshot["window"] {
  const byDate = foldOrdersByDate(orders, (o) => safeStr(o.date) || null);
  const saved = byDate.get(dateISO) ?? null;
  const sNorm = statusNorm(saved?.status);
  const wantsLunch = sNorm === "ACTIVE";
  const dcChoice = dayChoice?.choice_key ? safeStr(dayChoice.choice_key).toLowerCase() : null;
  return {
    orderStatus: sNorm === "ACTIVE" ? "ACTIVE" : sNorm === "CANCELLED" ? "CANCELLED" : null,
    wantsLunch,
    selectedChoiceKey: wantsLunch && dcChoice ? dcChoice : null,
    selectedItemKey:
      wantsLunch && dayChoice?.item_key != null && safeStr(dayChoice.item_key)
        ? safeStr(dayChoice.item_key)
        : null,
  };
}

export async function loadLifecycleSnapshot(input: {
  admin: SupabaseClient;
  userId: string;
  companyId: string;
  locationId: string;
  dateISO: string;
  slot?: string;
  useCanonicalFold: boolean;
  includeKitchen?: boolean;
}): Promise<LifecycleSnapshot> {
  const { admin, userId, companyId, locationId, dateISO } = input;
  const slot = safeStr(input.slot) || "default";

  const { data: ordersRaw } = await admin
    .from("orders")
    .select("id,status,updated_at,slot,date")
    .eq("user_id", userId)
    .eq("company_id", companyId)
    .eq("location_id", locationId)
    .eq("date", dateISO)
    .eq("slot", slot)
    .order("updated_at", { ascending: true });

  const orders = (ordersRaw ?? []) as LifecycleDbOrder[];

  const { data: dcRaw } = await admin
    .from("day_choices")
    .select("status,choice_key,item_key,updated_at")
    .eq("user_id", userId)
    .eq("company_id", companyId)
    .eq("location_id", locationId)
    .eq("date", dateISO)
    .order("updated_at", { ascending: false })
    .limit(1);

  const dayChoice = ((dcRaw ?? [])[0] as LifecycleDbDayChoice | undefined) ?? null;

  const activeIds = orders.filter((o) => statusNorm(o.status) === "ACTIVE").map((o) => o.id);
  let orderItems: LifecycleDbOrderItem[] = [];
  if (activeIds.length) {
    const { data: oiRaw } = await admin
      .from("order_items")
      .select("order_id,product_id")
      .in("order_id", activeIds);
    orderItems = (oiRaw ?? []) as LifecycleDbOrderItem[];
  }

  const window = input.useCanonicalFold
    ? deriveWindowFieldsCanonical(orders, dayChoice, dateISO)
    : deriveWindowFieldsNaive(orders, dayChoice);

  let kitchenOrderIds: string[] = [];
  let kitchenVariantKey: string | null = null;
  if (input.includeKitchen !== false) {
    const kitchen = await loadOperativeKitchenOrders({
      admin,
      dateISO,
      tenant: { companyId, locationId },
    });
    if (kitchen.ok) {
      kitchenOrderIds = kitchen.operative
        .filter((r) => safeStr(r.user_id) === userId)
        .map((r) => r.id);
      const dc = kitchen.dcMap.get(`${companyId}|${locationId}|${userId}`);
      kitchenVariantKey = dc?.item_key ?? null;
    }
  }

  return { orders, dayChoices: dayChoice ? [dayChoice] : [], orderItems, window, kitchenOrderIds, kitchenVariantKey };
}

export function assertLifecycleInvariants(
  snap: LifecycleSnapshot,
  lastOp: LastOpKind,
  expected: { choiceKey?: string; itemKey?: string | null; productId?: string },
): void {
  const active = snap.orders.filter((o) => statusNorm(o.status) === "ACTIVE");
  expect(active.length).toBeLessThanOrEqual(1);

  const dc = snap.dayChoices[0] ?? null;

  if (lastOp === "CANCEL") {
    expect(active.length).toBe(0);
    expect(snap.dayChoices.length).toBe(0);
    expect(snap.orderItems.length).toBe(0);
    expect(snap.window.wantsLunch).toBe(false);
    expect(snap.window.orderStatus).not.toBe("ACTIVE");
    expect(snap.kitchenOrderIds.length).toBe(0);
    return;
  }

  if (lastOp === "SET") {
    expect(active.length).toBe(1);
    expect(dc).not.toBeNull();
    expect(statusNorm(dc?.status)).toBe("ACTIVE");
    if (expected.choiceKey) {
      expect(safeStr(dc?.choice_key).toLowerCase()).toBe(expected.choiceKey.toLowerCase());
    }
    if (expected.itemKey !== undefined) {
      const got = dc?.item_key == null ? null : safeStr(dc.item_key);
      expect(got).toBe(expected.itemKey);
    }
    expect(snap.orderItems.length).toBe(1);
    if (expected.productId) {
      expect(snap.orderItems[0]?.product_id).toBe(expected.productId);
      expect(snap.orderItems[0]?.order_id).toBe(active[0]?.id);
    }
    expect(snap.window.wantsLunch).toBe(true);
    expect(snap.window.orderStatus).toBe("ACTIVE");
    if (expected.choiceKey) {
      expect(snap.window.selectedChoiceKey).toBe(expected.choiceKey.toLowerCase());
    }
    if (expected.itemKey !== undefined) {
      expect(snap.window.selectedItemKey).toBe(expected.itemKey);
    }
    if (snap.kitchenOrderIds.length > 0) {
      expect(snap.kitchenOrderIds).toEqual([active[0]!.id]);
      if (expected.itemKey !== undefined) {
        expect(snap.kitchenVariantKey).toBe(expected.itemKey);
      }
    }
    return;
  }
}
