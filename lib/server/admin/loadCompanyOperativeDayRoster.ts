// lib/server/admin/loadCompanyOperativeDayRoster.ts
/** Read-only dagens operative ansatt-/bestillingsliste — samme ordrelesing som kjøkken + firmascopet profilnavn. */
import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { cutoffStatusForDate, osloTodayISODate } from "@/lib/date/oslo";
import { weekdayKeyFromOsloISODate } from "@/lib/date/weekdayKeyFromIso";
import {
  loadOperativeKitchenOrders,
  normKitchenSlot,
  type KitchenDayChoiceMapEntry,
  type OperativeKitchenOrderRow,
} from "@/lib/server/kitchen/loadOperativeKitchenOrders";
import { loadOperativeClosedDatesReasonsInRange } from "@/lib/orders/orderWriteGuard";
import { supabaseAdmin } from "@/lib/supabase/admin";

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}

function isUuid(v: unknown) {
  return (
    typeof v === "string" &&
    /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/i.test(v)
  );
}

export type CompanyOperativeDayRosterRow = {
  order_id: string;
  user_id: string;
  employee_display_name: string;
  location_id: string;
  location_label: string;
  slot_norm: string;
  order_status: string;
  order_note: string | null;
  day_choice_note: string | null;
};

export type CompanyOperativeDeliveryPerCell = {
  location_id: string;
  location_label: string;
  slot_norm: string;
  operative_orders: number;
  distinct_employees: number;
  rows_with_order_note: number;
  rows_with_day_choice_note: number;
};

export type CompanyOperativeDeliveryByLocation = {
  location_id: string;
  location_label: string;
  operative_orders: number;
  distinct_employees: number;
  slots_with_orders: number;
};

export type CompanyOperativeDeliveryBySlot = {
  slot_norm: string;
  operative_orders: number;
  distinct_employees: number;
  locations_with_orders: number;
};

export type CompanyOperativeDeliverySummary = {
  per_location_slot: CompanyOperativeDeliveryPerCell[];
  by_location: CompanyOperativeDeliveryByLocation[];
  by_slot: CompanyOperativeDeliveryBySlot[];
  totals: {
    operative_orders: number;
    locations_with_orders: number;
    slots_with_orders: number;
    distinct_employees: number;
  };
};

export type CompanyOperativeDayRosterPayload = {
  date_iso: string;
  company_id: string;
  load_ok: boolean;
  load_error_message: string | null;
  rows: CompanyOperativeDayRosterRow[];
  context_lines_nb: string[];
  /** Aggregert lokasjon × slot fra samme operative liste (ingen ekstra ordrelesing). */
  delivery_summary: CompanyOperativeDeliverySummary | null;
};

function displayNameFromProfile(p: { full_name?: unknown; email?: unknown } | null | undefined): string {
  const n = safeStr(p?.full_name);
  if (n) return n;
  const e = safeStr(p?.email);
  if (e) return e.split("@")[0] || e;
  return "Ansatt";
}

/** Deterministisk sortering: slot → lokasjon → navn → bruker-id. */
export function sortOperativeDayRosterRows(rows: CompanyOperativeDayRosterRow[]): CompanyOperativeDayRosterRow[] {
  return [...rows].sort((a, b) => {
    const s = a.slot_norm.localeCompare(b.slot_norm, "nb");
    if (s !== 0) return s;
    const l = a.location_label.localeCompare(b.location_label, "nb");
    if (l !== 0) return l;
    const n = a.employee_display_name.localeCompare(b.employee_display_name, "nb");
    if (n !== 0) return n;
    return a.user_id.localeCompare(b.user_id);
  });
}

