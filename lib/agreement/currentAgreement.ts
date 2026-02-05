// lib/agreement/currentAgreement.ts
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

type AgreementRow = {
  id?: string | null;
  company_id?: string | null;
  status?: string | null;
  plan_tier?: string | null;
  price_per_cuvert_nok?: number | null;
  delivery_days?: any;
  start_date?: string | null;
  end_date?: string | null;
  updated_at?: string | null;
};

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

function parseDayTiers(rows: any[], ctx: { rid: string; companyId: string; agreementId?: string | null }) {
  const unknown_days: string[] = [];
  const unknown_tiers: string[] = [];
  const dayTiers: Record<DayKey, Tier> = {} as Record<DayKey, Tier>;

  const first = rows?.[0] ?? null;
  const daymapRaw = first && typeof first === "object" ? (first as any).day_tiers ?? null : null;

  if (daymapRaw) {
    let obj: any = null;
    if (typeof daymapRaw === "string") {
      try {
        obj = JSON.parse(daymapRaw);
      } catch {
        obj = null;
      }
    } else if (typeof daymapRaw === "object") {
      obj = daymapRaw;
    }

    if (obj && typeof obj === "object") {
      for (const [k, v] of Object.entries(obj)) {
        const dayKey = normDayKey(k);
        const tier = normTier(v);
        if (!dayKey) {
          unknown_days.push(String(k));
          continue;
        }
        if (!tier) {
          unknown_tiers.push(String(v ?? ""));
          continue;
        }
        dayTiers[dayKey] = tier;
      }
    }
  } else {
    for (const row of rows ?? []) {
      const dayKey = normDayKey((row as any)?.day_key ?? (row as any)?.day ?? (row as any)?.weekday ?? null);
      const tier = normTier((row as any)?.tier ?? (row as any)?.plan_tier ?? (row as any)?.level ?? null);
      if (!dayKey) {
        const rawDay = (row as any)?.day_key ?? (row as any)?.day ?? (row as any)?.weekday ?? null;
        if (rawDay != null) unknown_days.push(String(rawDay));
        continue;
      }
      if (!tier) {
        const rawTier = (row as any)?.tier ?? (row as any)?.plan_tier ?? (row as any)?.level ?? null;
        if (rawTier != null) unknown_tiers.push(String(rawTier));
        continue;
      }
      dayTiers[dayKey] = tier;
    }
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

export async function getCurrentAgreementState(opts?: { rid?: string }): Promise<AgreementState | AgreementStateError> {
  const ridVal = opts?.rid ?? rid();

  const sb = await supabaseServer();
  const { data: auth, error: authErr } = await sb.auth.getUser();
  if (authErr || !auth?.user) {
    return { ok: false, rid: ridVal, error: "UNAUTHENTICATED", message: "Ikke innlogget.", status: 401 };
  }

  const { data: profile, error: pErr } = await sb
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

  const { data: agreementRow, error: aErr } = await sb
    .from("company_current_agreement")
    .select("id,company_id,status,plan_tier,price_per_cuvert_nok,delivery_days,start_date,end_date,updated_at")
    .eq("company_id", companyId)
    .eq("status", "ACTIVE")
    .maybeSingle();

  if (aErr) {
    return { ok: false, rid: ridVal, error: "AGREEMENT_LOOKUP_FAILED", message: "Kunne ikke hente avtale.", status: 500 };
  }

  const agreement = (agreementRow ?? null) as AgreementRow | null;
  if (!agreement?.company_id) {
    return {
      ok: true,
      companyId,
      locationId,
      status: "MISSING",
      statusReason: "NO_ACTIVE_AGREEMENT",
      planTier: null,
      pricePerCuvertNok: null,
      deliveryDays: [],
      slot: "lunch",
      dayTiers: {} as Record<DayKey, Tier>,
      basisDays: 0,
      luxusDays: 0,
      startDate: null,
      endDate: null,
      updatedAt: null,
      agreementId: null,
    };
  }

  const agreementId = String(agreement?.id ?? "").trim() || null;

  const deliveryNorm = normalizeDeliveryDaysStrict(agreement?.delivery_days);
  logDeliveryDaysWarning({
    rid: ridVal,
    company_id: companyId,
    agreement_id: agreementId,
    raw: agreement?.delivery_days ?? null,
    unknown: deliveryNorm.unknown,
    days: deliveryNorm.days,
  });

  const { data: daymapRows, error: dmErr } = await sb
    .from("v_company_current_agreement_daymap")
    .select("*")
    .eq("company_id", companyId)
    .eq("slot", "lunch");

  if (dmErr) {
    return { ok: false, rid: ridVal, error: "DAYMAP_LOOKUP_FAILED", message: "Kunne ikke hente dagoppsett.", status: 500 };
  }

  const dayTiers = parseDayTiers(daymapRows ?? [], { rid: ridVal, companyId, agreementId });

  const basisDays = Object.values(dayTiers).filter((t) => t === "BASIS").length;
  const luxusDays = Object.values(dayTiers).filter((t) => t === "LUXUS").length;

  if (!deliveryNorm.days.length) {
    return {
      ok: true,
      companyId,
      locationId,
      status: "MISSING",
      statusReason: "MISSING_DELIVERY_DAYS",
      planTier: agreement.plan_tier ?? null,
      pricePerCuvertNok: agreement.price_per_cuvert_nok ?? null,
      deliveryDays: [],
      slot: "lunch",
      dayTiers,
      basisDays,
      luxusDays,
      startDate: agreement.start_date ?? null,
      endDate: agreement.end_date ?? null,
      updatedAt: agreement.updated_at ?? null,
      agreementId,
    };
  }

  if (!Object.keys(dayTiers).length) {
    return {
      ok: true,
      companyId,
      locationId,
      status: "MISSING",
      statusReason: "MISSING_DAYMAP",
      planTier: agreement.plan_tier ?? null,
      pricePerCuvertNok: agreement.price_per_cuvert_nok ?? null,
      deliveryDays: deliveryNorm.days,
      slot: "lunch",
      dayTiers,
      basisDays,
      luxusDays,
      startDate: agreement.start_date ?? null,
      endDate: agreement.end_date ?? null,
      updatedAt: agreement.updated_at ?? null,
      agreementId,
    };
  }

  return {
    ok: true,
    companyId,
    locationId,
    status: "ACTIVE",
    planTier: agreement.plan_tier ?? null,
    pricePerCuvertNok: agreement.price_per_cuvert_nok ?? null,
    deliveryDays: deliveryNorm.days,
    slot: "lunch",
    dayTiers,
    basisDays,
    luxusDays,
    startDate: agreement.start_date ?? null,
    endDate: agreement.end_date ?? null,
    updatedAt: agreement.updated_at ?? null,
    agreementId,
  };
}
