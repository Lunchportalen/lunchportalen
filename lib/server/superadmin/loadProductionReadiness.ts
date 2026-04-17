// lib/server/superadmin/loadProductionReadiness.ts
/** Superadmin/drift: én dag, samme operative filter som GET /api/kitchen (orders + day_choices), pluss outbox-nøkkel som i lp_orders_outbox_trigger. */
import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabase/admin";
import { loadOperativeKitchenOrders, normKitchenSlot } from "@/lib/server/kitchen/loadOperativeKitchenOrders";

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}

function isISODate(d: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(d);
}

/** Samme coalesce som i migrasjon lp_orders_outbox_trigger: kun NULL → unknown. */
export function buildOrderSetOutboxEventKey(userId: string, dateISO: string, slot: string | null | undefined): string {
  const slotPart = slot == null ? "unknown" : String(slot);
  return `order:set:${userId}:${dateISO}:${slotPart}`;
}

function isWeekendOslo(dateISO: string) {
  const d = new Date(`${dateISO}T12:00:00+01:00`);
  const dow = d.getDay();
  return dow === 0 || dow === 6;
}

export type ProductionReadinessLevel =
  | "NOT_DELIVERY_DAY"
  | "ERROR"
  | "BLOCKED_GLOBAL_CLOSED"
  | "READY"
  | "READY_WITH_WARNINGS";

export type ProductionReadinessPayload = {
  date: string;
  level: ProductionReadinessLevel;
  headline: string;
  detail: string;
  operative_orders: number;
  operative_companies: number;
  operative_locations: number;
  orders_active_raw: number;
  slot_counts: Record<string, number>;
  anomalies: {
    orders_missing_scope: number;
    ghost_active_orders_with_cancelled_day_choice: number;
    operative_orders_missing_outbox: number;
    outbox_order_set_without_active_order: number;
  };
  global_closed_reason: string | null;
  links: {
    operations: string;
    outbox: string;
    kitchen_api: string;
  };
};

function emptyPayload(date: string, level: ProductionReadinessLevel, headline: string, detail: string): ProductionReadinessPayload {
  return {
    date,
    level,
    headline,
    detail,
    operative_orders: 0,
    operative_companies: 0,
    operative_locations: 0,
    orders_active_raw: 0,
    slot_counts: {},
    anomalies: {
      orders_missing_scope: 0,
      ghost_active_orders_with_cancelled_day_choice: 0,
      operative_orders_missing_outbox: 0,
      outbox_order_set_without_active_order: 0,
    },
    global_closed_reason: null,
    links: {
      operations: "/superadmin/operations",
      outbox: "/superadmin/outbox",
      kitchen_api: `/api/kitchen?date=${encodeURIComponent(date)}`,
    },
  };
}