function buildContextLinesNb(input: {
  date_iso: string;
  company_status_upper: string;
  operative_count: number;
  closed_reason: string | null;
  closed_lookup_ok: boolean;
  cutoff: ReturnType<typeof cutoffStatusForDate>;
  is_weekend: boolean;
}): string[] {
  const lines: string[] = [];
  const { date_iso, company_status_upper, operative_count, closed_reason, closed_lookup_ok, cutoff, is_weekend } =
    input;

  if (operative_count > 0) {
    lines.push(`${operative_count} operative rad(er) for ${date_iso} (ACTIVE + dagvalg ikke kansellert).`);
    return lines;
  }

  if (is_weekend) {
    lines.push("Helg — ingen mandag–fredag-leveranser i operativ modell.");
  }
  if (company_status_upper !== "ACTIVE") {
    if (company_status_upper === "PAUSED") lines.push("Firma er satt på pause (companies.status).");
    else if (company_status_upper === "CLOSED") lines.push("Firma er stengt (companies.status).");
    else if (company_status_upper === "PENDING") lines.push("Firma venter aktivering (companies.status).");
    else lines.push("Firmastatus er ikke ACTIVE.");
  }
  if (!closed_lookup_ok) {
    lines.push("Kunne ikke verifisere stengte datoer (closed_dates).");
  } else if (closed_reason) {
    lines.push(`Stengt dato (operativ): ${closed_reason}`);
  }
  if (!is_weekend && cutoff === "TODAY_LOCKED") {
    lines.push("Cut-off kl. 08:00 (Europe/Oslo) er passert for i dag.");
  }
  if (lines.length === 0) {
    lines.push("Ingen operative ordre i dag etter filter — vanlig hvis ingen har bestilt.");
  }
  return lines;
}

async function fetchLocationLabels(admin: SupabaseClient, companyId: string): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const { data, error } = await admin.from("company_locations").select("id,name").eq("company_id", companyId);
  if (error || !Array.isArray(data)) return map;
  for (const row of data as { id?: unknown; name?: unknown }[]) {
    const id = safeStr(row.id);
    if (!id) continue;
    const nm = safeStr(row.name);
    map.set(id, nm || id);
  }
  return map;
}

async function fetchEmployeeNamesForUsers(
  admin: SupabaseClient,
  companyId: string,
  userIds: string[],
): Promise<Map<string, { full_name: string | null; email: string | null }>> {
  const out = new Map<string, { full_name: string | null; email: string | null }>();
  const ids = [...new Set(userIds.filter((u) => isUuid(u)))];
  if (!ids.length) return out;

  const { data, error } = await admin
    .from("profiles")
    .select("user_id,full_name,email,company_id")
    .eq("company_id", companyId)
    .in("user_id", ids);

  if (error || !Array.isArray(data)) return out;

  for (const row of data as { user_id?: unknown; full_name?: unknown; email?: unknown; company_id?: unknown }[]) {
    const uid = safeStr(row.user_id);
    if (!uid || safeStr(row.company_id) !== companyId) continue;
    out.set(uid, {
      full_name: row.full_name != null ? safeStr(row.full_name) : null,
      email: row.email != null ? safeStr(row.email) : null,
    });
  }
  return out;
}

/**
 * Aggregater for lokasjon × slot fra canonical operative ordreliste (tellinger + distinkte brukere).
 * Notatfelt: antall rader med ikke-tom `orders.note` / dagvalg-notat (eksisterende modell).
 */
