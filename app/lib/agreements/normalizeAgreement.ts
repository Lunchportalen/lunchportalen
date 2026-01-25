// lib/agreements/normalizeAgreement.ts
// ✅ FASIT: Normaliserer avtale til "version:1" med tiers + schedule (mon–fri)
// - Støtter både FORMAT A (tiers+schedule) og FORMAT B (plan.days.* fra eksisterende DB)
// - Gir presise feilkoder (AgreementInvalid)
// - resolveTierForDate() returnerer { tier, price } og feiler for helg
// - Ingen sideeffekter, trygg å bruke i både server og client

export type DayKey = "mon" | "tue" | "wed" | "thu" | "fri";
export type TierKey = string;

export type AgreementNormalized = {
  ok: true;
  version: 1;
  timezone: string;
  cutoffTime: string; // HH:MM
  tiers: Record<TierKey, { label: string; price: number }>;
  schedule: Record<DayKey, { tier: TierKey; price: number }>;
  commercial: { bindingMonths: number; noticeMonths: number };
};

export type AgreementInvalid = {
  ok: false;
  error:
    | "AGREEMENT_NOT_OBJECT"
    | "AGREEMENT_MISSING_TIERS"
    | "AGREEMENT_MISSING_SCHEDULE"
    | "AGREEMENT_DAY_MISSING_TIER"
    | "AGREEMENT_TIER_UNKNOWN"
    | "AGREEMENT_TIER_INVALID_PRICE"
    | "AGREEMENT_DAY_DISABLED";
  message: string;
  detail?: any;
};

export type AgreementResult = AgreementNormalized | AgreementInvalid;

export function isAgreementInvalid(a: AgreementResult): a is AgreementInvalid {
  return a.ok === false;
}

const DAY_KEYS: ReadonlyArray<DayKey> = ["mon", "tue", "wed", "thu", "fri"];