export async function loadProductionReadiness(dateISO: string): Promise<ProductionReadinessPayload> {
  const date = safeStr(dateISO);
  if (!isISODate(date)) {
    return emptyPayload(date || "invalid", "ERROR", "Ugyldig dato", "Bruk YYYY-MM-DD.");
  }

  if (isWeekendOslo(date)) {
    return {
      ...emptyPayload(date, "NOT_DELIVERY_DAY", "Ikke leveringsdag", "Helg — ingen mandag–fredag-produksjon forventes."),
      links: {
        operations: "/superadmin/operations",
        outbox: "/superadmin/outbox",
        kitchen_api: `/api/kitchen?date=${encodeURIComponent(date)}`,
      },
    };
  }

  let admin: SupabaseClient;
  try {
    admin = supabaseAdmin() as unknown as SupabaseClient;
  } catch {
    return emptyPayload(date, "ERROR", "Konfigurasjonsfeil", "Service role ikke tilgjengelig for lesing.");
  }

  const { data: closedRows, error: closedErr } = await admin
    .from("closed_dates")
    .select("reason")
    .eq("date", date)
    .eq("scope_type", "global")
    .is("scope_id", null)
    .limit(5);

  if (closedErr) {
    const msg = safeStr((closedErr as { message?: unknown }).message).toLowerCase();
    if (!msg.includes("does not exist") && !msg.includes("relation") && !msg.includes("schema cache")) {
      return emptyPayload(date, "ERROR", "Kunne ikke lese stengte datoer", safeStr((closedErr as { message?: unknown }).message));
    }
  } else if (Array.isArray(closedRows) && closedRows.length > 0) {
    const reason = safeStr((closedRows[0] as { reason?: unknown })?.reason) || "Global stengt dag";
    return {
      ...emptyPayload(date, "BLOCKED_GLOBAL_CLOSED", "Operasjon stengt (global)", reason),
      global_closed_reason: reason,
    };
  }

  const loaded = await loadOperativeKitchenOrders({ admin, dateISO: date, tenant: "system" });
  if (loaded.ok === false) {
    return emptyPayload(date, "ERROR", "Databasefeil ved ordre", loaded.dbError.message);
  }

  const { raw, list0, operative: list } = loaded;
  const orders_active_raw = raw.length;
  const orders_missing_scope = raw.length - list0.length;
  const ghost_active_orders_with_cancelled_day_choice = list0.length - list.length;

  const slot_counts: Record<string, number> = {};
  for (const r of list) {
    const s = normKitchenSlot(r.slot);
    slot_counts[s] = (slot_counts[s] ?? 0) + 1;
  }

  const companySet = new Set(list.map((r) => safeStr(r.company_id)));
  const locSet = new Set(list.map((r) => `${safeStr(r.company_id)}|${safeStr(r.location_id)}`));

  const eventKeys = list.map((r) => buildOrderSetOutboxEventKey(safeStr(r.user_id), date, r.slot));

  const obSet = new Set<string>();
  const chunk = 120;
  for (let i = 0; i < eventKeys.length; i += chunk) {
    const part = eventKeys.slice(i, i + chunk);
    if (!part.length) continue;
    const { data: obRows, error: obErr } = await admin.from("outbox").select("event_key").in("event_key", part);
    if (obErr) {
      return emptyPayload(date, "ERROR", "Databasefeil ved outbox", safeStr((obErr as { message?: unknown }).message));
    }
    for (const row of (obRows ?? []) as Array<{ event_key: string }>) {
      obSet.add(safeStr(row.event_key));
    }
  }

  let operative_orders_missing_outbox = 0;
  for (let i = 0; i < list.length; i++) {
    const k = eventKeys[i];
    if (!obSet.has(k)) operative_orders_missing_outbox += 1;
  }

  let outbox_order_set_without_active_order = 0;
  const likePattern = `order:set:%:${date}:%`;
  const { data: extraOb, error: exErr } = await admin.from("outbox").select("event_key").like("event_key", likePattern).limit(2500);

  if (exErr) {
    const msg = safeStr((exErr as { message?: unknown }).message).toLowerCase();
    if (!msg.includes("does not exist") && !msg.includes("relation") && !msg.includes("schema cache")) {
      return emptyPayload(date, "ERROR", "Databasefeil ved outbox (liste)", safeStr((exErr as { message?: unknown }).message));
    }
  } else {
    const operativeKeySet = new Set(eventKeys);
    const allActiveKeysFromList0 = new Set(list0.map((r) => buildOrderSetOutboxEventKey(safeStr(r.user_id), date, r.slot)));
    for (const row of (extraOb ?? []) as Array<{ event_key: string }>) {
      const ek = safeStr(row.event_key);
      if (!ek.startsWith("order:set:")) continue;
      if (operativeKeySet.has(ek)) continue;
      if (allActiveKeysFromList0.has(ek)) continue;
      outbox_order_set_without_active_order += 1;
    }
  }

  const anomalies = {
    orders_missing_scope,
    ghost_active_orders_with_cancelled_day_choice,
    operative_orders_missing_outbox,
    outbox_order_set_without_active_order,
  };

  const hasWarnings =
    orders_missing_scope > 0 ||
    ghost_active_orders_with_cancelled_day_choice > 0 ||
    operative_orders_missing_outbox > 0 ||
    outbox_order_set_without_active_order > 0;

  const level: ProductionReadinessLevel = hasWarnings ? "READY_WITH_WARNINGS" : "READY";
  const headline =
    level === "READY"
      ? "Produksjon klar"
      : "Produksjon klar med avvik";
  const detail = hasWarnings
    ? "Det finnes operative avvik — se tall under. Kjøkkenlisten filtrerer kansellerte dagvalg; outbox følger ordre-trigger."
    : "Ingen registrerte avvik mot dagens modell (ordre + day_choices + outbox for operative rader).";

  return {
    date,
    level,
    headline,
    detail,
    operative_orders: list.length,
    operative_companies: companySet.size,
    operative_locations: locSet.size,
    orders_active_raw,
    slot_counts,
    anomalies,
    global_closed_reason: null,
    links: {
      operations: "/superadmin/operations",
      outbox: "/superadmin/outbox",
      kitchen_api: `/api/kitchen?date=${encodeURIComponent(date)}`,
    },
  };
}
