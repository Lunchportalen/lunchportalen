import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { addMonthsIso, isoMonthStartOslo } from "@/lib/esg/osloMonth";

/** Rader fra `esg_monthly_snapshots` / `esg_yearly_snapshots` (felles spørring). */
export type EsgSnapshotMonthRow = {
  month: string;
  ordered_count: number;
  cancelled_in_time_count: number;
  waste_meals: number;
  waste_kg: number;
  waste_co2e_kg: number;
  cost_saved_nok: number;
  cost_waste_nok: number;
  cost_net_nok: number;
  stability_score: string | null;
};

export type EsgSnapshotYearRow = {
  year: number;
  ordered_count: number;
  cancelled_in_time_count: number;
  waste_meals: number;
  waste_kg: number;
  waste_co2e_kg: number;
  cost_saved_nok: number;
  cost_waste_nok: number;
  cost_net_nok: number;
  stability_score: string | null;
};

const MONTH_SELECT =
  "month, ordered_count, cancelled_in_time_count, waste_meals, waste_kg, waste_co2e_kg, cost_saved_nok, cost_waste_nok, cost_net_nok, stability_score";

const YEAR_SELECT =
  "year, ordered_count, cancelled_in_time_count, waste_meals, waste_kg, waste_co2e_kg, cost_saved_nok, cost_waste_nok, cost_net_nok, stability_score";

/**
 * Siste 12 måneder inkl. inneværende + årssnapshot for inneværende år (Oslo-kalender).
 * Kilde: `esg_monthly_snapshots` / `esg_yearly_snapshots` (cron/RPC-bygget).
 */
export async function fetchCompanyEsgSnapshotSummary(
  supabase: SupabaseClient,
  companyId: string,
): Promise<{ year: number; months: EsgSnapshotMonthRow[]; yearly: EsgSnapshotYearRow | null }> {
  const thisMonth = isoMonthStartOslo();
  const fromMonth = addMonthsIso(thisMonth, -11);
  const year = Number(thisMonth.slice(0, 4));

  const { data: months, error: mErr } = await supabase
    .from("esg_monthly_snapshots")
    .select(MONTH_SELECT)
    .eq("company_id", companyId)
    .gte("month", fromMonth)
    .lte("month", thisMonth)
    .order("month", { ascending: true });

  if (mErr) {
    throw new Error(mErr.message || "esg_monthly_snapshots");
  }

  const { data: yearly, error: yErr } = await supabase
    .from("esg_yearly_snapshots")
    .select(YEAR_SELECT)
    .eq("company_id", companyId)
    .eq("year", year)
    .maybeSingle();

  if (yErr) {
    throw new Error(yErr.message || "esg_yearly_snapshots");
  }

  return {
    year,
    months: (months ?? []) as EsgSnapshotMonthRow[],
    yearly: (yearly ?? null) as EsgSnapshotYearRow | null,
  };
}
