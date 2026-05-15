import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

export type MenuDaySyncInput = {
  date: string;
  planTier: string;
};

export type MenuServiceDaySyncStats = {
  /** Distinct locations targeted for this menuDay slice */
  locationCount: number;
  inserted: number;
  updated: number;
  unchanged: number;
  skipped: boolean;
  reason?: string;
};

/** agreement_delivery_days.weekday mapping (EU weekday from ISO date noon UTC). */
const DOW_TO_DAYKEY: Record<number, "mon" | "tue" | "wed" | "thu" | "fri" | undefined> = {
  1: "mon",
  2: "tue",
  3: "wed",
  4: "thu",
  5: "fri",
};

export function isoDateToAgreementDayKey(dateISO: string): "mon" | "tue" | "wed" | "thu" | "fri" | null {
  const d = new Date(`${dateISO}T12:00:00.000Z`);
  const k = DOW_TO_DAYKEY[d.getUTCDay()];
  return k ?? null;
}

export function normalizeMenuPlanTier(v: unknown): "BASIS" | "LUXUS" | "ENTERPRISE" | null {
  const s = String(v ?? "").trim().toUpperCase();
  if (s === "BASIS" || s === "LUXUS" || s === "ENTERPRISE") return s;
  return null;
}

/**
 * Sanity menuDay slice → ACTIVE agreements with matching per-day tier + locations → UPSERT menu_service_days.
 */
export async function syncMenuServiceDaysForPublishedMenuDay(
  admin: SupabaseClient<any>,
  menuDay: MenuDaySyncInput
): Promise<MenuServiceDaySyncStats> {
  const planTier = normalizeMenuPlanTier(menuDay.planTier);
  if (!planTier) {
    return {
      locationCount: 0,
      inserted: 0,
      updated: 0,
      unchanged: 0,
      skipped: true,
      reason: "INVALID_PLAN_TIER",
    };
  }

  const dayKey = isoDateToAgreementDayKey(menuDay.date);
  if (!dayKey) {
    return {
      locationCount: 0,
      inserted: 0,
      updated: 0,
      unchanged: 0,
      skipped: true,
      reason: "WEEKEND_OR_INVALID_DATE",
    };
  }

  const { data: dayRows, error: dErr } = await admin
    .from("agreement_delivery_days")
    .select("agreement_id")
    .eq("weekday", dayKey)
    .eq("tier", planTier);

  if (dErr) {
    throw new Error(`agreement_delivery_days: ${dErr.message}`);
  }

  const agreementIds = [
    ...new Set((dayRows ?? []).map((r) => String((r as { agreement_id?: string }).agreement_id ?? "").trim()).filter(Boolean)),
  ];
  if (agreementIds.length === 0) {
    return { locationCount: 0, inserted: 0, updated: 0, unchanged: 0, skipped: false };
  }

  const { data: agreements, error: aErr } = await admin
    .from("agreements")
    .select("id, company_id")
    .in("id", agreementIds)
    .eq("status", "ACTIVE");

  if (aErr) {
    throw new Error(`agreements: ${aErr.message}`);
  }

  const companyIds = [
    ...new Set(
      (agreements ?? [])
        .map((r) => String((r as { company_id?: string }).company_id ?? "").trim())
        .filter(Boolean),
    ),
  ];
  if (companyIds.length === 0) {
    return { locationCount: 0, inserted: 0, updated: 0, unchanged: 0, skipped: false };
  }

  const { data: locs, error: lErr } = await admin.from("company_locations").select("id").in("company_id", companyIds);

  if (lErr) {
    throw new Error(`company_locations: ${lErr.message}`);
  }

  const locationIds = [
    ...new Set((locs ?? []).map((r) => String((r as { id?: string }).id ?? "").trim()).filter(Boolean)),
  ];

  const locationCount = locationIds.length;
  if (locationCount === 0) {
    return { locationCount: 0, inserted: 0, updated: 0, unchanged: 0, skipped: false };
  }

  const { data: beforeRows, error: bErr } = await admin
    .from("menu_service_days")
    .select("location_id, state, cutoff_at")
    .eq("service_date", menuDay.date)
    .in("location_id", locationIds);

  if (bErr) {
    throw new Error(`menu_service_days (before): ${bErr.message}`);
  }

  type RowSnap = { state: string | null; cutoff_at: string | null };
  const beforeMap = new Map<string, RowSnap>();
  for (const r of beforeRows ?? []) {
    const row = r as { location_id?: string; state?: string | null; cutoff_at?: string | null };
    const lid = String(row.location_id ?? "").trim();
    if (!lid) continue;
    beforeMap.set(lid, { state: row.state ?? null, cutoff_at: row.cutoff_at ?? null });
  }

  const rows = locationIds.map((location_id) => ({
    location_id,
    service_date: menuDay.date,
    state: "published" as const,
  }));

  const { error: uErr } = await admin.from("menu_service_days").upsert(rows, {
    onConflict: "location_id,service_date",
  });

  if (uErr) {
    throw new Error(`menu_service_days upsert: ${uErr.message}`);
  }

  const { data: afterRows, error: afErr } = await admin
    .from("menu_service_days")
    .select("location_id, state, cutoff_at")
    .eq("service_date", menuDay.date)
    .in("location_id", locationIds);

  if (afErr) {
    throw new Error(`menu_service_days (after): ${afErr.message}`);
  }

  const afterMap = new Map<string, RowSnap>();
  for (const r of afterRows ?? []) {
    const row = r as { location_id?: string; state?: string | null; cutoff_at?: string | null };
    const lid = String(row.location_id ?? "").trim();
    if (!lid) continue;
    afterMap.set(lid, { state: row.state ?? null, cutoff_at: row.cutoff_at ?? null });
  }

  let inserted = 0;
  let updated = 0;
  let unchanged = 0;

  for (const loc of locationIds) {
    const b = beforeMap.get(loc);
    const a = afterMap.get(loc);
    if (!b && a) inserted += 1;
    else if (b && a) {
      if (b.state === a.state && b.cutoff_at === a.cutoff_at) unchanged += 1;
      else updated += 1;
    }
  }

  return { locationCount, inserted, updated, unchanged, skipped: false };
}

