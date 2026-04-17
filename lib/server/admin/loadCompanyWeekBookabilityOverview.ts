// lib/server/admin/loadCompanyWeekBookabilityOverview.ts
/** Firmascopet read-only ukeoversikt (bestillbarhet per dag) — samme kilder som loadCompanyOperationalBrief (ingen ny sannhetsmotor). */
import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { fetchAgreementDayTiersForCompany } from "@/lib/agreement/currentAgreement";
import { DAY_KEYS, type DayKey, type Tier } from "@/lib/agreements/normalize";
import { formatDateNO, formatWeekdayNO } from "@/lib/date/format";
import { addDaysISO, cutoffStatusForDate, osloTodayISODate } from "@/lib/date/oslo";
import { weekdayKeyFromOsloISODate } from "@/lib/date/weekdayKeyFromIso";
import { loadOperativeClosedDatesReasonsInRange } from "@/lib/orders/orderWriteGuard";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { indexLedgerAgreementsByCompanyId } from "@/lib/server/superadmin/loadCompanyRegistrationsInbox";
import { canSeeNextWeek, canSeeThisWeek, visibleWeekStarts } from "@/lib/week/availability";

import {
  formatLedgerPipelineLabelNb,
} from "@/lib/server/admin/loadCompanyOperationalBrief";

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

function sortDayKeys(keys: DayKey[]): DayKey[] {
  return [...keys].sort((a, b) => DAY_KEYS.indexOf(a) - DAY_KEYS.indexOf(b));
}

function tierLabelNb(t: Tier | null): string | null {
  if (t === "BASIS") return "Basis";
  if (t === "LUXUS") return "Luxus";
  return null;
}

export type CompanyWeekBookabilityDay = {
  date_iso: string;
  weekday_label_nb: string;
  daymap_active: boolean;
  tier: Tier | null;
  tier_label_nb: string | null;
  booking: "open" | "blocked";
  detail_lines_nb: string[];
};

export type CompanyWeekBookabilityWeek = {
  week_start_iso: string;
  title_nb: string;
  range_label_nb: string;
  days: CompanyWeekBookabilityDay[];
};

export type CompanyWeekBookabilityOverview = {
  ok: true;
  config_warning_nb: string | null;
  company_status_upper: string;
  ledger_pipeline_label_nb: string;
  snapshot_agreement_status_upper: string | null;
  operative_days_label_nb: string;
  week_visibility_summary_nb: string;
  weeks: CompanyWeekBookabilityWeek[];
};

function isSoftBookingLine(line: string) {
  return (
    line.startsWith("Ingen aktiv ledger-avtale") ||
    line.startsWith("Avtaleoversikt (company_current_agreement)")
  );
}

function weekBlockTitleNb(weekIndex: number, totalWeeks: number, now: Date): string {
  if (totalWeeks === 2) {
    return weekIndex === 0 ? "Inneværende synlig uke" : "Neste synlige uke";
  }
  if (totalWeeks === 1) {
    if (canSeeThisWeek(now) && !canSeeNextWeek(now)) return "Inneværende synlig uke";
    if (!canSeeThisWeek(now) && canSeeNextWeek(now)) return "Neste synlige uke";
    if (canSeeThisWeek(now) && canSeeNextWeek(now)) return "Synlig uke";
  }
  return "Synlig uke";
}

export type BuildCompanyWeekBookabilityDayRowOpts = {
  /** Kun for enhetstester — i produksjon brukes `cutoffStatusForDate(date_iso)`. */
  cutoff_status?: "PAST" | "TODAY_OPEN" | "TODAY_LOCKED" | "FUTURE_OPEN";
};

/**
 * Én dags rad — samme blokkrekkefølge og formuleringer som firmadagens drift (`loadCompanyOperationalBrief`), avgrenset til én dato.
 */
