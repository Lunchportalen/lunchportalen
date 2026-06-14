// lib/agreements/resolveAgreementForDate.ts
import "server-only";

import { normalizeDeliveryDaysStrict } from "@/lib/agreements/deliveryDays";
import type {
  AgreementChangeRequestRow,
  AgreementSnapshotForResolver,
  PackageByDayRequestedChange,
  ResolvedAgreementForDate,
  ResolvedAgreementForDateError,
  ResolvedAgreementForDateResult,
} from "@/lib/agreements/changeRequestTypes";
import { DAY_KEYS, type DayKey, type Tier } from "@/lib/agreements/normalize";
import { supabaseAdmin } from "@/lib/supabase/admin";

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}

function isIsoDate(v: unknown): v is string {
  return typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v.trim());
}

function normTier(v: unknown): Tier | null {
  const s = safeStr(v).toUpperCase();
  if (s === "BASIS" || s === "LUXUS" || s === "ENTERPRISE") return s as Tier;
  return null;
}

export function dayKeyFromIsoDate(dateISO: string): DayKey | null {
  const s = safeStr(dateISO);
  if (!isIsoDate(s)) return null;
  const d = new Date(`${s}T00:00:00.000Z`);
  const js = d.getUTCDay();
  if (js === 1) return "mon";
  if (js === 2) return "tue";
  if (js === 3) return "wed";
  if (js === 4) return "thu";
  if (js === 5) return "fri";
  return null;
}

function isEffectiveOnDate(row: Pick<AgreementChangeRequestRow, "effective_from" | "effective_to">, dateISO: string) {
  if (dateISO < row.effective_from) return false;
  if (row.effective_to && dateISO > row.effective_to) return false;
  return true;
}

function pickApprovedPackageOverride(
  dayKey: DayKey,
  dateISO: string,
  requests: AgreementChangeRequestRow[],
): { tier: Tier; changeRequestId: string } | null {
  const candidates = requests
    .filter(
      (r) =>
        r.status === "APPROVED" &&
        r.change_type === "PACKAGE_BY_DAY" &&
        isEffectiveOnDate(r, dateISO),
    )
    .sort((a, b) => {
      const fromCmp = b.effective_from.localeCompare(a.effective_from);
      if (fromCmp !== 0) return fromCmp;
      return b.created_at.localeCompare(a.created_at);
    });

  for (const req of candidates) {
    const change = req.requested_change as PackageByDayRequestedChange;
    const override = change?.day_overrides?.[dayKey];
    const tier = normTier(override?.package);
    if (tier) return { tier, changeRequestId: req.id };
  }

  return null;
}

export function resolveAgreementForDateFromSnapshot(input: {
  snapshot: AgreementSnapshotForResolver;
  dateISO: string;
  approvedChangeRequests?: AgreementChangeRequestRow[];
}): ResolvedAgreementForDateResult {
  const dateISO = safeStr(input.dateISO);
  const snapshot = input.snapshot;
  const approvedChangeRequests = input.approvedChangeRequests ?? [];

  if (!isIsoDate(dateISO)) {
    return { ok: false, error: "BAD_INPUT", message: "Ugyldig datoformat (forventer YYYY-MM-DD)." };
  }

  if (!snapshot.agreementId || !snapshot.providerId || !snapshot.companyId) {
    return { ok: false, error: "NO_AGREEMENT", message: "Mangler avtalesnapshot." };
  }

  const dayKey = dayKeyFromIsoDate(dateISO);
  if (!dayKey) {
    return { ok: false, error: "WEEKEND", message: "Helg er ikke støttet (man–fre)." };
  }

  const deliveryDays = snapshot.deliveryDays.length
    ? snapshot.deliveryDays
    : normalizeDeliveryDaysStrict(null).days;
  const deliveryAllowed = safeStr(snapshot.status).toUpperCase() === "ACTIVE" && deliveryDays.includes(dayKey);

  if (!deliveryDays.includes(dayKey)) {
    return {
      ok: false,
      error: "NOT_DELIVERY_DAY",
      message: `${dayKey} er ikke en leveringsdag i avtalen.`,
    };
  }

  const baseTier = snapshot.dayTiers[dayKey] ?? normTier(snapshot.dayTiers[dayKey]) ?? "BASIS";
  const override = pickApprovedPackageOverride(dayKey, dateISO, approvedChangeRequests);

  const resolved: ResolvedAgreementForDate = {
    ok: true,
    companyId: snapshot.companyId,
    locationId: snapshot.locationId,
    date: dateISO,
    agreementId: snapshot.agreementId,
    providerId: snapshot.providerId,
    agreementStatus:
      safeStr(snapshot.status).toUpperCase() === "ACTIVE"
        ? "ACTIVE"
        : (safeStr(snapshot.status).toUpperCase() as ResolvedAgreementForDate["agreementStatus"]) || "MISSING",
    deliveryAllowed,
    dayKey,
    tier: override?.tier ?? baseTier,
    dayOverride: override ? { dayKey, tier: override.tier } : null,
    tierSource: override ? "APPROVED_CHANGE_REQUEST" : "BASE_AGREEMENT",
    changeRequestId: override?.changeRequestId ?? null,
    baseDayTiers: snapshot.dayTiers,
  };

  return resolved;
}

