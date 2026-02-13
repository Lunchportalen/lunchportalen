// lib/agreement/currentAgreement.ts
import { supabaseServer } from "@/lib/supabase/server";
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
  // - ACTIVE is allowed if daymap exists (even if agreement snapshot isn't ACTIVE),
  //   because daymap = operational truth in your system
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

  // Agreement snapshot MUST be from "company_current_agreement"
  const { data: agreement, error: aErr } = await sb
    .from("company_current_agreement")
    .select("id,company_id,status,delivery_days,plan_tier,price_per_cuvert_nok,start_date,end_date,updated_at")
    .eq("company_id", companyId)
    .maybeSingle();

  if (aErr) {
    return { ok: false, rid: ridVal, error: "AGREEMENT_LOOKUP_FAILED", message: "Kunne ikke hente avtale.", status: 500 };
  }

  // Daymap MUST be from "v_company_current_agreement_daymap"
  // (mock may return thenable; await works)
  const daymapRes = await sb
    .from("v_company_current_agreement_daymap")
    .select("company_id,day_key,tier,slot,updated_at")
    .eq("company_id", companyId);

  const dayRows = Array.isArray(daymapRes?.data) ? daymapRes.data : [];
  const dayTiers: Record<DayKey, Tier> = {} as any;

  for (const row of dayRows) {
    const dk = normDayKey((row as any)?.day_key);
    const t = normTier((row as any)?.tier);
    if (dk && t) dayTiers[dk] = t;
  }

  const deliveryDaysRaw = Object.keys(dayTiers) as DayKey[];
  deliveryDaysRaw.sort(dayKeySort);

  const deliveryNorm = normalizeDeliveryDaysStrict(deliveryDaysRaw);

  const basisDays = Object.values(dayTiers).filter((t) => t === "BASIS").length;
  const luxusDays = Object.values(dayTiers).filter((t) => t === "LUXUS").length;

  const hasDaymap = Object.keys(dayTiers).length > 0;
  const hasDeliveryDays = deliveryNorm.days.length > 0;

  const agreementId = agreement?.id ? String(agreement.id) : null;
  const planTier = agreement?.plan_tier ?? null;
  const pricePerCuvertNok = agreement?.price_per_cuvert_nok ?? null;
  const startDate = agreement?.start_date ?? null;
  const endDate = agreement?.end_date ?? null;
  const updatedAt = agreement?.updated_at ?? null;

  // Status resolution
  if (!hasDaymap) {
    return {
      ok: true,
      companyId,
      locationId,
      status: "MISSING",
      statusReason: "MISSING_DAYMAP",
      planTier,
      pricePerCuvertNok,
      deliveryDays: [],
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

  if (!hasDeliveryDays) {
    return {
      ok: true,
      companyId,
      locationId,
      status: "MISSING",
      statusReason: "MISSING_DELIVERY_DAYS",
      planTier,
      pricePerCuvertNok,
      deliveryDays: [],
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

  // If agreement missing or not ACTIVE, keep ACTIVE by daymap but mark reason
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
      status: "ACTIVE",
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