export function buildCompanyWeekBookabilityDayRow(
  input: {
    date_iso: string;
    company_status_upper: string;
    operative_day_keys: readonly DayKey[];
    dayTiers: Readonly<Partial<Record<DayKey, Tier>>>;
    closed_ok: boolean;
    closed_reason_for_date: string | null;
    ledger_active_id: string | null;
    snapshot_agreement_status_upper: string | null;
  },
  opts?: BuildCompanyWeekBookabilityDayRowOpts,
): CompanyWeekBookabilityDay {
  const weekday_key = weekdayKeyFromOsloISODate(input.date_iso);
  const tier =
    weekday_key && input.dayTiers[weekday_key] ? (input.dayTiers[weekday_key] as Tier) : null;
  const daymap_active = Boolean(tier);

  const lines: string[] = [];
  let hardBlocked = false;

  const pushHard = (msg: string) => {
    hardBlocked = true;
    lines.push(msg);
  };
  const pushSoft = (msg: string) => {
    lines.push(msg);
  };

  const companyU = safeStr(input.company_status_upper).toUpperCase() || "UNKNOWN";
  if (companyU !== "ACTIVE") {
    if (companyU === "PAUSED") pushHard("Firma er satt på pause (companies.status).");
    else if (companyU === "CLOSED") pushHard("Firma er stengt (companies.status).");
    else if (companyU === "PENDING") pushHard("Firma venter aktivering (companies.status).");
    else pushHard("Firmastatus er ikke ACTIVE.");
  }

  if (!input.closed_ok) {
    pushHard("Kunne ikke verifisere stengte datoer (closed_dates).");
  } else if (input.closed_reason_for_date) {
    pushHard(`Stengt dato (operativ): ${input.closed_reason_for_date}`);
  }

  if (input.operative_day_keys.length === 0) {
    pushHard("Mangler operativ daymap — canonical dag-for-dag-modell finnes ikke i databasen.");
  } else if (weekday_key && !tier) {
    pushHard("Ikke operativ leveringsdag i daymap for firmaet (denne ukedagen).");
  } else if (!weekday_key) {
    pushHard("Ukedag utenfor operativ mandag–fredag-modell.");
  }

  const cutoff = opts?.cutoff_status ?? cutoffStatusForDate(input.date_iso);
  if (cutoff === "PAST") {
    pushHard("Dato i fortid — ikke nye bestillinger etter operativ modell.");
  }
  if (cutoff === "TODAY_LOCKED") {
    pushHard(
      "Cut-off kl. 08:00 (Europe/Oslo) er passert for i dag — samme dag endres ikke etter cut-off.",
    );
  }

  if (!input.ledger_active_id) {
    pushSoft("Ingen aktiv ledger-avtale (public.agreements status ACTIVE).");
  }

  if (input.snapshot_agreement_status_upper && input.snapshot_agreement_status_upper !== "ACTIVE") {
    pushSoft(
      `Avtaleoversikt (company_current_agreement): status ${input.snapshot_agreement_status_upper} — operative dagvalg kan likevel følge daymap.`,
    );
  }

  const booking: CompanyWeekBookabilityDay["booking"] = hardBlocked ? "blocked" : "open";

  if (booking === "open") {
    const hardLines = lines.filter((l) => !isSoftBookingLine(l));
    if (hardLines.length === 0) {
      const softOnly = lines.length > 0 && lines.every(isSoftBookingLine);
      if (lines.length === 0) {
        lines.push(
          "Operativt åpent for bestilling etter modell (ingen blokkeringer fra daymap / stengt / cut-off).",
        );
      } else if (softOnly) {
        lines.push(
          "Operativt åpent for bestilling etter modell (ingen harde blokkeringer fra daymap / stengt / cut-off).",
        );
      }
    }
  }

  return {
    date_iso: input.date_iso,
    weekday_label_nb: formatWeekdayNO(input.date_iso),
    daymap_active,
    tier,
    tier_label_nb: tierLabelNb(tier),
    booking,
    detail_lines_nb: lines,
  };
}