function isPlainObject(v: any): v is Record<string, any> {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

function isTimeHHMM(v: any): v is string {
  return typeof v === "string" && /^\d{2}:\d{2}$/.test(v);
}

/** Accept HH:MM or HH:MM:SS -> return HH:MM */
function normalizeCutoffTime(v: any): string {
  const s = String(v ?? "").trim();
  if (/^\d{2}:\d{2}$/.test(s)) return s;
  if (/^\d{2}:\d{2}:\d{2}$/.test(s)) return s.slice(0, 5);
  return "08:00";
}

function posInt(v: any, fallback: number) {
  const n = Number(v);
  if (Number.isFinite(n) && n > 0) return Math.floor(n);
  return fallback;
}

function normalizeTierKey(v: any): string {
  return String(v ?? "").trim().toUpperCase();
}

function normalizeLabel(v: any, fallback: string) {
  const s = String(v ?? "").trim();
  return s.length ? s : fallback;
}

/**
 * Canonical: price EX VAT (matches Lunchportalen 90/130)
 * - Accepts numbers or numeric strings
 * - Returns NaN if invalid
 */
function normalizePrice(v: any): number {
  const n = typeof v === "string" ? Number(v.trim().replace(",", ".")) : Number(v);
  if (!Number.isFinite(n)) return NaN;
  return n;
}

/** FORMAT A helper */
function normalizeTiers(raw: any): Record<TierKey, { label: string; price: number }> {
  const out: Record<TierKey, { label: string; price: number }> = {};
  if (!isPlainObject(raw)) return out;

  for (const [k, val] of Object.entries(raw)) {
    const key = normalizeTierKey(k);
    if (!key) continue;

    const label = normalizeLabel((val as any)?.label, key);
    const price = normalizePrice((val as any)?.price);

    if (!Number.isFinite(price) || price <= 0) continue;

    out[key] = { label, price };
  }

  return out;
}

/**
 * Support BOTH formats:
 * A) Recommended:
 *   {
 *     timezone:"Europe/Oslo",
 *     cutoff:{time:"08:00"},
 *     commercial:{bindingMonths:12, noticeMonths:3},
 *     tiers:{BASIS:{label:"Basis",price:90}, LUXUS:{label:"Luxus",price:130}},
 *     schedule:{mon:{tier:"BASIS"}, ...}
 *   }
 *
 * B) Existing in DB:
 *   {
 *     cutoff:{time:"08:00", timezone:"Europe/Oslo"},
 *     commercial:{bindingMonths:12, noticeMonths:3},
 *     plan:{ days:{
 *       mon:{tier:"BASIS", enabled:true, price_ex_vat:90},
 *       ...
 *     } }
 *   }
 */
export function normalizeAgreement(input: any): AgreementResult {
  if (!isPlainObject(input)) {
    return {
      ok: false,
      error: "AGREEMENT_NOT_OBJECT",
      message: "agreement_json must be a JSON object.",
      detail: { got: typeof input, value: input ?? null },
    };
  }

  // timezone + cutoff
  const timezone = String((input as any).timezone ?? (input as any)?.cutoff?.timezone ?? "Europe/Oslo").trim() || "Europe/Oslo";
  const cutoffTime = normalizeCutoffTime((input as any)?.cutoff?.time);

  // commercial
  const commercial = {
    bindingMonths: posInt((input as any)?.commercial?.bindingMonths ?? 12, 12),
    noticeMonths: posInt((input as any)?.commercial?.noticeMonths ?? 3, 3),
  };

  // ---------------------------------------------------------
  // FORMAT B: plan.days.*
  // ---------------------------------------------------------
  const planDays = (input as any)?.plan?.days;
  if (isPlainObject(planDays)) {
    const tiers: Record<TierKey, { label: string; price: number }> = {};
    const schedule: AgreementNormalized["schedule"] = {} as any;

    for (const day of DAY_KEYS) {
      const d = (planDays as any)[day];

      if (!isPlainObject(d)) {
        return {
          ok: false,
          error: "AGREEMENT_DAY_MISSING_TIER",
          message: `plan.days is missing object for ${day}.`,
          detail: { day, value: d ?? null },
        };
      }

      const enabled = Boolean((d as any).enabled);
      if (!enabled) {
        return {
          ok: false,
          error: "AGREEMENT_DAY_DISABLED",
          message: `Day ${day} is disabled in agreement plan.`,
          detail: { day, enabled },
        };
      }

      const tierKey = normalizeTierKey((d as any).tier);
      if (!tierKey) {
        return {
          ok: false,
          error: "AGREEMENT_DAY_MISSING_TIER",
          message: `plan.days.${day} is missing tier.`,
          detail: { day, d },
        };
      }

      // Prefer price_ex_vat as canonical
      const price = normalizePrice((d as any).price_ex_vat ?? (d as any).price ?? (d as any).price_inc_vat);
      if (!Number.isFinite(price) || price <= 0) {
        return {
          ok: false,
          error: "AGREEMENT_TIER_INVALID_PRICE",
          message: `plan.days.${day} has invalid price_ex_vat.`,
          detail: {
            day,
            tier: tierKey,
            price_ex_vat: (d as any).price_ex_vat,
            price: (d as any).price,
            price_inc_vat: (d as any).price_inc_vat,
          },
        };
      }

      if (!tiers[tierKey]) tiers[tierKey] = { label: tierKey, price };
      schedule[day] = { tier: tierKey, price };
    }

    if (Object.keys(tiers).length === 0) {
      return {
        ok: false,
        error: "AGREEMENT_MISSING_TIERS",
        message: "Agreement is missing valid tiers with price.",
        detail: { planDays },
      };
    }

    return {
      ok: true,
      version: 1,
      timezone,
      cutoffTime,
      tiers,
      schedule,
      commercial,
    };
  }

  // ---------------------------------------------------------
  // FORMAT A: tiers + schedule
  // ---------------------------------------------------------
  const tiers = normalizeTiers((input as any).tiers);
  if (Object.keys(tiers).length === 0) {
    return {
      ok: false,
      error: "AGREEMENT_MISSING_TIERS",
      message: "Agreement is missing valid tiers with price.",
      detail: { tiers: (input as any).tiers ?? null, hint: "Expected agreement_json.tiers or agreement_json.plan.days" },
    };
  }

  const scheduleRaw = (input as any).schedule;
  if (!isPlainObject(scheduleRaw)) {
    return {
      ok: false,
      error: "AGREEMENT_MISSING_SCHEDULE",
      message: "Agreement is missing schedule (mon–fri).",
      detail: { schedule: scheduleRaw ?? null, hint: "Expected agreement_json.schedule or agreement_json.plan.days" },
    };
  }

  const schedule: AgreementNormalized["schedule"] = {} as any;

  for (const day of DAY_KEYS) {
    const dayObj = (scheduleRaw as any)[day];
    const tierKey = normalizeTierKey(dayObj?.tier);
    if (!tierKey) {
      return {
        ok: false,
        error: "AGREEMENT_DAY_MISSING_TIER",
        message: `Schedule is missing tier for ${day}.`,
        detail: { day, scheduleDay: dayObj ?? null },
      };
    }

    const tier = tiers[tierKey];
    if (!tier) {
      return {
        ok: false,
        error: "AGREEMENT_TIER_UNKNOWN",
        message: `Schedule tier '${tierKey}' for ${day} is not defined in tiers.`,
        detail: { day, tier: tierKey, tiers: Object.keys(tiers) },
      };
    }

    // schedule price always derived from tier.price (canonical)
    if (!Number.isFinite(tier.price) || tier.price <= 0) {
      return {
        ok: false,
        error: "AGREEMENT_TIER_INVALID_PRICE",
        message: `Tier '${tierKey}' has invalid price.`,
        detail: { tier: tierKey, price: tier.price },
      };
    }

    schedule[day] = { tier: tierKey, price: tier.price };
  }

  return {
    ok: true,
    version: 1,
    timezone,
    cutoffTime,
    tiers,
    schedule,
    commercial,
  };
}

/**
 * Resolve tier+price for a given ISO date (YYYY-MM-DD).
 * Uses UTC weekday mapping to keep it deterministic.
 * Throws for weekend (portal is mon–fri only).
 */
export function resolveTierForDate(agreement: AgreementNormalized, dateISO: string) {
  const s = String(dateISO ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    throw new Error(`Invalid dateISO '${s}'. Expected YYYY-MM-DD.`);
  }

  // Use UTC to avoid local timezone shifting the date
  const d = new Date(s + "T00:00:00.000Z");
  const js = d.getUTCDay(); // 0 Sun .. 6 Sat

  const day: DayKey | null =
    js === 1 ? "mon" :
    js === 2 ? "tue" :
    js === 3 ? "wed" :
    js === 4 ? "thu" :
    js === 5 ? "fri" : null;

  if (!day) {
    throw new Error("Weekend is not supported in Lunchportalen schedule (mon–fri).");
  }

  const row = agreement.schedule[day];
  // Defensive (should never happen if normalized)
  if (!row || !row.tier) {
    throw new Error(`Agreement schedule missing for ${day}.`);
  }

  return row; // { tier, price }
}
