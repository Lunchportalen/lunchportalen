// lib/agreement/currentAgreement.ts
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { normalizeDeliveryDaysStrict } from "@/lib/agreements/deliveryDays";
import { DAY_KEYS, type DayKey, type Tier } from "@/lib/agreements/normalize";
import { opsLog } from "@/lib/ops/log";

/* =========================================================
   Types
========================================================= */

export type AgreementState = {
  ok: true;
  companyId: string;
  locationId: string | null;

  // NOTE:
  // - status is "system view" for the app (week + order window)
  // - ACTIVE is allowed if operative per-day tiers exist (even if agreement snapshot isn't ACTIVE),
  //   because daymap (`v_company_current_agreement_daymap`) is the operational truth (materialisert fra agreement_json ved avtale-opprettelse)
  status: "ACTIVE" | "PAUSED" | "CLOSED" | "MISSING";
  statusReason?: "NO_ACTIVE_AGREEMENT" | "MISSING_DAYMAP" | "MISSING_DELIVERY_DAYS";

  planTier?: string | null;
  pricePerCuvertNok?: number | null;

  deliveryDays: DayKey[];
  slot: "lunch";

  dayTiers: Record<DayKey, Tier>;
  basisDays: number;
  luxusDays: number;

  startDate?: string | null;
  endDate?: string | null;
  updatedAt?: string | null;
  agreementId?: string | null;
};

export type AgreementStateError = {
  ok: false;
  rid: string;
  error: string;
  message: string;
  status: number;
};

/* =========================================================
   Small utils
========================================================= */

function rid(prefix = "agreement_state") {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function normTier(v: any): Tier | null {
  const s = String(v ?? "").trim().toUpperCase();
  if (s === "BASIS" || s === "LUXUS") return s as Tier;
  return null;
}

function normDayKey(v: any): DayKey | null {
  const s = String(v ?? "").trim().toLowerCase();
  if (!s) return null;
  if ((DAY_KEYS as readonly string[]).includes(s)) return s as DayKey;
  return null;
}

function dayKeySort(a: DayKey, b: DayKey) {
  return DAY_KEYS.indexOf(a) - DAY_KEYS.indexOf(b);
}

function isActiveStatus(v: any) {
  return String(v ?? "").trim().toUpperCase() === "ACTIVE";
}

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}

function pickAnyUserId(u: any): string {
  // supabase auth user id is normally auth.user.id
  // tests/mocks may return other shapes but should include an id
  const id = safeStr(u?.id ?? u?.user_id ?? u?.userId);
  return id;
}

function tierFromDeliveryDayValue(value: unknown, fallbackTier: Tier | null): Tier | null {
  const direct = normTier(value);
  if (direct) return direct;

  if (value && typeof value === "object") {
    const obj = value as { tier?: unknown; plan_tier?: unknown; meal_tier?: unknown };
    return normTier(obj.tier) ?? normTier(obj.plan_tier) ?? normTier(obj.meal_tier) ?? fallbackTier;
  }

  if (value === true || value == null) return fallbackTier;
  return fallbackTier;
}

/** Operativ BASIS/LUXUS per dag — hentes direkte fra agreements etter at daymap-viewet ble fjernet fra live DB. */
export async function fetchAgreementDayTiersForCompany(_sb: any, companyId: string): Promise<Record<DayKey, Tier>> {
  const admin = supabaseAdmin();
  const cid = safeStr(companyId);
  if (!cid) return {} as Record<DayKey, Tier>;

  const { data: agreement, error } = await admin
    .from("agreements")
    .select("id,company_id,status,tier,delivery_days,created_at,updated_at")
    .eq("company_id", cid)
    .eq("status", "ACTIVE")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const dayTiers: Record<DayKey, Tier> = {} as Record<DayKey, Tier>;
  if (error || !agreement?.id) return dayTiers;

  const fallbackTier = normTier((agreement as any).tier);
  const rawDeliveryDays = (agreement as any).delivery_days;

  if (rawDeliveryDays && typeof rawDeliveryDays === "object" && !Array.isArray(rawDeliveryDays)) {
    for (const [key, value] of Object.entries(rawDeliveryDays)) {
      const dk = normDayKey(key);
      const tier = tierFromDeliveryDayValue(value, fallbackTier);
      if (dk && tier) dayTiers[dk] = tier;
    }
    if (Object.keys(dayTiers).length > 0) return dayTiers;
  }

  const normalized = normalizeDeliveryDaysStrict(rawDeliveryDays);
  for (const day of normalized.days) {
    if (fallbackTier) dayTiers[day] = fallbackTier;
  }
  if (Object.keys(dayTiers).length > 0) return dayTiers;

  const { data: dayRows } = await (admin as any)
    .from("agreement_delivery_days")
    .select("agreement_id,weekday")
    .eq("agreement_id", (agreement as any).id);

  for (const row of dayRows ?? []) {
    const dk = normDayKey((row as any)?.weekday);
    if (dk && fallbackTier) dayTiers[dk] = fallbackTier;
  }
  return dayTiers;
}