export async function loadCompanyWeekBookabilityOverview(input: {
  companyId: string;
  locationId: string | null;
  companyStatusUpper: string;
}): Promise<CompanyWeekBookabilityOverview> {
  const companyId = safeStr(input.companyId);
  const locationId = input.locationId ? safeStr(input.locationId) : null;
  const company_status_upper = safeStr(input.companyStatusUpper).toUpperCase() || "UNKNOWN";

  const now = new Date();
  const weekStarts = visibleWeekStarts(now);
  const week_visibility_summary_nb =
    weekStarts.length === 0
      ? "Ingen ukesynlighet i /week akkurat nå (fredag 15:00 / torsdag 08:00, Oslo)."
      : `Synlige ukestart i /week: ${weekStarts.map((d) => formatDateNO(isoDateInOslo(d))).join(" · ")}.`;

  let config_warning_nb: string | null = null;
  let admin: SupabaseClient;
  try {
    admin = supabaseAdmin() as unknown as SupabaseClient;
  } catch {
    config_warning_nb = "Konfigurasjon mangler for å lese operativ data (service role).";
    return {
      ok: true,
      config_warning_nb,
      company_status_upper,
      ledger_pipeline_label_nb: formatLedgerPipelineLabelNb(null, null),
      snapshot_agreement_status_upper: null,
      operative_days_label_nb: "—",
      week_visibility_summary_nb,
      weeks: [],
    };
  }

  const rid = `company_week_bookability_${companyId}_${Date.now().toString(36)}`;

  const dateIsoList: string[] = [];
  for (const start of weekStarts) {
    const monIso = isoDateInOslo(start);
    for (let i = 0; i < 5; i++) {
      dateIsoList.push(addDaysISO(monIso, i));
    }
  }
  const sortedDates = [...new Set(dateIsoList)].sort();
  const fromIso = sortedDates[0] ?? osloTodayISODate();
  const toIso = sortedDates[sortedDates.length - 1] ?? fromIso;

  const [ledgerRes, snapRes, dayTiers, closed] = await Promise.all([
    admin
      .from("agreements")
      .select("id,company_id,status,created_at")
      .eq("company_id", companyId)
      .in("status", ["PENDING", "ACTIVE"]),
    admin.from("company_current_agreement").select("status").eq("company_id", companyId).maybeSingle(),
    fetchAgreementDayTiersForCompany(admin, companyId),
    loadOperativeClosedDatesReasonsInRange({
      companyId,
      locationId,
      fromIso,
      toIso,
      rid,
    }),
  ]);

  if (ledgerRes.error) {
    console.warn("[loadCompanyWeekBookabilityOverview] agreements ledger", safeStr(ledgerRes.error.message));
  }

  const ledgerRows =
    !ledgerRes.error && Array.isArray(ledgerRes.data) ? (ledgerRes.data as Record<string, unknown>[]) : [];
  const idx = indexLedgerAgreementsByCompanyId(ledgerRows);
  const ledger_active_id = idx.activeIdByCompany.get(companyId) ?? null;
  const ledger_pending_id = idx.pendingIdByCompany.get(companyId) ?? null;

  let snapshot_agreement_status_upper: string | null = null;
  if (!snapRes.error && snapRes.data && typeof (snapRes.data as { status?: unknown }).status !== "undefined") {
    snapshot_agreement_status_upper = safeStr((snapRes.data as { status?: unknown }).status).toUpperCase() || null;
  }

  const operative_day_keys = sortDayKeys(Object.keys(dayTiers) as DayKey[]);
  const operative_days_label_nb =
    operative_day_keys.length === 0
      ? "Ingen operative leveringsdager i daymap (v_company_current_agreement_daymap)."
      : operative_day_keys.map((k) => DAY_NB[k] ?? k).join(", ");

  const closed_ok = closed.ok;
  const closedByDate = closed.ok ? closed.byDate : new Map<string, string>();

  const weeks: CompanyWeekBookabilityWeek[] = weekStarts.map((start, weekIndex) => {
    const monIso = isoDateInOslo(start);
    const friIso = addDaysISO(monIso, 4);
    const days: CompanyWeekBookabilityDay[] = [];
    for (let i = 0; i < 5; i++) {
      const date_iso = addDaysISO(monIso, i);
      const closed_reason_for_date = closedByDate.get(date_iso) ?? null;
      days.push(
        buildCompanyWeekBookabilityDayRow({
          date_iso,
          company_status_upper,
          operative_day_keys,
          dayTiers,
          closed_ok,
          closed_reason_for_date,
          ledger_active_id,
          snapshot_agreement_status_upper,
        }),
      );
    }
    return {
      week_start_iso: monIso,
      title_nb: weekBlockTitleNb(weekIndex, weekStarts.length, now),
      range_label_nb: `${formatDateNO(monIso)}–${formatDateNO(friIso)}`,
      days,
    };
  });

  return {
    ok: true,
    config_warning_nb,
    company_status_upper,
    ledger_pipeline_label_nb: formatLedgerPipelineLabelNb(ledger_active_id, ledger_pending_id),
    snapshot_agreement_status_upper,
    operative_days_label_nb,
    week_visibility_summary_nb,
    weeks,
  };
}
