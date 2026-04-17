// lib/server/employee/loadEmployeeOwnLunchRecentHistory.ts
/** Egne ordre-rader — samme operative tabell som GET /api/order/window (user_id + company_id), ingen ny ordre-motor. */
import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { isUuid } from "@/lib/agreements/normalize";
import { formatDateNO, formatTimeNO } from "@/lib/date/format";
import { isIsoDate, osloTodayISODate } from "@/lib/date/oslo";
import type { EmployeeOwnLunchHistoryItem, EmployeeOwnLunchRecentHistoryPayload } from "@/lib/employee/employeeOwnLunchHistoryTypes";
import { mineLunsjOrderTitleNb } from "@/lib/employee/mineLunsjEndringerNb";
import { normKitchenSlot } from "@/lib/server/kitchen/loadOperativeKitchenOrders";
import { supabaseAdmin } from "@/lib/supabase/admin";

export type { EmployeeOwnLunchHistoryItem, EmployeeOwnLunchRecentHistoryPayload } from "@/lib/employee/employeeOwnLunchHistoryTypes";

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}

async function loadLocationNameMap(
  admin: SupabaseClient,
  companyId: string,
  list: Record<string, unknown>[],
): Promise<Map<string, string>> {
  const locIds = new Set<string>();
  for (const r of list) {
    const lid = safeStr((r as { location_id?: unknown }).location_id);
    if (lid && isUuid(lid)) locIds.add(lid);
  }

  const locName = new Map<string, string>();
  if (locIds.size === 0) return locName;

  const { data: locs, error: lErr } = await admin
    .from("company_locations")
    .select("id,name")
    .eq("company_id", companyId)
    .in("id", [...locIds]);

  if (!lErr && Array.isArray(locs)) {
    for (const row of locs as { id?: unknown; name?: unknown }[]) {
      const id = safeStr(row.id);
      if (id) locName.set(id, safeStr(row.name) || id);
    }
  }

  return locName;
}

async function mapRowsToItemsWithLocations(
  admin: SupabaseClient,
  companyId: string,
  rows: Record<string, unknown>[],
): Promise<EmployeeOwnLunchHistoryItem[]> {
  const locName = await loadLocationNameMap(admin, companyId, rows);
  return mapOrderRowsToHistoryItems(rows, locName);
}

function mapOrderRowsToHistoryItems(
  list: Record<string, unknown>[],
  locName: Map<string, string>,
): EmployeeOwnLunchHistoryItem[] {
  return list.map((raw: Record<string, unknown>) => {
    const id = safeStr(raw.id);
    const dateIso = safeStr(raw.date);
    const status = safeStr(raw.status).toUpperCase() || "—";
    const slot = normKitchenSlot(raw.slot);
    const updated = safeStr(raw.updated_at);
    const created = safeStr(raw.created_at);
    const sortAt = updated || created || "1970-01-01T00:00:00Z";
    const lid = safeStr(raw.location_id);
    const locLabel = lid ? locName.get(lid) ?? lid : null;

    const timeU = updated ? formatTimeNO(updated) : "—";
    const timeC = created ? formatTimeNO(created) : "—";
    const dateLabel = dateIso ? formatDateNO(dateIso) : "—";

    const parts = [
      `Leveringsdato: ${dateLabel}`,
      slot ? `Vindu: ${slot}` : null,
      locLabel ? `Lokasjon: ${locLabel}` : null,
      `Oppdatert: ${timeU}`,
      created && created !== updated ? `Opprettet: ${timeC}` : null,
      `Ordre-ID: ${id}`,
    ].filter(Boolean);

    return {
      sort_at: sortAt,
      title_nb: mineLunsjOrderTitleNb(status),
      body_nb: parts.join(" · "),
      delivery_date_iso: dateIso,
      slot_label_nb: slot || null,
      order_id: id,
      status_upper: status,
    };
  });
}

async function fetchEmployeeOrderRows(input: {
  admin: SupabaseClient;
  userId: string;
  companyId: string;
  locationId: string | null;
  variant: "recent_updates" | "past_delivery_dates" | "by_delivery_date";
  deliveryDateIso?: string;
}): Promise<{ rows: Record<string, unknown>[]; errorMessage: string | null }> {
  const { admin, userId, companyId, locationId, variant, deliveryDateIso } = input;

  let qb = admin
    .from("orders")
    .select("id,date,status,slot,created_at,updated_at,location_id,user_id,company_id")
    .eq("user_id", userId)
    .eq("company_id", companyId);

  if (locationId && isUuid(locationId)) {
    qb = qb.eq("location_id", locationId);
  }

  if (variant === "recent_updates") {
    qb = qb.order("updated_at", { ascending: false }).limit(36);
  } else if (variant === "past_delivery_dates") {
    const today = osloTodayISODate();
    qb = qb.lt("date", today).order("date", { ascending: false }).limit(90);
  } else {
    const d = safeStr(deliveryDateIso);
    if (!isIsoDate(d)) {
      return { rows: [], errorMessage: "invalid_date" };
    }
    qb = qb.eq("date", d).order("updated_at", { ascending: false }).limit(5);
  }

  const { data: rows, error } = await qb;

  if (error) {
    const m = safeStr(error.message);
    return { rows: [], errorMessage: m };
  }

  return { rows: Array.isArray(rows) ? (rows as Record<string, unknown>[]) : [], errorMessage: null };
}