/* =========================================================
   Main: Current agreement state (server truth)
========================================================= */

export async function getCurrentAgreementState(opts?: { rid?: string }): Promise<AgreementState | AgreementStateError> {
  const ridVal = opts?.rid ?? rid();
  const sb: any = await supabaseServer();

  // Auth
  const { data: auth, error: authErr } = await sb.auth.getUser();
  const authUserId = pickAnyUserId(auth?.user);
  if (authErr || !authUserId) {
    return { ok: false, rid: ridVal, error: "UNAUTHENTICATED", message: "Ikke innlogget.", status: 401 };
  }

  // Profile (support both id and user_id for robustness)
  const { data: profile, error: pErr } = await sb
    .from("profiles")
    .select("company_id,location_id")
    .or(`id.eq.${authUserId},user_id.eq.${authUserId}`)
    .maybeSingle();

  if (pErr) {
    return { ok: false, rid: ridVal, error: "PROFILE_LOOKUP_FAILED", message: "Kunne ikke hente profil.", status: 500 };
  }

  const companyId = safeStr(profile?.company_id);
  const locationId = profile?.location_id ? safeStr(profile.location_id) : null;

  if (!companyId) {
    return {
      ok: false,
      rid: ridVal,
      error: "PROFILE_MISSING_SCOPE",
      message: "Mangler firmatilknytning (company_id).",
      status: 403,
    };
  }

  const admin = supabaseAdmin();

  // Agreement snapshot MUST be service-role scoped after public view grants were revoked.
  const { data: agreement, error: aErr } = await admin
    .from("agreements")
    .select("id,company_id,status,delivery_days,tier,price_per_meal_nok,starts_at,ends_at,updated_at")
    .eq("company_id", companyId)
    .eq("status", "ACTIVE")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (aErr) {
    return { ok: false, rid: ridVal, error: "AGREEMENT_LOOKUP_FAILED", message: "Kunne ikke hente avtale.", status: 500 };
  }

  const dayTiers = await fetchAgreementDayTiersForCompany(sb, companyId);

  const deliveryDaysRaw = Object.keys(dayTiers) as DayKey[];
  deliveryDaysRaw.sort(dayKeySort);

  const deliveryNorm = normalizeDeliveryDaysStrict(deliveryDaysRaw);

  const basisDays = Object.values(dayTiers).filter((t) => t === "BASIS").length;
  const luxusDays = Object.values(dayTiers).filter((t) => t === "LUXUS").length;

  const agreementId = agreement?.id ? String(agreement.id) : null;
  const planTier = agreement?.tier ?? null;
  const pricePerCuvertNok = agreement?.price_per_meal_nok ?? null;
  const startDate = agreement?.starts_at ?? null;
  const endDate = agreement?.ends_at ?? null;
  const updatedAt = agreement?.updated_at ?? null;

  // Status resolution
  const active = isActiveStatus(agreement?.status);
  if (!agreement?.company_id || !active) {
    opsLog("agreement.current.not_active", {
      rid: ridVal,
      company_id: companyId,
      agreement_id: agreementId,
      status: String(agreement?.status ?? null),
    });

    return {
      ok: true,
      companyId,
      locationId,
      status: "MISSING",
      statusReason: "NO_ACTIVE_AGREEMENT",
      planTier,
      pricePerCuvertNok,
      deliveryDays: deliveryNorm.days,
      slot: "lunch",
      dayTiers,
      basisDays,
      luxusDays,
      startDate,
      endDate,
      updatedAt,
      agreementId,
    };
  }

  // ACTIVE
  return {
    ok: true,
    companyId,
    locationId,
    status: "ACTIVE",
    planTier,
    pricePerCuvertNok,
    deliveryDays: deliveryNorm.days,
    slot: "lunch",
    dayTiers,
    basisDays,
    luxusDays,
    startDate,
    endDate,
    updatedAt,
    agreementId,
  };
}
