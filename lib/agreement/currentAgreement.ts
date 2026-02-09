// lib/agreement/currentAgreement.ts
import { createClient } from "@supabase/supabase-js";
import { supabaseServer } from "@/lib/supabase/server";
import { normalizeDeliveryDaysStrict } from "@/lib/agreements/deliveryDays";
import { DAY_KEYS, type DayKey, type Tier } from "@/lib/agreements/normalize";
import { opsLog } from "@/lib/ops/log";

export type AgreementState = {
  ok: true;
  companyId: string;
  locationId: string | null;
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

type AgreementsRow = {
  id: string;
  company_id: string;
  status: string | null;
  tier: string | null;
  price_ex_vat: number | null;
  start_date: string | null;
  end_date: string | null;
  updated_at: string | null;
};

type DayRow = {
  company_id: string;
  day_key: string;
  tier: string;
  updated_at: string | null;
};

function envOrNull(v: string | undefined) {
  const s = String(v ?? "").trim();
  return s ? s : null;
}

function rid(prefix = "agreement_state") {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function normTier(v: any): Tier | null {
  const s = String(v ?? "").trim().toUpperCase();
  if (s === "BASIS" || s === "LUXUS") return s as Tier;
  return null;
}

const DAY_ALIASES: Record<string, DayKey> = {
  mon: "mon",
  monday: "mon",
  man: "mon",
  mandag: "mon",
  tue: "tue",
  tues: "tue",
  tuesday: "tue",
  tir: "tue",
  tirsdag: "tue",
  wed: "wed",
  weds: "wed",
  wednesday: "wed",
  ons: "wed",
  onsdag: "wed",
  thu: "thu",
  thur: "thu",
  thurs: "thu",
  thursday: "thu",
  tor: "thu",
  torsdag: "thu",
  fri: "fri",
  friday: "fri",
  fre: "fri",
  fredag: "fri",
};

function normDayKey(v: any): DayKey | null {
  const s = String(v ?? "").trim().toLowerCase();
  if (!s) return null;
  if ((DAY_KEYS as readonly string[]).includes(s)) return s as DayKey;
  return DAY_ALIASES[s] ?? null;
}

function logDaymapWarning(args: {
  rid: string;
  company_id: string;
  agreement_id?: string | null;
  unknown_days: string[];
  unknown_tiers: string[];
  raw: any;
}) {
  if (!args.unknown_days.length && !args.unknown_tiers.length) return;
  opsLog("agreement.daymap.warning", {
    rid: args.rid,
    company_id: args.company_id,
    agreement_id: args.agreement_id ?? null,
    unknown_days: args.unknown_days,
    unknown_tiers: args.unknown_tiers,
    raw: args.raw ?? null,
  });
}

function logDeliveryDaysWarning(args: {
  rid: string;
  company_id: string;
  agreement_id?: string | null;
  raw: any;
  unknown: string[];
  days: string[];
}) {
  if (!args.unknown.length) return;
  opsLog("agreement.delivery_days.warning", {
    rid: args.rid,
    company_id: args.company_id,
    agreement_id: args.agreement_id ?? null,
    unknown: args.unknown,
    days: args.days,
    raw: args.raw ?? null,
  });
}

/**
 * Parse day tiers from company_current_agreement_days (authoritative in this project).
 */
function parseDayTiersFromDaysTable(rows: DayRow[], ctx: { rid: string; companyId: string; agreementId?: string | null }) {
  const unknown_days: string[] = [];
  const unknown_tiers: string[] = [];
  const dayTiers: Record<DayKey, Tier> = {} as Record<DayKey, Tier>;

  for (const row of rows ?? []) {
    const dayKey = normDayKey((row as any)?.day_key);
    const tier = normTier((row as any)?.tier);
    if (!dayKey) {
      if ((row as any)?.day_key != null) unknown_days.push(String((row as any).day_key));
      continue;
    }
    if (!tier) {
      if ((row as any)?.tier != null) unknown_tiers.push(String((row as any).tier));
      continue;
    }
    dayTiers[dayKey] = tier;
  }

  logDaymapWarning({
    rid: ctx.rid,
    company_id: ctx.companyId,
    agreement_id: ctx.agreementId ?? null,
    unknown_days,
    unknown_tiers,
    raw: rows ?? null,
  });

  return dayTiers;
}

function isActiveStatus(v: any) {
  return String(v ?? "").trim().toLowerCase() === "active";
}

function dayKeySort(a: DayKey, b: DayKey) {
  return DAY_KEYS.indexOf(a) - DAY_KEYS.indexOf(b);
}

/**
 * Agreement source of truth:
 * - Pricing/period/status: public.agreements (FK -> companies)
 * - Day mapping: public.company_current_agreement_days (company_id, day_key, tier)
 *
 * This function MUST output dayTiers + deliveryDays so /week can be ACTIVE.
 */
export async function getCurrentAgreementState(opts?: { rid?: string }): Promise<AgreementState | AgreementStateError> {
  const ridVal = opts?.rid ?? rid();

  const sb = await supabaseServer();
  const { data: auth, error: authErr } = await sb.auth.getUser();
  if (authErr || !auth?.user) {
    return { ok: false, rid: ridVal, error: "UNAUTHENTICATED", message: "Ikke innlogget.", status: 401 };
  }

  const { data: profile, error: pErr } = await (sb as any)
    .from("profiles")
    .select("id, user_id, company_id, location_id")
    .or(`id.eq.${auth.user.id},user_id.eq.${auth.user.id}`)
    .maybeSingle();

  if (pErr) {
    return { ok: false, rid: ridVal, error: "PROFILE_LOOKUP_FAILED", message: "Kunne ikke hente profil.", status: 500 };
  }

  const companyId = String(profile?.company_id ?? "").trim();
  const locationId = profile?.location_id ? String(profile.location_id) : null;

  if (!companyId) {
    return {
      ok: false,
      rid: ridVal,
      error: "PROFILE_MISSING_SCOPE",
      message: "Mangler firmatilknytning (company_id).",
      status: 403,
    };
  }

  // Prefer service-role for agreement/daymap reads (avoid RLS surprises).
  const url = envOrNull(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const service = envOrNull(process.env.SUPABASE_SERVICE_ROLE_KEY);

  const admin =
    url && service
      ? createClient(url, service, {
          auth: { persistSession: false, autoRefreshToken: false },
          global: { headers: { "X-Client-Info": "lunchportalen-current-agreement" } },
        })
      : null;

  const client: any = admin ?? sb;

  // 1) Latest agreement row (status/pricing/period). Do NOT require ACTIVE here.
  let agreement: AgreementsRow | null = null;
  try {
    const { data, error } = await client
      .from("agreements")
      .select("id,company_id,status,tier,price_ex_vat,start_date,end_date,updated_at,created_at")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      return { ok: false, rid: ridVal, error: "AGREEMENT_LOOKUP_FAILED", message: "Kunne ikke hente avtale.", status: 500 };
    }
    agreement = (data ?? null) as AgreementsRow | null;
  } catch (e: any) {
    return {
      ok: false,
      rid: ridVal,
      error: "AGREEMENT_LOOKUP_FAILED",
      message: "Kunne ikke hente avtale.",
      status: 500,
    };
  }

  const agreementId = agreement?.id ? String(agreement.id) : null;

  // 2) Day mapping from company_current_agreement_days (authoritative)
  let dayRows: DayRow[] = [];
  try {
    const { data, error } = await client
      .from("company_current_agreement_days")
      .select("company_id,day_key,tier,updated_at")
      .eq("company_id", companyId);

    if (error) {
      return { ok: false, rid: ridVal, error: "DAYMAP_LOOKUP_FAILED", message: "Kunne ikke hente dagoppsett.", status: 500 };
    }
    dayRows = (Array.isArray(data) ? data : []) as DayRow[];
  } catch {
    return { ok: false, rid: ridVal, error: "DAYMAP_LOOKUP_FAILED", message: "Kunne ikke hente dagoppsett.", status: 500 };
  }

  const dayTiers = parseDayTiersFromDaysTable(dayRows, { rid: ridVal, companyId, agreementId });

  const deliveryDaysRaw = Object.keys(dayTiers) as DayKey[];
  deliveryDaysRaw.sort(dayKeySort);

  const deliveryNorm = normalizeDeliveryDaysStrict(deliveryDaysRaw);
  logDeliveryDaysWarning({
    rid: ridVal,
    company_id: companyId,
    agreement_id: agreementId,
    raw: deliveryDaysRaw,
    unknown: deliveryNorm.unknown,
    days: deliveryNorm.days,
  });

  const basisDays = Object.values(dayTiers).filter((t) => t === "BASIS").length;
  const luxusDays = Object.values(dayTiers).filter((t) => t === "LUXUS").length;

  const hasDaymap = Object.keys(dayTiers).length > 0;
  const hasDeliveryDays = deliveryNorm.days.length > 0;

  // 3) Determine final state
  // If we have a daymap, we consider the agreement usable even if pricing row is missing,
  // but we still surface statusReason for ops.
  const agreementRowActive = isActiveStatus(agreement?.status);

  if (!hasDaymap) {
    return {
      ok: true,
      companyId,
      locationId,
      status: "MISSING",
      statusReason: "MISSING_DAYMAP",
      planTier: agreement?.tier ?? null,
      pricePerCuvertNok: agreement?.price_ex_vat ?? null,
      deliveryDays: [],
      slot: "lunch",
      dayTiers,
      basisDays,
      luxusDays,
      startDate: agreement?.start_date ?? null,
      endDate: agreement?.end_date ?? null,
      updatedAt: agreement?.updated_at ?? null,
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
      planTier: agreement?.tier ?? null,
      pricePerCuvertNok: agreement?.price_ex_vat ?? null,
      deliveryDays: [],
      slot: "lunch",
      dayTiers,
      basisDays,
      luxusDays,
      startDate: agreement?.start_date ?? null,
      endDate: agreement?.end_date ?? null,
      updatedAt: agreement?.updated_at ?? null,
      agreementId,
    };
  }

  // If agreement row is missing, we still allow ACTIVE based on daymap (your "both!" requirement),
  // but we mark statusReason for observability.
  if (!agreement?.company_id) {
    opsLog("agreement.missing.pricing_row", {
      rid: ridVal,
      company_id: companyId,
      note: "No row in agreements; daymap present => ACTIVE by daymap.",
    });

    return {
      ok: true,
      companyId,
      locationId,
      status: "ACTIVE",
      statusReason: "NO_ACTIVE_AGREEMENT",
      planTier: null,
      pricePerCuvertNok: null,
      deliveryDays: deliveryNorm.days,
      slot: "lunch",
      dayTiers,
      basisDays,
      luxusDays,
      startDate: null,
      endDate: null,
      updatedAt: null,
      agreementId: null,
    };
  }

  // Agreement row exists:
  // Treat as ACTIVE if status is active (case-insensitive). If not, we still keep ACTIVE if daymap exists,
  // but surface NO_ACTIVE_AGREEMENT (this prevents /week dead-ends while still observable).
  if (!agreementRowActive) {
    opsLog("agreement.pricing_row.not_active", {
      rid: ridVal,
      company_id: companyId,
      agreement_id: agreementId,
      status: String(agreement?.status ?? null),
      note: "Pricing row not active; daymap present => ACTIVE by daymap (no dead-end).",
    });

    return {
      ok: true,
      companyId,
      locationId,
      status: "ACTIVE",
      statusReason: "NO_ACTIVE_AGREEMENT",
      planTier: agreement?.tier ?? null,
      pricePerCuvertNok: agreement?.price_ex_vat ?? null,
      deliveryDays: deliveryNorm.days,
      slot: "lunch",
      dayTiers,
      basisDays,
      luxusDays,
      startDate: agreement?.start_date ?? null,
      endDate: agreement?.end_date ?? null,
      updatedAt: agreement?.updated_at ?? null,
      agreementId,
    };
  }

  return {
    ok: true,
    companyId,
    locationId,
    status: "ACTIVE",
    planTier: agreement?.tier ?? null,
    pricePerCuvertNok: agreement?.price_ex_vat ?? null,
    deliveryDays: deliveryNorm.days,
    slot: "lunch",
    dayTiers,
    basisDays,
    luxusDays,
    startDate: agreement?.start_date ?? null,
    endDate: agreement?.end_date ?? null,
    updatedAt: agreement?.updated_at ?? null,
    agreementId,
  };
}
