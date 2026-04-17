/** Operativ registreringsmodell: firmaadmins BASIS/Luxus per ukedag (man–fre). */
export const REGISTRATION_WEEKDAYS = ["mon", "tue", "wed", "thu", "fri"] as const;
export type RegistrationWeekday = (typeof REGISTRATION_WEEKDAYS)[number];
export type WeekdayMealTiers = Record<RegistrationWeekday, "BASIS" | "LUXUS">;

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

function normTier(v: unknown): "BASIS" | "LUXUS" | null {
  const s = safeStr(v).toUpperCase();
  if (s === "BASIS" || s === "LUXUS") return s;
  return null;
}

/** Leser lagret jsonb-rad (company_registrations.weekday_meal_tiers). */
export function parseWeekdayMealTiersFromJson(raw: unknown): WeekdayMealTiers | null {
  if (!isPlainObject(raw)) return null;
  const out = {} as Partial<WeekdayMealTiers>;
  for (const d of REGISTRATION_WEEKDAYS) {
    if (!(d in raw)) return null;
    const t = normTier((raw as Record<string, unknown>)[d]);
    if (!t) return null;
    out[d] = t;
  }
  return out as WeekdayMealTiers;
}

export type RegistrationCommercialFields = {
  delivery_window_from: string;
  delivery_window_to: string;
  terms_binding_months: number;
  terms_notice_months: number;
};

function isHHMM(v: string) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(v);
}

/** Tolker request-body (public register-company). */
export function parseRegistrationPlanPayload(body: Record<string, unknown>): {
  ok: true;
  weekday_meal_tiers: WeekdayMealTiers;
  commercial: RegistrationCommercialFields;
} | { ok: false; code: string; message: string } {
  const w = body.weekday_meal_tiers ?? body.weekdayMealTiers;
  if (!isPlainObject(w)) {
    return { ok: false, code: "WEEKDAY_MEAL_TIERS_REQUIRED", message: "Velg Basis eller Luxus for alle ukedager (man–fre)." };
  }
  const tiers = parseWeekdayMealTiersFromJson(w);
  if (!tiers) {
    return { ok: false, code: "WEEKDAY_MEAL_TIERS_INVALID", message: "Ugyldig ukedagsplan (forventet BASIS eller LUXUS per dag)." };
  }

  const wf = safeStr(body.delivery_window_from ?? body.deliveryWindowFrom);
  const wt = safeStr(body.delivery_window_to ?? body.deliveryWindowTo);
  const wfN = wf.length === 5 ? wf : wf.length >= 8 ? wf.slice(0, 5) : "";
  const wtN = wt.length === 5 ? wt : wt.length >= 8 ? wt.slice(0, 5) : "";
  if (!isHHMM(wfN) || !isHHMM(wtN) || wfN >= wtN) {
    return {
      ok: false,
      code: "DELIVERY_WINDOW_INVALID",
      message: "Leveringsvindu må være gyldig (HH:MM–HH:MM, f.eks. 11:00–13:00).",
    };
  }

  const bm = Number(body.terms_binding_months ?? body.binding_months ?? body.bindingMonths);
  const nm = Number(body.terms_notice_months ?? body.notice_months ?? body.noticeMonths);
  if (!Number.isFinite(bm) || bm < 1) {
    return { ok: false, code: "TERMS_BINDING_INVALID", message: "Binding (måneder) må være minst 1." };
  }
  if (!Number.isFinite(nm) || nm < 0) {
    return { ok: false, code: "TERMS_NOTICE_INVALID", message: "Oppsigelse (måneder) må være 0 eller mer." };
  }

  return {
    ok: true,
    weekday_meal_tiers: tiers,
    commercial: {
      delivery_window_from: wfN,
      delivery_window_to: wtN,
      terms_binding_months: Math.floor(bm),
      terms_notice_months: Math.floor(nm),
    },
  };
}

export function mergeRegistrationPlanIntoAgreementJson(opts: {
  existing: unknown;
  weekday_meal_tiers: WeekdayMealTiers;
  commercial: RegistrationCommercialFields;
  /** Eks. 0.25 — samme som onboarding forhåndsvisning */
  vatRate: number;
  priceBasisExVat: number;
  priceLuxusExVat: number;
  /** ISO datetime for agreement_json.created_at når felt mangler */
  createdAtIso: string;
}): Record<string, unknown> {
  const base: Record<string, unknown> = isPlainObject(opts.existing)
    ? { ...(opts.existing as Record<string, unknown>) }
    : { version: 1 };
  const vat = Number.isFinite(opts.vatRate) && opts.vatRate >= 0 ? opts.vatRate : 0.25;
  const roundNok = (n: number) => Math.round(n * 100) / 100;

  const days: Record<string, unknown> = {};
  for (const d of REGISTRATION_WEEKDAYS) {
    const t = opts.weekday_meal_tiers[d];
    const pEx = t === "LUXUS" ? opts.priceLuxusExVat : opts.priceBasisExVat;
    const pInc = roundNok(pEx * (1 + vat));
    days[d] = {
      enabled: true,
      tier: t,
      price_ex_vat: pEx,
      price_inc_vat: pInc,
    };
  }

  const prevPlan = isPlainObject(base.plan) ? (base.plan as Record<string, unknown>) : {};
  base.plan = { ...prevPlan, days };

  const prevTerms = isPlainObject(base.terms) ? (base.terms as Record<string, unknown>) : {};
  base.terms = {
    ...prevTerms,
    binding_months: opts.commercial.terms_binding_months,
    notice_months: opts.commercial.terms_notice_months,
  };

  const prevDel = isPlainObject(base.delivery) ? (base.delivery as Record<string, unknown>) : {};
  base.delivery = {
    ...prevDel,
    window_from: opts.commercial.delivery_window_from,
    window_to: opts.commercial.delivery_window_to,
  };

  if (base.created_at == null || safeStr(base.created_at) === "") {
    base.created_at = opts.createdAtIso;
  }

  return base;
}