/**
 * Fjern materialiserte rader når menuDay ikke lenger er publiserbar Synlighetsfilter.
 */
export async function deleteMenuServiceDaysForMenuDay(admin: SupabaseClient<any>, menuDay: MenuDaySyncInput): Promise<{ deleted: number }> {
  const planTier = normalizeMenuPlanTier(menuDay.planTier);
  if (!planTier) return { deleted: 0 };

  const dayKey = isoDateToAgreementDayKey(menuDay.date);
  if (!dayKey) return { deleted: 0 };

  const { data: dayRows } = await admin.from("agreement_delivery_days").select("agreement_id").eq("weekday", dayKey).eq("tier", planTier);

  const agreementIds = [
    ...new Set((dayRows ?? []).map((r) => String((r as { agreement_id?: string }).agreement_id ?? "").trim()).filter(Boolean)),
  ];
  if (agreementIds.length === 0) return { deleted: 0 };

  const { data: agreements } = await admin
    .from("agreements")
    .select("id, company_id")
    .in("id", agreementIds)
    .eq("status", "ACTIVE");

  const companyIds = [
    ...new Set(
      (agreements ?? [])
        .map((r) => String((r as { company_id?: string }).company_id ?? "").trim())
        .filter(Boolean),
    ),
  ];
  if (companyIds.length === 0) return { deleted: 0 };

  const { data: locs } = await admin.from("company_locations").select("id").in("company_id", companyIds);

  const locationIds = [
    ...new Set((locs ?? []).map((r) => String((r as { id?: string }).id ?? "").trim()).filter(Boolean)),
  ];
  if (locationIds.length === 0) return { deleted: 0 };

  const { data: delRows, error: delErr } = await admin
    .from("menu_service_days")
    .delete()
    .eq("service_date", menuDay.date)
    .in("location_id", locationIds)
    .select("id");

  if (delErr) {
    throw new Error(`menu_service_days delete: ${delErr.message}`);
  }

  return { deleted: delRows?.length ?? 0 };
}
