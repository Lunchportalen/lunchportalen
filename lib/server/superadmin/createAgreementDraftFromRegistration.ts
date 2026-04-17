import "server-only";

import { writeAuditEvent } from "@/lib/audit/write";
import { normalizeDeliveryDaysStrict } from "@/lib/agreements/deliveryDays";
import { isIsoDate } from "@/lib/date/oslo";
import { getProductPlan } from "@/lib/cms/getProductPlan";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { parseMealContractFromAgreementJson } from "@/lib/server/agreements/mealContract";
import { validateMealContractForAgreementWrite } from "@/lib/server/agreements/submitAgreement";
import {
  REGISTRATION_WEEKDAYS as WEEKDAYS,
  mergeRegistrationPlanIntoAgreementJson,
  type RegistrationWeekday,
} from "@/lib/registration/weekdayMealTiers";

import { loadCompanyRegistrationDetail } from "./loadCompanyRegistrationsInbox";

export type AgreementWeekday = RegistrationWeekday;

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}

function isUuid(v: string) {
  return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/.test(v);
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

type CreateRpcOut = {
  agreement_id?: unknown;
  company_id?: unknown;
  status?: unknown;
} | null;

export type DerivedPendingAgreementRpc = {
  tier: "BASIS" | "LUXUS";
  delivery_days: AgreementWeekday[];
  slot_start: string;
  slot_end: string;
  starts_at: string;
  binding_months: number;
  notice_months: number;
  price_per_employee: number;
};

function normalizeHHMM(v: unknown): string | null {
  const s = String(v ?? "").trim();
  if (/^([01]\d|2[0-3]):[0-5]\d$/.test(s)) return s;
  if (/^([01]\d|2[0-3]):[0-5]\d:\d{2}$/.test(s)) return s.slice(0, 5);
  return null;
}

function normalizeTierRpc(v: unknown): "BASIS" | "LUXUS" | null {
  const s = String(v ?? "").trim().toUpperCase();
  if (s === "BASIS" || s === "LUXUS") return s;
  return null;
}

function normalizePriceNum(v: unknown): number {
  const n = typeof v === "string" ? Number(v.trim().replace(",", ".")) : Number(v);
  if (!Number.isFinite(n)) return NaN;
  return n;
}

function dayEnabled(d: Record<string, unknown>): boolean {
  if ("enabled" in d) return Boolean((d as { enabled?: unknown }).enabled);
  if ("selected" in d) return Boolean((d as { selected?: unknown }).selected);
  if ("active" in d) return Boolean((d as { active?: unknown }).active);
  return false;
}

function readBindingNotice(aj: Record<string, unknown>): { binding: number; notice: number } | null {
  const c = aj.commercial;
  if (isPlainObject(c)) {
    const b = Number((c as { bindingMonths?: unknown }).bindingMonths);
    const n = Number((c as { noticeMonths?: unknown }).noticeMonths);
    if (Number.isFinite(b) && b > 0 && Number.isFinite(n) && n >= 0) {
      return { binding: Math.floor(b), notice: Math.floor(n) };
    }
  }
  const t = aj.terms;
  if (isPlainObject(t)) {
    const b = Number((t as { binding_months?: unknown }).binding_months);
    const n = Number((t as { notice_months?: unknown }).notice_months);
    if (Number.isFinite(b) && b > 0 && Number.isFinite(n) && n >= 0) {
      return { binding: Math.floor(b), notice: Math.floor(n) };
    }
  }
  return null;
}

function readStartsAtIso(aj: Record<string, unknown>): string | null {
  const plan = isPlainObject(aj.plan) ? aj.plan : null;
  const agreement = isPlainObject(aj.agreement) ? aj.agreement : null;
  const candidates: unknown[] = [
    aj.starts_at,
    aj.start_date,
    plan?.starts_at,
    plan?.start_date,
    agreement && isPlainObject(agreement) ? (agreement as { starts_at?: unknown }).starts_at : null,
    aj.effective_from,
  ];
  for (const v of candidates) {
    const s = String(v ?? "").trim();
    if (isIsoDate(s)) return s;
  }
  const created = String(aj.created_at ?? "").trim();
  const m = created.match(/^(\d{4}-\d{2}-\d{2})/);
  if (m?.[1] && isIsoDate(m[1])) return m[1];
  return null;
}

type DeriveFail = { ok: false; code: string; message: string };

function tryPlanDays(aj: Record<string, unknown>): { ok: true; params: Omit<DerivedPendingAgreementRpc, "slot_start" | "slot_end" | "starts_at" | "binding_months" | "notice_months"> } | { ok: "none" } | DeriveFail {
  if (!isPlainObject(aj.plan) || !isPlainObject((aj.plan as { days?: unknown }).days)) {
    return { ok: "none" };
  }
  const days = (aj.plan as { days: Record<string, unknown> }).days;

  const enabled: { day: AgreementWeekday; tier: "BASIS" | "LUXUS"; price: number }[] = [];

  for (const day of WEEKDAYS) {
    if (!(day in days)) {
      return {
        ok: false,
        code: "AGREEMENT_PLAN_INCOMPLETE",
        message: `Ufullstendig plan i agreement_json: plan.days mangler nøkkel «${day}».`,
      };
    }
    const d = days[day];
    if (!isPlainObject(d)) {
      return {
        ok: false,
        code: "AGREEMENT_PLAN_INCOMPLETE",
        message: `Ufullstendig plan i agreement_json: plan.days.${day} er ikke et objekt.`,
      };
    }
    if (!dayEnabled(d)) continue;

    const rawTier = (d as { tier?: unknown; plan_tier?: unknown }).tier ?? (d as { plan_tier?: unknown }).plan_tier;
    const tier = normalizeTierRpc(rawTier);
    if (!tier) {
      return {
        ok: false,
        code: "AGREEMENT_TIER_INVALID",
        message: `Ugyldig avtalenivå (BASIS/LUXUS) for ${day} i agreement_json.`,
      };
    }
    const price = normalizePriceNum(
      (d as { price_ex_vat?: unknown }).price_ex_vat ?? (d as { price?: unknown }).price,
    );
    if (!Number.isFinite(price) || price <= 0) {
      return {
        ok: false,
        code: "AGREEMENT_PRICE_INVALID",
        message: `Mangler eller ugyldig pris (eks. mva) for aktivert dag ${day} i agreement_json.`,
      };
    }
    enabled.push({ day, tier, price });
  }

  if (enabled.length === 0) {
    return {
      ok: false,
      code: "AGREEMENT_NO_DELIVERY_DAYS",
      message: "Ingen aktive leveringsdager i agreement_json.plan.days.",
    };
  }

  /** Én `tier`/`price` i agreements-raden er RPC-legacy; operativ uke ligger i agreement_json.plan.days. */
  const tier0 = enabled[0]!.tier;
  const p0 = enabled[0]!.price;

  return {
    ok: true,
    params: {
      tier: tier0,
      delivery_days: enabled.map((x) => x.day),
      price_per_employee: p0,
    },
  };
}

function tryScheduleTiers(aj: Record<string, unknown>): { ok: true; params: Omit<DerivedPendingAgreementRpc, "slot_start" | "slot_end" | "starts_at" | "binding_months" | "notice_months"> } | { ok: "none" } | DeriveFail {
  if (!isPlainObject(aj.schedule) || !isPlainObject(aj.tiers)) {
    return { ok: "none" };
  }
  const schedule = aj.schedule as Record<string, unknown>;
  const tiersRaw = aj.tiers as Record<string, unknown>;

  const dayTiers: { day: AgreementWeekday; tier: "BASIS" | "LUXUS"; price: number }[] = [];

  for (const day of WEEKDAYS) {
    const cell = schedule[day];
    if (!isPlainObject(cell)) {
      return {
        ok: false,
        code: "AGREEMENT_SCHEDULE_INCOMPLETE",
        message: `agreement_json.schedule mangler eller har ugyldig objekt for ${day}.`,
      };
    }
    const tier = normalizeTierRpc((cell as { tier?: unknown }).tier);
    if (!tier) {
      return {
        ok: false,
        code: "AGREEMENT_TIER_INVALID",
        message: `Ugyldig avtalenivå for ${day} i agreement_json.schedule.`,
      };
    }
    const tierDef = tiersRaw[tier];
    if (!isPlainObject(tierDef)) {
      return {
        ok: false,
        code: "AGREEMENT_TIERS_INCOMPLETE",
        message: `agreement_json.tiers mangler definisjon for ${tier}.`,
      };
    }
    const price = normalizePriceNum((tierDef as { price?: unknown }).price);
    if (!Number.isFinite(price) || price <= 0) {
      return {
        ok: false,
        code: "AGREEMENT_PRICE_INVALID",
        message: `Ugyldig pris for ${tier} i agreement_json.tiers.`,
      };
    }
    dayTiers.push({ day, tier, price });
  }

  const tier0 = dayTiers[0]!.tier;
  const price0 = dayTiers[0]!.price;

  return {
    ok: true,
    params: {
      tier: tier0,
      delivery_days: [...WEEKDAYS],
      price_per_employee: price0,
    },
  };
}

/**
 * Utleder parametre til `lp_agreement_create_pending` fra `companies.agreement_json`.
 * Blandet BASIS/Luxus per dag støttes i plan; RPC-raden får snapshot fra første aktive ukedag (mon→fre).
 */
export function derivePendingAgreementDraftFromAgreementJson(
  agreementJson: unknown,
): { ok: true; params: DerivedPendingAgreementRpc } | DeriveFail {
  if (!isPlainObject(agreementJson)) {
    return {
      ok: false,
      code: "AGREEMENT_JSON_MISSING",
      message: "Firmaets agreement_json mangler eller er ikke et objekt. Avtaleutkast kan ikke utledes her.",
    };
  }
  const aj = agreementJson;

  const terms = readBindingNotice(aj);
  if (!terms) {
    return {
      ok: false,
      code: "AGREEMENT_TERMS_MISSING",
      message:
        "Binding og oppsigelse mangler i agreement_json (forventet commercial.bindingMonths/noticeMonths eller terms.binding_months/notice_months).",
    };
  }

  const delivery = isPlainObject(aj.delivery) ? aj.delivery : null;
  const slotStart = normalizeHHMM(delivery?.window_from);
  const slotEnd = normalizeHHMM(delivery?.window_to);
  if (!slotStart || !slotEnd || slotStart >= slotEnd) {
    return {
      ok: false,
      code: "AGREEMENT_SLOT_MISSING",
      message:
        "Leveringsvindu mangler eller er ugyldig i agreement_json (delivery.window_from og delivery.window_to som HH:MM).",
    };
  }

  const startsAt = readStartsAtIso(aj);
  if (!startsAt) {
    return {
      ok: false,
      code: "AGREEMENT_START_MISSING",
      message:
        "Startdato kan ikke utledes fra agreement_json (forventet eksplisitt startdato eller gyldig created_at).",
    };
  }

  const fromPlan = tryPlanDays(aj);
  if (fromPlan.ok === false) return fromPlan;
  if (fromPlan.ok === true) {
    return {
      ok: true,
      params: {
        ...fromPlan.params,
        slot_start: slotStart,
        slot_end: slotEnd,
        starts_at: startsAt,
        binding_months: terms.binding,
        notice_months: terms.notice,
      },
    };
  }

  const fromSched = tryScheduleTiers(aj);
  if (fromSched.ok === false) return fromSched;
  if (fromSched.ok === true) {
    return {
      ok: true,
      params: {
        ...fromSched.params,
        slot_start: slotStart,
        slot_end: slotEnd,
        starts_at: startsAt,
        binding_months: terms.binding,
        notice_months: terms.notice,
      },
    };
  }

  return {
    ok: false,
    code: "AGREEMENT_JSON_INSUFFICIENT",
    message:
      "agreement_json mangler utledbar plan (plan.days med alle ukedager, eller schedule+tiers for man–fre). Opprett avtale manuelt.",
  };
}

function mapRpcError(messageRaw: unknown) {
  const m = safeStr(messageRaw).toUpperCase();

  if (m.includes("COMPANY_NOT_FOUND")) {
    return { status: 404, code: "COMPANY_NOT_FOUND", message: "Fant ikke firma." };
  }
  if (m.includes("LOCATION_REQUIRED")) {
    return { status: 409, code: "LOCATION_REQUIRED", message: "Firmaet mangler lokasjon." };
  }
  if (m.includes("LOCATION_INVALID")) {
    return { status: 409, code: "LOCATION_INVALID", message: "Lokasjon er ikke gyldig for firmaet." };
  }
  if (
    m.includes("TIER_INVALID") ||
    m.includes("STARTS_AT_REQUIRED") ||
    m.includes("SLOT_RANGE_INVALID") ||
    m.includes("BINDING_MONTHS_INVALID") ||
    m.includes("NOTICE_MONTHS_INVALID") ||
    m.includes("PRICE_PER_EMPLOYEE_INVALID") ||
    m.includes("DELIVERY_DAYS_INVALID") ||
    m.includes("DELIVERY_DAYS_REQUIRED")
  ) {
    return { status: 400, code: "BAD_INPUT", message: "Ugyldige avtaleverdier." };
  }

  return { status: 500, code: "AGREEMENT_CREATE_FAILED", message: "Kunne ikke opprette avtale." };
}

export type AgreementDraftFromRegistrationScope = {
  user_id: string | null;
  email: string | null;
  role: string | null;
};

/**
 * Oppretter én rad i `agreements` med status PENDING via canonical RPC `lp_agreement_create_pending`.
 * Leser firmaregistrering (`company_registrations`) for ukedags BASIS/Luxus + vindu + binding/oppsigelse,
 * fletter inn i `companies.agreement_json.plan.days` (operativ avtaleflate), deretter utledning + RPC.
 * Oppdaterer ikke `companies.status`.
 */
export async function createAgreementDraftFromRegistration(opts: {
  companyId: string;
  rid: string;
  scope: AgreementDraftFromRegistrationScope;
}): Promise<
  | { ok: true; agreementId: string; status: string; audit_ok: boolean }
  | { ok: false; status: number; code: string; message: string }
> {
  const companyId = safeStr(opts.companyId);
  if (!isUuid(companyId)) {
    return { ok: false, status: 400, code: "BAD_INPUT", message: "Ugyldig firma." };
  }

  const reg = await loadCompanyRegistrationDetail(companyId);
  if (reg.ok === false) {
    if ("notFound" in reg && reg.notFound) {
      return { ok: false, status: 404, code: "REGISTRATION_NOT_FOUND", message: "Fant ikke firmaregistrering." };
    }
    const err = reg as { message: string };
    return { ok: false, status: 500, code: "REGISTRATION_READ_FAILED", message: err.message };
  }

  const admin = supabaseAdmin();

  const { data: pendingRow, error: pendErr } = await admin
    .from("agreements")
    .select("id")
    .eq("company_id", companyId)
    .eq("status", "PENDING")
    .limit(1)
    .maybeSingle();

  if (pendErr) {
    return { ok: false, status: 500, code: "AGREEMENT_LOOKUP_FAILED", message: "Kunne ikke sjekke eksisterende avtaler." };
  }
  if (pendingRow?.id) {
    return {
      ok: false,
      status: 409,
      code: "PENDING_AGREEMENT_EXISTS",
      message: "Firmaet har allerede en avtale i status Venter. Åpne avtalen i stedet for å opprette ny.",
    };
  }

  const regItem = reg.item;
  if (!regItem.weekday_meal_tiers) {
    return {
      ok: false,
      status: 422,
      code: "REGISTRATION_WEEKDAY_TIERS_REQUIRED",
      message: "Firmaregistrering mangler ukedagsvalg for Basis/Luxus. Registrer på nytt med full plan, eller opprett avtale manuelt.",
    };
  }
  if (
    !regItem.delivery_window_from ||
    !regItem.delivery_window_to ||
    regItem.terms_binding_months == null ||
    regItem.terms_notice_months == null
  ) {
    return {
      ok: false,
      status: 422,
      code: "REGISTRATION_COMMERCIAL_INCOMPLETE",
      message: "Firmaregistrering mangler leveringsvindu eller binding/oppsigelse. Oppdater registrering eller opprett avtale manuelt.",
    };
  }

  const [cmsBasis, cmsLuxus] = await Promise.all([getProductPlan("basis"), getProductPlan("luxus")]);
  if (!cmsBasis?.price || !cmsLuxus?.price) {
    return {
      ok: false,
      status: 422,
      code: "CMS_PRODUCT_PLAN_MISSING",
      message: "Kunne ikke hente produktpriser (Basis/Luxus) fra CMS. Avtaleutkast kan ikke opprettes nå.",
    };
  }

  const { data: compRow, error: compErr } = await admin
    .from("companies")
    .select("agreement_json, created_at")
    .eq("id", companyId)
    .maybeSingle();

  if (compErr) {
    return { ok: false, status: 500, code: "COMPANY_READ_FAILED", message: "Kunne ikke lese firmagrunnlag." };
  }

  const agreementJsonBefore = (compRow as { agreement_json?: unknown; created_at?: unknown } | null)?.agreement_json;
  const companyCreatedAt = safeStr((compRow as { created_at?: unknown } | null)?.created_at ?? "") || new Date().toISOString();

  const mergedAgreementJson = mergeRegistrationPlanIntoAgreementJson({
    existing: agreementJsonBefore,
    weekday_meal_tiers: regItem.weekday_meal_tiers,
    commercial: {
      delivery_window_from: regItem.delivery_window_from!,
      delivery_window_to: regItem.delivery_window_to!,
      terms_binding_months: regItem.terms_binding_months!,
      terms_notice_months: regItem.terms_notice_months!,
    },
    vatRate: 0.25,
    priceBasisExVat: cmsBasis.price,
    priceLuxusExVat: cmsLuxus.price,
    createdAtIso: companyCreatedAt,
  });

  const { error: upCompErr } = await admin.from("companies").update({ agreement_json: mergedAgreementJson as any }).eq("id", companyId);
  if (upCompErr) {
    return { ok: false, status: 500, code: "COMPANY_AGREEMENT_JSON_UPDATE_FAILED", message: "Kunne ikke lagre avtalegrunnlag på firma." };
  }

  const derived = derivePendingAgreementDraftFromAgreementJson(mergedAgreementJson);
  if (derived.ok === false) {
    return { ok: false, status: 422, code: derived.code, message: derived.message };
  }

  const p = derived.params;
  const deliveryNorm = normalizeDeliveryDaysStrict(p.delivery_days);
  if (deliveryNorm.days.length === 0 || deliveryNorm.unknown.length > 0) {
    return { ok: false, status: 422, code: "AGREEMENT_DELIVERY_INVALID", message: "Ugyldige leveringsdager utledet fra agreement_json." };
  }

  const meal = parseMealContractFromAgreementJson(mergedAgreementJson);
  const mealCheck = await validateMealContractForAgreementWrite({
    rpcTier: p.tier,
    deliveryDays: deliveryNorm.days,
    mealContract: meal ?? undefined,
  });
  if (mealCheck.ok === false) {
    return { ok: false, status: 422, code: mealCheck.code, message: mealCheck.message };
  }

  const { data, error } = await admin.rpc("lp_agreement_create_pending", {
    p_company_id: companyId,
    p_location_id: null,
    p_tier: p.tier,
    p_delivery_days: deliveryNorm.days,
    p_slot_start: p.slot_start,
    p_slot_end: p.slot_end,
    p_starts_at: p.starts_at,
    p_binding_months: p.binding_months,
    p_notice_months: p.notice_months,
    p_price_per_employee: p.price_per_employee,
  });

  if (error) {
    const mapped = mapRpcError(error.message);
    return { ok: false, status: mapped.status, code: mapped.code, message: mapped.message };
  }

  const out = (data ?? null) as CreateRpcOut;
  const agreementId = safeStr(out?.agreement_id);
  const status = safeStr(out?.status).toUpperCase() || "PENDING";

  if (!agreementId) {
    return { ok: false, status: 500, code: "AGREEMENT_CREATE_BAD_RESPONSE", message: "Kunne ikke opprette avtale." };
  }

  const audit = await writeAuditEvent({
    scope: opts.scope,
    action: "agreement.create_pending",
    entity_type: "agreement",
    entity_id: agreementId,
    summary: `Opprettet avtale (PENDING) fra firmaregistrering for company ${companyId}`,
    detail: {
      rid: opts.rid,
      company_id: companyId,
      source: "company_registration",
      ground:
        "company_registrations.weekday_meal_tiers → companies.agreement_json.plan.days → lp_agreement_create_pending → agreement_day_slot_rules → v_company_current_agreement_daymap",
      registration: {
        contact_email: regItem.contact_email,
        contact_name: regItem.contact_name,
        employee_count: regItem.employee_count,
        weekday_meal_tiers: regItem.weekday_meal_tiers,
        delivery_window_from: regItem.delivery_window_from,
        delivery_window_to: regItem.delivery_window_to,
        terms_binding_months: regItem.terms_binding_months,
        terms_notice_months: regItem.terms_notice_months,
      },
      tier: p.tier,
      delivery_days: deliveryNorm.days,
      starts_at: p.starts_at,
      slot_start: p.slot_start,
      slot_end: p.slot_end,
      binding_months: p.binding_months,
      notice_months: p.notice_months,
      price_per_employee: p.price_per_employee,
    },
  });

  return {
    ok: true,
    agreementId,
    status,
    audit_ok: (audit as any)?.ok === true,
  };
}