export function buildCompanyOperativeDeliverySummary(
  operative: OperativeKitchenOrderRow[],
  dcMap: Map<string, KitchenDayChoiceMapEntry>,
  locLabels: Map<string, string>,
): CompanyOperativeDeliverySummary {
  type Cell = {
    location_id: string;
    location_label: string;
    slot_norm: string;
    orders: number;
    users: Set<string>;
    order_notes: number;
    dc_notes: number;
  };
  const cells = new Map<string, Cell>();

  const companyUsers = new Set<string>();

  for (const r of operative) {
    const cid = safeStr(r.company_id);
    const uid = safeStr(r.user_id);
    const lid = safeStr(r.location_id);
    const slot_norm = normKitchenSlot(r.slot);
    const key = `${lid}\u0000${slot_norm}`;
    const locLabel = locLabels.get(lid) ?? lid;

    let c = cells.get(key);
    if (!c) {
      c = { location_id: lid, location_label: locLabel, slot_norm, orders: 0, users: new Set(), order_notes: 0, dc_notes: 0 };
      cells.set(key, c);
    }
    c.orders += 1;
    if (uid) c.users.add(uid);
    if (r.note != null && safeStr(r.note)) c.order_notes += 1;
    const dc = dcMap.get(`${cid}|${lid}|${uid}`);
    if (dc?.note != null && safeStr(dc.note)) c.dc_notes += 1;
    if (uid) companyUsers.add(uid);
  }

  const per_location_slot: CompanyOperativeDeliveryPerCell[] = Array.from(cells.values())
    .map((c) => ({
      location_id: c.location_id,
      location_label: c.location_label,
      slot_norm: c.slot_norm,
      operative_orders: c.orders,
      distinct_employees: c.users.size,
      rows_with_order_note: c.order_notes,
      rows_with_day_choice_note: c.dc_notes,
    }))
    .sort((a, b) => {
      const l = a.location_label.localeCompare(b.location_label, "nb");
      if (l !== 0) return l;
      return a.slot_norm.localeCompare(b.slot_norm, "nb");
    });

  const byLocMap = new Map<
    string,
    { location_id: string; location_label: string; orders: number; users: Set<string>; slots: Set<string> }
  >();
  for (const c of cells.values()) {
    let b = byLocMap.get(c.location_id);
    if (!b) {
      b = {
        location_id: c.location_id,
        location_label: c.location_label,
        orders: 0,
        users: new Set(),
        slots: new Set(),
      };
      byLocMap.set(c.location_id, b);
    }
    b.orders += c.orders;
    for (const u of c.users) b.users.add(u);
    b.slots.add(c.slot_norm);
  }
  const by_location: CompanyOperativeDeliveryByLocation[] = Array.from(byLocMap.values())
    .map((b) => ({
      location_id: b.location_id,
      location_label: b.location_label,
      operative_orders: b.orders,
      distinct_employees: b.users.size,
      slots_with_orders: b.slots.size,
    }))
    .sort((a, b) => a.location_label.localeCompare(b.location_label, "nb"));

  const bySlotMap = new Map<string, { slot_norm: string; orders: number; users: Set<string>; locs: Set<string> }>();
  for (const c of cells.values()) {
    let s = bySlotMap.get(c.slot_norm);
    if (!s) {
      s = { slot_norm: c.slot_norm, orders: 0, users: new Set(), locs: new Set() };
      bySlotMap.set(c.slot_norm, s);
    }
    s.orders += c.orders;
    for (const u of c.users) s.users.add(u);
    s.locs.add(c.location_id);
  }
  const by_slot: CompanyOperativeDeliveryBySlot[] = Array.from(bySlotMap.values())
    .map((s) => ({
      slot_norm: s.slot_norm,
      operative_orders: s.orders,
      distinct_employees: s.users.size,
      locations_with_orders: s.locs.size,
    }))
    .sort((a, b) => a.slot_norm.localeCompare(b.slot_norm, "nb"));

  const slotKeys = new Set<string>();
  const locKeys = new Set<string>();
  for (const c of cells.values()) {
    slotKeys.add(c.slot_norm);
    locKeys.add(c.location_id);
  }

  return {
    per_location_slot,
    by_location,
    by_slot,
    totals: {
      operative_orders: operative.length,
      locations_with_orders: locKeys.size,
      slots_with_orders: slotKeys.size,
      distinct_employees: companyUsers.size,
    },
  };
}