async function fetchAgreementSnapshot(
  companyId: string,
  locationId: string | null,
): Promise<AgreementSnapshotForResolver | null> {
  const admin: any = supabaseAdmin();
  const cid = safeStr(companyId);
  if (!cid) return null;

  let query = admin
    .from("agreements")
    .select("id,company_id,location_id,provider_id,status,tier,delivery_days")
    .eq("company_id", cid)
    .eq("status", "ACTIVE")
    .order("created_at", { ascending: false })
    .limit(1);

  if (locationId) {
    query = query.eq("location_id", locationId);
  }

  const { data: agreement, error } = await query.maybeSingle();
  if (error || !agreement?.id) return null;

  const deliveryNorm = normalizeDeliveryDaysStrict((agreement as any).delivery_days);
  const dayTiers: Partial<Record<DayKey, Tier>> = {};
  const fallbackTier = normTier((agreement as any).tier) ?? "BASIS";

  for (const day of deliveryNorm.days) {
    dayTiers[day] = fallbackTier;
  }

  const { data: dayRows } = await admin
    .from("agreement_delivery_days")
    .select("weekday,tier")
    .eq("agreement_id", (agreement as any).id);

  for (const row of dayRows ?? []) {
    const day = safeStr((row as any).weekday).toLowerCase();
    const tier = normTier((row as any).tier);
    if ((DAY_KEYS as readonly string[]).includes(day) && tier && deliveryNorm.days.includes(day as DayKey)) {
      dayTiers[day as DayKey] = tier;
    }
  }

  return {
    agreementId: safeStr((agreement as any).id),
    companyId: safeStr((agreement as any).company_id),
    locationId: (agreement as any).location_id ? safeStr((agreement as any).location_id) : null,
    providerId: safeStr((agreement as any).provider_id),
    status: safeStr((agreement as any).status),
    deliveryDays: deliveryNorm.days,
    dayTiers,
  };
}

async function fetchApprovedChangeRequests(companyId: string, providerId: string): Promise<AgreementChangeRequestRow[]> {
  const admin: any = supabaseAdmin();
  const { data, error } = await admin
    .from("agreement_change_requests")
    .select("*")
    .eq("company_id", companyId)
    .eq("provider_id", providerId)
    .eq("status", "APPROVED")
    .order("effective_from", { ascending: false });

  if (error || !Array.isArray(data)) return [];
  return data as AgreementChangeRequestRow[];
}

/**
 * Read-only effective agreement resolver for a company/date.
 * Overlays approved PACKAGE_BY_DAY change requests without mutating base agreement rows.
 */
export async function resolveAgreementForDate(
  companyId: string,
  locationId: string | null,
  dateISO: string,
): Promise<ResolvedAgreementForDateResult> {
  const snapshot = await fetchAgreementSnapshot(companyId, locationId);
  if (!snapshot) {
    return { ok: false, error: "NO_AGREEMENT", message: "Ingen aktiv avtale funnet for firma." };
  }

  const approved = await fetchApprovedChangeRequests(snapshot.companyId, snapshot.providerId);
  return resolveAgreementForDateFromSnapshot({
    snapshot,
    dateISO,
    approvedChangeRequests: approved,
  });
}