export async function loadEmployeeOwnLunchRecentHistory(input: {
  userId: string;
  companyId: string;
  locationId: string | null;
}): Promise<EmployeeOwnLunchRecentHistoryPayload> {
  const userId = safeStr(input.userId);
  const companyId = safeStr(input.companyId);
  const locationId = input.locationId ? safeStr(input.locationId) : null;

  if (!isUuid(userId) || !isUuid(companyId)) {
    return { ok: true, items: [], warning_nb: "Mangler gyldig bruker- eller firmascope." };
  }

  let admin: SupabaseClient;
  try {
    admin = supabaseAdmin() as unknown as SupabaseClient;
  } catch {
    return { ok: true, items: [], warning_nb: "Kunne ikke lese ordrehistorikk (service role mangler)." };
  }

  const { rows, errorMessage } = await fetchEmployeeOrderRows({
    admin,
    userId,
    companyId,
    locationId,
    variant: "recent_updates",
  });

  if (errorMessage) {
    console.warn("[loadEmployeeOwnLunchRecentHistory] orders", errorMessage);
    return { ok: true, items: [], warning_nb: "Kunne ikke lese ordrehistorikk akkurat nå." };
  }

  const items = await mapRowsToItemsWithLocations(admin, companyId, rows);

  return { ok: true, items, warning_nb: null };
}

/** Tidligere leveringsdatoer (strikt før dagens Oslo-dato), nyeste først — samme scoping som «Mine lunsjendringer». */
export async function loadEmployeePastLunchDayHistory(input: {
  userId: string;
  companyId: string;
  locationId: string | null;
}): Promise<EmployeeOwnLunchRecentHistoryPayload> {
  const userId = safeStr(input.userId);
  const companyId = safeStr(input.companyId);
  const locationId = input.locationId ? safeStr(input.locationId) : null;

  if (!isUuid(userId) || !isUuid(companyId)) {
    return { ok: true, items: [], warning_nb: "Mangler gyldig bruker- eller firmascope." };
  }

  let admin: SupabaseClient;
  try {
    admin = supabaseAdmin() as unknown as SupabaseClient;
  } catch {
    return { ok: true, items: [], warning_nb: "Kunne ikke lese ordrehistorikk (service role mangler)." };
  }

  const { rows, errorMessage } = await fetchEmployeeOrderRows({
    admin,
    userId,
    companyId,
    locationId,
    variant: "past_delivery_dates",
  });

  if (errorMessage) {
    console.warn("[loadEmployeePastLunchDayHistory] orders", errorMessage);
    return { ok: true, items: [], warning_nb: "Kunne ikke lese ordrehistorikk akkurat nå." };
  }

  const items = await mapRowsToItemsWithLocations(admin, companyId, rows);

  return { ok: true, items, warning_nb: null };
}

/**
 * Alle egne ordrelinjer for én leveringsdato (0–få rader), samme operative `orders`-filter som øvrig employee-historikk.
 * `deliveryDateIso` må være gyldig YYYY-MM-DD (kall med `isIsoDate` først).
 */
export async function loadEmployeeOwnOrdersForDeliveryDate(input: {
  userId: string;
  companyId: string;
  locationId: string | null;
  deliveryDateIso: string;
}): Promise<EmployeeOwnLunchRecentHistoryPayload> {
  const userId = safeStr(input.userId);
  const companyId = safeStr(input.companyId);
  const locationId = input.locationId ? safeStr(input.locationId) : null;
  const deliveryDateIso = safeStr(input.deliveryDateIso);

  if (!isUuid(userId) || !isUuid(companyId)) {
    return { ok: true, items: [], warning_nb: "Mangler gyldig bruker- eller firmascope." };
  }

  if (!isIsoDate(deliveryDateIso)) {
    return { ok: true, items: [], warning_nb: "Ugyldig dato." };
  }

  let admin: SupabaseClient;
  try {
    admin = supabaseAdmin() as unknown as SupabaseClient;
  } catch {
    return { ok: true, items: [], warning_nb: "Kunne ikke lese ordrehistorikk (service role mangler)." };
  }

  const { rows, errorMessage } = await fetchEmployeeOrderRows({
    admin,
    userId,
    companyId,
    locationId,
    variant: "by_delivery_date",
    deliveryDateIso,
  });

  if (errorMessage === "invalid_date") {
    return { ok: true, items: [], warning_nb: "Ugyldig dato." };
  }

  if (errorMessage) {
    console.warn("[loadEmployeeOwnOrdersForDeliveryDate] orders", errorMessage);
    return { ok: true, items: [], warning_nb: "Kunne ikke lese ordrehistorikk akkurat nå." };
  }

  const items = await mapRowsToItemsWithLocations(admin, companyId, rows);

  return { ok: true, items, warning_nb: null };
}