function rowsFromOperative(
  operative: OperativeKitchenOrderRow[],
  dcMap: Map<string, KitchenDayChoiceMapEntry>,
  locLabels: Map<string, string>,
  names: Map<string, { full_name: string | null; email: string | null }>,
): CompanyOperativeDayRosterRow[] {
  const out: CompanyOperativeDayRosterRow[] = [];
  for (const r of operative) {
    const cid = safeStr(r.company_id);
    const uid = safeStr(r.user_id);
    const lid = safeStr(r.location_id);
    const slot_norm = normKitchenSlot(r.slot);
    const dc = dcMap.get(`${cid}|${lid}|${uid}`);
    const prof = names.get(uid);
    out.push({
      order_id: safeStr(r.id),
      user_id: uid,
      employee_display_name: displayNameFromProfile(prof ?? { full_name: null, email: null }),
      location_id: lid,
      location_label: locLabels.get(lid) ?? lid,
      slot_norm,
      order_status: safeStr(r.status).toUpperCase() || "ACTIVE",
      order_note: r.note != null && safeStr(r.note) ? safeStr(r.note) : null,
      day_choice_note: dc?.note != null && safeStr(dc.note) ? safeStr(dc.note) : null,
    });
  }
  return sortOperativeDayRosterRows(out);
}

export async function loadCompanyOperativeDayRoster(input: {
  companyId: string;
  locationId: string | null;
  companyStatusUpper: string;
  dateISO?: string;
}): Promise<CompanyOperativeDayRosterPayload> {
  const company_id = safeStr(input.companyId);
  const locationId = input.locationId ? safeStr(input.locationId) : null;
  const company_status_upper = safeStr(input.companyStatusUpper).toUpperCase() || "UNKNOWN";
  const date_iso = input.dateISO && /^\d{4}-\d{2}-\d{2}$/.test(safeStr(input.dateISO)) ? safeStr(input.dateISO) : osloTodayISODate();

  let admin: SupabaseClient;
  try {
    admin = supabaseAdmin() as unknown as SupabaseClient;
  } catch {
    return {
      date_iso,
      company_id,
      load_ok: false,
      load_error_message: "Service role ikke tilgjengelig.",
      rows: [],
      context_lines_nb: ["Konfigurasjon mangler for å lese operative data."],
      delivery_summary: null,
    };
  }

  const rid = `company_day_roster_${company_id}_${Date.now().toString(36)}`;
  const wk = weekdayKeyFromOsloISODate(date_iso);
  const is_weekend = wk === null;

  const [ordersLoaded, closed, locLabels] = await Promise.all([
    loadOperativeKitchenOrders({ admin, dateISO: date_iso, tenant: { companyId: company_id } }),
    loadOperativeClosedDatesReasonsInRange({
      companyId: company_id,
      locationId,
      fromIso: date_iso,
      toIso: date_iso,
      rid,
    }),
    fetchLocationLabels(admin, company_id),
  ]);

  let closed_reason: string | null = null;
  const closed_lookup_ok = closed.ok;
  if (closed.ok) {
    closed_reason = closed.byDate.get(date_iso) ?? null;
  }

  const cutoff = cutoffStatusForDate(date_iso);

  if (ordersLoaded.ok === false) {
    const ctxLines = buildContextLinesNb({
      date_iso,
      company_status_upper,
      operative_count: 0,
      closed_reason,
      closed_lookup_ok,
      cutoff,
      is_weekend,
    });
    ctxLines.unshift(`Ordrelesing feilet: ${safeStr(ordersLoaded.dbError.message)}`);
    return {
      date_iso,
      company_id,
      load_ok: false,
      load_error_message: safeStr(ordersLoaded.dbError.message),
      rows: [],
      context_lines_nb: ctxLines,
      delivery_summary: null,
    };
  }

  const operative = ordersLoaded.operative;
  const delivery_summary = buildCompanyOperativeDeliverySummary(operative, ordersLoaded.dcMap, locLabels);
  const userIds = operative.map((r) => safeStr(r.user_id));
  const names = await fetchEmployeeNamesForUsers(admin, company_id, userIds);
  const rows = rowsFromOperative(operative, ordersLoaded.dcMap, locLabels, names);

  const context_lines_nb = buildContextLinesNb({
    date_iso,
    company_status_upper,
    operative_count: rows.length,
    closed_reason,
    closed_lookup_ok,
    cutoff,
    is_weekend,
  });

  return {
    date_iso,
    company_id,
    load_ok: true,
    load_error_message: null,
    rows,
    context_lines_nb,
    delivery_summary,
  };
}
