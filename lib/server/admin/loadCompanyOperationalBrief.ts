// lib/server/admin/loadCompanyOperationalBrief.ts
/** Firmascopet operativ oversikt for company_admin — gjenbruker ledger-index, daymap, closed_dates-range og cutoff (ingen ny sannhetsmotor). */
import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { fetchAgreementDayTiersForCompany } from "@/lib/agreement/currentAgreement";
import { DAY_KEYS, type DayKey } from "@/lib/agreements/normalize";
import { cutoffStatusForDate, osloTodayISODate } from "@/lib/date/oslo";
import { formatDateNO } from "@/lib/date/format";
import { weekdayKeyFromOsloISODate } from "@/lib/date/weekdayKeyFromIso";
import { loadOperativeClosedDatesReasonsInRange } from "@/lib/orders/orderWriteGuard";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  loadOperativeKitchenOrders,
  normKitchenSlot,
  type LoadOperativeKitchenOrdersResult,
} from "@/lib/server/kitchen/loadOperativeKitchenOrders";
import { indexLedgerAgreementsByCompanyId } from "@/lib/server/superadmin/loadCompanyRegistrationsInbox";
import { visibleWeekStarts } from "@/lib/week/availability";

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}

function isoDateInOslo(d: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Oslo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

const DAY_NB: Record<DayKey, string> = {
  mon: "mandag",
  tue: "tirsdag",
  wed: "onsdag",
  thu: "torsdag",
  fri: "fredag",
};

export type CompanyOperationalOrdersDay =
  | {
      ok: true;
      total_operative: number;
      total_raw_active: number;
      missing_scope_excluded: number;
      cancelled_day_choice_excluded: number;
      by_slot: Record<string, number>;
      by_location: Array<{ location_id: string; location_label: string; count: number }>;
      order_notes_nonempty: number;
      day_choice_notes_nonempty: number;
    }
  | { ok: false; message: string };

export type CompanyOperationalBrief = {
  today_iso: string;
  company_status_upper: string;
  ledger_active_id: string | null;
  ledger_pending_id: string | null;
  ledger_pipeline_label_nb: string;
  snapshot_agreement_status_upper: string | null;
  /** Sorterte day_key fra operativ daymap (kun dager med tier). */
  operative_day_keys: DayKey[];
  operative_days_label_nb: string;
  week_visibility_summary_nb: string;
  cutoff_today: ReturnType<typeof cutoffStatusForDate>;
  today_weekday_key: ReturnType<typeof weekdayKeyFromOsloISODate>;
  is_weekend_today: boolean;
  closed_today_reason: string | null;
  booking_today: "open" | "blocked" | "not_applicable";
  booking_detail_lines_nb: string[];
  /** Samme operative ordrelesing som GET /api/kitchen (tenant = firma, alle lokasjoner). */
  orders_day: CompanyOperationalOrdersDay;
  /** Ordre-spesifikke forklaringer (f.eks. null operative ordre). */
  orders_context_lines_nb: string[];
  /** Leveringsvindu fra aktiv `agreements`-rad når felt finnes. */
  ledger_delivery_window_nb: string | null;
};

export function formatLedgerPipelineLabelNb(activeId: string | null, pendingId: string | null): string {
  if (safeStr(activeId)) return "Aktiv ledger-avtale";
  if (safeStr(pendingId)) return "Ventende ledger-avtale (venter superadmin-godkjenning)";
  return "Ingen aktiv eller ventende ledger-avtale";
}

/** Fra aktiv ledger-rad (slot_start / slot_end) — visning uten ny semantikk. */
export function formatLedgerDeliveryWindowNb(slotStart: unknown, slotEnd: unknown): string | null {
  const a = safeStr(slotStart);
  const b = safeStr(slotEnd);
  if (!a && !b) return null;
  if (a && b) return `${a}–${b}`;
  return a || b;
}

function sortDayKeys(keys: DayKey[]): DayKey[] {
  return [...keys].sort((a, b) => DAY_KEYS.indexOf(a) - DAY_KEYS.indexOf(b));
}

/** Ren summering for company_admin dagsoversikt — ingen ny ordresemantikk. */
export function summarizeOperativeOrdersForBrief(
  loaded: Extract<LoadOperativeKitchenOrdersResult, { ok: true }>,
  locationNameById: ReadonlyMap<string, string | null>,
): Extract<CompanyOperationalOrdersDay, { ok: true }> {
  const { raw, list0, operative, dcMap } = loaded;
  const total_raw_active = raw.length;
  const missing_scope_excluded = total_raw_active - list0.length;
  const cancelled_day_choice_excluded = list0.length - operative.length;

  const by_slot: Record<string, number> = {};
  const byLoc = new Map<string, number>();
  let order_notes_nonempty = 0;
  let day_choice_notes_nonempty = 0;

  for (const r of operative) {
    const sk = normKitchenSlot(r.slot);
    by_slot[sk] = (by_slot[sk] ?? 0) + 1;
    const lid = safeStr(r.location_id);
    byLoc.set(lid, (byLoc.get(lid) ?? 0) + 1);
    if (safeStr(r.note)) order_notes_nonempty += 1;
    const cid = safeStr(r.company_id);
    const uid = safeStr(r.user_id);
    const dc = dcMap.get(`${cid}|${lid}|${uid}`);
    if (dc && safeStr(dc.note)) day_choice_notes_nonempty += 1;
  }

  const by_location = Array.from(byLoc.entries())
    .map(([location_id, count]) => {
      const nm = locationNameById.get(location_id);
      const location_label = safeStr(nm) || location_id || "—";
      return { location_id, location_label, count };
    })
    .sort((a, b) => b.count - a.count || a.location_id.localeCompare(b.location_id));

  return {
    ok: true,
    total_operative: operative.length,
    total_raw_active,
    missing_scope_excluded,
    cancelled_day_choice_excluded,
    by_slot,
    by_location,
    order_notes_nonempty,
    day_choice_notes_nonempty,
  };
}

export async function loadCompanyOperationalBrief(input: {
  companyId: string;
  locationId: string | null;
  companyStatusUpper: string;
}): Promise<CompanyOperationalBrief> {
  const companyId = safeStr(input.companyId);
  const locationId = input.locationId ? safeStr(input.locationId) : null;
  const company_status_upper = safeStr(input.companyStatusUpper).toUpperCase() || "UNKNOWN";

  const today_iso = osloTodayISODate();
  const today_weekday_key = weekdayKeyFromOsloISODate(today_iso);
  const is_weekend_today = today_weekday_key === null;

  const weekStarts = visibleWeekStarts(new Date());
  const week_visibility_summary_nb =
    weekStarts.length === 0
      ? "Ingen ukesynlighet i /week akkurat nå (fredag 15:00 / torsdag 08:00, Oslo)."
      : `Synlige ukestart i /week: ${weekStarts.map((d) => formatDateNO(isoDateInOslo(d))).join(" · ")}.`;

  let admin: SupabaseClient;
  try {
    admin = supabaseAdmin() as unknown as SupabaseClient;
  } catch {
    return {
      today_iso,
      company_status_upper,
      ledger_active_id: null,
      ledger_pending_id: null,
      ledger_pipeline_label_nb: formatLedgerPipelineLabelNb(null, null),
      snapshot_agreement_status_upper: null,
      operative_day_keys: [],
      operative_days_label_nb: "—",
      week_visibility_summary_nb,
      cutoff_today: cutoffStatusForDate(today_iso),
      today_weekday_key,
      is_weekend_today,
      closed_today_reason: null,
      booking_today: "blocked",
      booking_detail_lines_nb: ["Konfigurasjon mangler for å lese operativ data (service role)."],
      orders_day: { ok: false, message: "Service role ikke tilgjengelig." },
      orders_context_lines_nb: [],
      ledger_delivery_window_nb: null,
    };
  }

  const rid = `company_operational_brief_${companyId}_${Date.now().toString(36)}`;

  const [ledgerRes, snapRes, dayTiers] = await Promise.all([
    admin
      .from("agreements")
      .select("id,company_id,status,created_at,slot_start,slot_end")
      .eq("company_id", companyId)
      .in("status", ["PENDING", "ACTIVE"]),
    admin.from("company_current_agreement").select("status").eq("company_id", companyId).maybeSingle(),
    fetchAgreementDayTiersForCompany(admin, companyId),
  ]);

  if (ledgerRes.error) {
    console.warn("[loadCompanyOperationalBrief] agreements ledger", safeStr(ledgerRes.error.message));
  }

  const ledgerRows =
    !ledgerRes.error && Array.isArray(ledgerRes.data) ? (ledgerRes.data as Record<string, unknown>[]) : [];
  const idx = indexLedgerAgreementsByCompanyId(ledgerRows);
  const ledger_active_id = idx.activeIdByCompany.get(companyId) ?? null;
  const ledger_pending_id = idx.pendingIdByCompany.get(companyId) ?? null;

  let ledger_delivery_window_nb: string | null = null;
  if (ledger_active_id) {
    const activeRow = ledgerRows.find(
      (r) => safeStr(r.id) === ledger_active_id && safeStr(r.status).toUpperCase() === "ACTIVE",
    );
    if (activeRow) {
      ledger_delivery_window_nb = formatLedgerDeliveryWindowNb(
        (activeRow as { slot_start?: unknown }).slot_start,
        (activeRow as { slot_end?: unknown }).slot_end,
      );
    }
  }

  let snapshot_agreement_status_upper: string | null = null;
  if (!snapRes.error && snapRes.data && typeof (snapRes.data as { status?: unknown }).status !== "undefined") {
    snapshot_agreement_status_upper = safeStr((snapRes.data as { status?: unknown }).status).toUpperCase() || null;
  }

  const operative_day_keys = sortDayKeys(Object.keys(dayTiers) as DayKey[]);
  const operative_days_label_nb =
    operative_day_keys.length === 0
      ? "Ingen operative leveringsdager i daymap (v_company_current_agreement_daymap)."
      : operative_day_keys.map((k) => DAY_NB[k] ?? k).join(", ");

  const cutoff_today = cutoffStatusForDate(today_iso);

  const [closed, ordersLoaded, locsRes] = await Promise.all([
    loadOperativeClosedDatesReasonsInRange({
      companyId,
      locationId,
      fromIso: today_iso,
      toIso: today_iso,
      rid,
    }),
    loadOperativeKitchenOrders({
      admin,
      dateISO: today_iso,
      tenant: { companyId },
    }),
    admin.from("company_locations").select("id,name").eq("company_id", companyId),
  ]);

  let closed_today_reason: string | null = null;
  if (closed.ok) {
    closed_today_reason = closed.byDate.get(today_iso) ?? null;
  }

  const locationNameById = new Map<string, string | null>();
  if (!locsRes.error && Array.isArray(locsRes.data)) {
    for (const row of locsRes.data as { id?: unknown; name?: unknown }[]) {
      const id = safeStr(row.id);
      if (id) locationNameById.set(id, row.name != null ? safeStr(row.name) : null);
    }
  }

  let orders_day: CompanyOperationalOrdersDay;
  if (ordersLoaded.ok === false) {
    orders_day = { ok: false, message: safeStr(ordersLoaded.dbError.message) || "Kunne ikke lese ordre." };
  } else {
    orders_day = summarizeOperativeOrdersForBrief(ordersLoaded, locationNameById);
  }

  const booking_detail_lines_nb: string[] = [];
  let booking_today: CompanyOperationalBrief["booking_today"] = "open";

  if (is_weekend_today) {
    booking_today = "not_applicable";
    booking_detail_lines_nb.push("Helg — ingen mandag–fredag-leveranser i operativ modell.");
  } else {
    if (company_status_upper !== "ACTIVE") {
      booking_today = "blocked";
      if (company_status_upper === "PAUSED") booking_detail_lines_nb.push("Firma er satt på pause (companies.status).");
      else if (company_status_upper === "CLOSED") booking_detail_lines_nb.push("Firma er stengt (companies.status).");
      else if (company_status_upper === "PENDING") booking_detail_lines_nb.push("Firma venter aktivering (companies.status).");
      else booking_detail_lines_nb.push("Firmastatus er ikke ACTIVE.");
    }

    if (operative_day_keys.length === 0) {
      booking_today = "blocked";
      booking_detail_lines_nb.push("Mangler operativ daymap — canonical dag-for-dag-modell finnes ikke i databasen.");
    } else if (today_weekday_key && !dayTiers[today_weekday_key]) {
      booking_today = "blocked";
      booking_detail_lines_nb.push("I dag er ikke en operativ leveringsdag i daymap for firmaet.");
    }

    if (!closed.ok) {
      booking_today = "blocked";
      booking_detail_lines_nb.push("Kunne ikke verifisere stengte datoer (closed_dates).");
    } else if (closed_today_reason) {
      booking_today = "blocked";
      booking_detail_lines_nb.push(`Stengt dato (operativ): ${closed_today_reason}`);
    }

    if (cutoff_today === "TODAY_LOCKED") {
      booking_today = "blocked";
      booking_detail_lines_nb.push("Cut-off kl. 08:00 (Europe/Oslo) er passert for i dag — samme dag endres ikke etter cut-off.");
    }
  }

  if (!ledger_active_id) {
    booking_detail_lines_nb.push("Ingen aktiv ledger-avtale (public.agreements status ACTIVE).");
  }

  if (snapshot_agreement_status_upper && snapshot_agreement_status_upper !== "ACTIVE") {
    booking_detail_lines_nb.push(
      `Avtaleoversikt (company_current_agreement): status ${snapshot_agreement_status_upper} — operative dagvalg kan likevel følge daymap.`,
    );
  }

  if (booking_today === "open") {
    const hardBlocks = booking_detail_lines_nb.filter(
      (l) =>
        !l.startsWith("Ingen aktiv ledger-avtale") &&
        !l.startsWith("Avtaleoversikt (company_current_agreement)"),
    );
    if (hardBlocks.length === 0) {
      booking_detail_lines_nb.push("Operativt åpent for bestilling i dag etter modell (ingen blokkeringer fra daymap / stengt / cut-off).");
    }
  }

  const orders_context_lines_nb: string[] = [];
  if (orders_day.ok === false) {
    orders_context_lines_nb.push(`Ordrelesing feilet: ${orders_day.message}`);
  } else {
    if (orders_day.total_operative === 0) {
      if (is_weekend_today) {
        orders_context_lines_nb.push("Ingen operative ordre for helgedato (forventet i mandag–fredag-modellen).");
      } else if (booking_today === "blocked") {
        orders_context_lines_nb.push("Ingen operative ordre vises i tillegg til blokkeringene over (samme filter som kjøkken).");
      } else {
        orders_context_lines_nb.push(
          "Ingen operative ordre i dag etter filter (ACTIVE + dagvalg ikke kansellert) — vanlig hvis ingen har bestilt.",
        );
      }
    } else {
      orders_context_lines_nb.push(
        `Totalt ${orders_day.total_operative} operative ordre(r) for ${formatDateNO(today_iso)} (samme lesing som /api/kitchen).`,
      );
    }
    if (orders_day.missing_scope_excluded > 0) {
      orders_context_lines_nb.push(
        `${orders_day.missing_scope_excluded} aktiv(e) ordre(r) uten full scope (company_id / location_id / user_id) er ekskludert fra operative tall.`,
      );
    }
    if (orders_day.cancelled_day_choice_excluded > 0) {
      orders_context_lines_nb.push(
        `${orders_day.cancelled_day_choice_excluded} rad(er) filtrert bort pga. kansellert dagvalg (day_choices).`,
      );
    }
    if (orders_day.order_notes_nonempty > 0 || orders_day.day_choice_notes_nonempty > 0) {
      orders_context_lines_nb.push(
        `Notater: ${orders_day.order_notes_nonempty} ordre(r) med orders.note, ${orders_day.day_choice_notes_nonempty} med dagvalg-notat (day_choices).`,
      );
    }
  }

  return {
    today_iso,
    company_status_upper,
    ledger_active_id,
    ledger_pending_id,
    ledger_pipeline_label_nb: formatLedgerPipelineLabelNb(ledger_active_id, ledger_pending_id),
    snapshot_agreement_status_upper,
    operative_day_keys,
    operative_days_label_nb,
    week_visibility_summary_nb,
    cutoff_today,
    today_weekday_key,
    is_weekend_today,
    closed_today_reason,
    booking_today,
    booking_detail_lines_nb,
    orders_day,
    orders_context_lines_nb,
    ledger_delivery_window_nb,
  };
}
