// app/api/onboarding/complete/route.ts


export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { type NextRequest } from "next/server";
import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";

/* =========================================================
   Types
========================================================= */
type DayKey = "mon" | "tue" | "wed" | "thu" | "fri";
type PlanTier = "BASIS" | "LUXUS";

type AgreementDay = {
  enabled: boolean;
  tier: PlanTier;
  price_ex_vat: number;
  price_inc_vat: number;
};
type AgreementDays = Record<DayKey, AgreementDay>;

type LocInput = {
  company_id: string;

  location_name: string;
  address: string;
  postal_code: string;
  city: string;

  delivery_where: string;
  delivery_when_note: string;

  delivery_contact_name: string;
  delivery_contact_phone: string;

  delivery_window_from: string;
  delivery_window_to: string;

  // NOT NULL hos dere (bekreftet av DB-feil)
  delivery_contact_country: string;

  // NOT NULL hos dere (bekreftet av DB-feil)
  delivery_json: any;

  // optional
  delivery_contact_email?: string;
};

/* =========================================================
   Helpers
========================================================= */
function jsonError(rid: string, status: number, error: string, message: string, detail?: any) {
  const err = detail !== undefined ? { code: error, detail } : error;
  return jsonErr(rid, message, status, err);
}

const cleanEmail = (v: any) => String(v ?? "").trim().toLowerCase();
const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
const digitsOnly = (v: any) => String(v ?? "").replace(/\D/g, "");
const isNonEmpty = (v: any, min = 2) => String(v ?? "").trim().length >= min;
const isValidTimeHHMM = (v: string) => /^\d{2}:\d{2}$/.test(v);

function normalizeTier(v: any): PlanTier | null {
  const s = String(v ?? "").trim().toLowerCase();
  if (s === "basis") return "BASIS";
  if (s === "luxus" || s === "luksus" || s === "lux") return "LUXUS";
  return null;
}

function parsePrice(v: any): number {
  if (typeof v === "number") return v;
  const s = String(v ?? "").trim();
  if (!s) return NaN;
  let t = s.replace(",", ".").replace(/[^0-9.]/g, "");
  const i = t.indexOf(".");
  if (i !== -1) t = t.slice(0, i + 1) + t.slice(i + 1).replace(/\./g, "");
  const n = Number(t);
  return Number.isFinite(n) ? n : NaN;
}

/** supabaseAdmin kan være client eller factory */
async function adminClient(): Promise<any> {
  const { supabaseAdmin } = await import("@/lib/supabase/admin");
  const s: any = supabaseAdmin as any;
  return typeof s === "function" ? await s() : s;
}

async function findAuthUserIdByEmail(SB: any, email: string): Promise<string | null> {
  if (SB.auth?.admin?.getUserByEmail) {
    const { data, error } = await SB.auth.admin.getUserByEmail(email);
    if (error) throw error;
    return data?.user?.id ?? null;
  }
  const { data, error } = await SB.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) throw error;
  const hit = (data?.users ?? []).find((u: any) => String(u.email ?? "").toLowerCase() === email);
  return hit?.id ?? null;
}

function isTableMissingError(err: any) {
  const msg = String(err?.message ?? err ?? "");
  return msg.toLowerCase().includes("could not find the table") && msg.toLowerCase().includes("schema cache");
}

function pickString(v: any) {
  const s = String(v ?? "").trim();
  return s.length ? s : null;
}
function pickBool(v: any) {
  return typeof v === "boolean" ? v : !!v;
}

/* =========================================================
   Agreement JSON (SAFE) — NO raw_payload, NO passwords
========================================================= */
function buildAgreementJsonSafe(params: {
  nowISO: string;
  company_name: string;
  orgnr: string;
  employee_count: number;

  full_name: string;
  email: string;
  phone: string;

  dominantTier: PlanTier;
  vatRate: number;
  daysNorm: any;

  delivery: any;
  location: any;
  terms: any;
}) {
  const {
    nowISO,
    company_name,
    orgnr,
    employee_count,
    full_name,
    email,
    phone,
    dominantTier,
    vatRate,
    daysNorm,
    delivery,
    location,
    terms,
  } = params;

  const deliveryCountry = pickString(delivery?.contact_country) ?? "NO";

  return {
    version: 1,
    created_at: nowISO,

    company: {
      name: company_name,
      orgnr,
      employee_count,
    },

    admin: {
      full_name,
      email,
      phone,
    },

    delivery: {
      where: pickString(delivery?.where),
      when_note: pickString(delivery?.when_note),
      contact_name: pickString(delivery?.contact_name),
      contact_phone: pickString(delivery?.contact_phone),
      contact_country: deliveryCountry,
      window_from: pickString(delivery?.window_from),
      window_to: pickString(delivery?.window_to),
      contact_email: pickString(delivery?.contact_email),
    },

    location: {
      name: pickString(location?.name),
      address: pickString(location?.address),
      postal_code: pickString(location?.postal_code),
      city: pickString(location?.city),
    },

    terms: {
      accepted_terms: pickBool(terms?.accepted_terms),
      accepted_credit_check: pickBool(terms?.accepted_credit_check),
      version: pickString(terms?.version),
      binding_months: Number(terms?.binding_months ?? 12),
      notice_months: Number(terms?.notice_months ?? 3),
      accepted_at: pickString(terms?.accepted_at) ?? nowISO,
      credit_consent_at: pickString(terms?.credit_consent_at) ?? (terms?.accepted_credit_check ? nowISO : null),
      credit_check_system: pickString(terms?.credit_check_system) ?? "tripletex",
    },

    billing: {
      prices_include_vat: true,
      vat_rate: vatRate,
      currency: "NOK",
      invoice_cadence: "every_14_days",
    },

    plan: {
      dominant_tier: dominantTier,
      days: daysNorm,
    },
  };
}

/* =========================================================
   Agreement days
========================================================= */
function buildDefaultDays(): AgreementDays {
  const make = (): AgreementDay => ({ enabled: false, tier: "BASIS", price_ex_vat: 0, price_inc_vat: 0 });
  return { mon: make(), tue: make(), wed: make(), thu: make(), fri: make() };
}

function getDayObj(input: any, k: DayKey) {
  if (!input || typeof input !== "object") return null;
  const map: Record<DayKey, string[]> = {
    mon: ["mon", "monday", "mandag"],
    tue: ["tue", "tuesday", "tirsdag"],
    wed: ["wed", "wednesday", "onsdag"],
    thu: ["thu", "thursday", "torsdag"],
    fri: ["fri", "friday", "fredag"],
  };
  for (const key of map[k]) {
    const v = input[key];
    if (v && typeof v === "object") return v;
  }
  return null;
}

function normalizeDays(input: any, vat_rate = 0.25): { days: AgreementDays; hasAnyEnabled: boolean } | null {
  const keys: DayKey[] = ["mon", "tue", "wed", "thu", "fri"];
  const out = buildDefaultDays();
  if (!input || typeof input !== "object") return { days: out, hasAnyEnabled: false };

  let anyEnabled = false;

  for (const k of keys) {
    const d = getDayObj(input, k);
    if (!d) continue;

    const enabled = !!(d.enabled ?? d.selected ?? d.active);
    const tier = normalizeTier(d.tier ?? d.plan_tier ?? d.level ?? d.plan) ?? out[k].tier;

    const exRaw = parsePrice(d.priceExVat ?? d.price_ex_vat);
    const incRaw = parsePrice(d.priceIncVat ?? d.priceInclVat ?? d.price_incl_vat ?? d.price);

    let price_ex_vat = 0;
    let price_inc_vat = 0;

    if (enabled) {
      anyEnabled = true;
      const hasEx = Number.isFinite(exRaw) && exRaw > 0;
      const hasInc = Number.isFinite(incRaw) && incRaw > 0;
      if (!hasEx && !hasInc) return null;

      if (hasEx && hasInc) {
        price_ex_vat = Math.round(exRaw);
        price_inc_vat = Math.round(incRaw);
      } else if (hasEx) {
        price_ex_vat = Math.round(exRaw);
        price_inc_vat = Math.round(exRaw * (1 + vat_rate));
      } else {
        price_inc_vat = Math.round(incRaw);
        price_ex_vat = Math.round(incRaw / (1 + vat_rate));
      }
      if (price_ex_vat <= 0 || price_inc_vat <= 0) return null;
    }

    out[k] = { enabled, tier, price_ex_vat, price_inc_vat };
  }

  return { days: out, hasAnyEnabled: anyEnabled };
}

/* =========================================================
   Profile sync (FASIT)
========================================================= */
async function waitForProfileRow(SB: any, userId: string) {
  const maxRetries = 25; // ~5s
  const sleepMs = 200;

  for (let i = 0; i < maxRetries; i++) {
    const { data, error } = await SB.from("profiles").select("id, company_id").eq("id", userId).maybeSingle();
    if (!error && data?.id) return { ok: true as const, data };
    await new Promise((r) => setTimeout(r, sleepMs));
  }

  return { ok: false as const, error: { message: "PROFILE_NOT_CREATED" } };
}

async function syncProfileSafe(SB: any, userId: string, display_name: string, phone: string) {
  const waited = await waitForProfileRow(SB, userId);
  if (!waited.ok) return { data: null, error: waited.error };

  const patch: any = {
    phone,
    is_active: true,
    disabled_at: null,
    disabled_reason: null,
  };

  // ✅ prefer-const fix
  const u1 = await SB.from("profiles").update({ ...patch, full_name: display_name }).eq("id", userId);
  if (!u1.error) return u1;

  const msg = String(u1.error?.message ?? "");
  if (msg.includes("full_name") || msg.toLowerCase().includes("schema cache") || msg.toLowerCase().includes("column")) {
    return SB.from("profiles").update({ ...patch, name: display_name }).eq("id", userId);
  }

  return u1;
}

/* =========================================================
   company_locations "ALL FIELDS" auto-mapping + NOT NULL hard fields
========================================================= */
function extractMissingColumn(errMsg: string): string | null {
  const m = errMsg.match(/Could not find the '([^']+)' column/i);
  return m?.[1] ?? null;
}

function candidateMap(loc: LocInput) {
  return {
    company_id: [{ company_id: loc.company_id }],

    name: [{ name: loc.location_name }, { location_name: loc.location_name }, { navn: loc.location_name }],

    address: [
      { Adresse: loc.address },
      { address1: loc.address },
      { address_line1: loc.address },
      { line1: loc.address },
      { street_address: loc.address },
      { street: loc.address },
      { location_address: loc.address },
      { adresse: loc.address },
    ],

    postal_code: [
      { postal_code: loc.postal_code },
      { postcode: loc.postal_code },
      { zip: loc.postal_code },
      { postnummer: loc.postal_code },
      { Postnummer: loc.postal_code },
    ],

    city: [{ city: loc.city }, { poststed: loc.city }, { Poststed: loc.city }, { town: loc.city }],

    delivery_where: [
      { delivery_where: loc.delivery_where },
      { delivery_point: loc.delivery_where },
      { delivery_location: loc.delivery_where },
      { leveringspunkt: loc.delivery_where },
      { Leveringspunkt: loc.delivery_where },
    ],

    delivery_when_note: [
      { delivery_when_note: loc.delivery_when_note },
      { delivery_instructions: loc.delivery_when_note },
      { instructions: loc.delivery_when_note },
      { when_note: loc.delivery_when_note },
      { whenNote: loc.delivery_when_note },
      { leveringsinstruksjon: loc.delivery_when_note },
      { Leveringsinstruksjon: loc.delivery_when_note },
      { delivery_note: loc.delivery_when_note },
    ],

    delivery_contact_name: [
      { delivery_contact_name: loc.delivery_contact_name },
      { contact_name: loc.delivery_contact_name },
      { delivery_contact: loc.delivery_contact_name },
      { kontaktperson: loc.delivery_contact_name },
      { Kontaktperson: loc.delivery_contact_name },
    ],

    delivery_contact_phone: [
      { delivery_contact_phone: loc.delivery_contact_phone },
      { contact_phone: loc.delivery_contact_phone },
      { delivery_phone: loc.delivery_contact_phone },
      { kontakttelefon: loc.delivery_contact_phone },
      { TelefonVedLevering: loc.delivery_contact_phone },
      { telefon_ved_levering: loc.delivery_contact_phone },
    ],

    delivery_contact_country: [{ delivery_contact_country: loc.delivery_contact_country }],
    delivery_json: [{ delivery_json: loc.delivery_json }],

    delivery_window_from: [
      { delivery_window_from: loc.delivery_window_from },
      { window_from: loc.delivery_window_from },
      { from_time: loc.delivery_window_from },
      { leveringsvindu_fra: loc.delivery_window_from },
      { LeveringsvinduFra: loc.delivery_window_from },
    ],

    delivery_window_to: [
      { delivery_window_to: loc.delivery_window_to },
      { window_to: loc.delivery_window_to },
      { to_time: loc.delivery_window_to },
      { leveringsvindu_til: loc.delivery_window_to },
      { LeveringsvinduTil: loc.delivery_window_to },
    ],

    delivery_contact_email: loc.delivery_contact_email
      ? [
          { delivery_contact_email: loc.delivery_contact_email },
          { contact_email: loc.delivery_contact_email },
          { email: loc.delivery_contact_email },
          { epost: loc.delivery_contact_email },
        ]
      : [],
  } as const;
}

async function insertLocationAllFieldsSmart(SB: any, loc: LocInput) {
  const cmap = candidateMap(loc);
  const pickIndex: Record<string, number> = {};
  for (const k of Object.keys(cmap)) pickIndex[k] = 0;

  for (let attempt = 0; attempt < 180; attempt++) {
    let row: any = {};

    for (const field of Object.keys(cmap)) {
      const variants = (cmap as any)[field] as Array<Record<string, any>>;
      if (!variants || variants.length === 0) continue;

      const idx = pickIndex[field] ?? 0;
      if (idx >= variants.length) continue;

      row = { ...row, ...variants[idx] };
    }

    row.delivery_contact_country = loc.delivery_contact_country || "NO";
    row.delivery_json = loc.delivery_json ?? {};

    const res = await SB.from("company_locations").insert(row).select("id").single();
    if (!res.error) return res;

    const msg = String(res.error?.message ?? "");

    if (msg.toLowerCase().includes("violates not-null constraint")) return res;
    if (msg.toLowerCase().includes("violates foreign key")) return res;

    const missing = extractMissingColumn(msg);
    if (!missing) return res;

    let matchedField: string | null = null;
    for (const logical of Object.keys(cmap)) {
      const variants = (cmap as any)[logical] as Array<Record<string, any>>;
      const idx = pickIndex[logical] ?? 0;
      if (!variants || idx >= variants.length) continue;
      const keys = Object.keys(variants[idx] ?? {});
      if (keys.includes(missing)) {
        matchedField = logical;
        break;
      }
    }
    if (!matchedField) return res;

    const variants = (cmap as any)[matchedField] as Array<Record<string, any>>;
    const next = (pickIndex[matchedField] ?? 0) + 1;
    if (next < variants.length) pickIndex[matchedField] = next;
    else pickIndex[matchedField] = variants.length;
  }

  return { data: null, error: { message: "location_insert_failed_after_many_attempts" } };
}

/* =========================================================
   POST
========================================================= */
export async function POST(req: NextRequest) {
  
  const { supabaseAdmin } = await import("@/lib/supabase/admin");
  const rid = makeRid();
  const SB = await adminClient();
  if (!SB?.from || !SB?.auth?.admin) return jsonError(rid, 500, "ADMIN_CLIENT_MISSING", "supabaseAdmin er ikke tilgjengelig");

  const body = await req.json().catch(() => null);
  if (!body) return jsonError(rid, 400, "BAD_REQUEST", "Ugyldig JSON");

  const company_name = String(body?.company_name ?? "").trim();
  const orgnr = digitsOnly(body?.orgnr);
  const employee_count = Number(body?.employee_count ?? 0);

  const full_name = String(body?.full_name ?? "").trim();
  const email = cleanEmail(body?.email);
  const phone = digitsOnly(body?.phone);

  const password = String(body?.password ?? "");
  const password_confirm = String(body?.password_confirm ?? "");

  const delivery = body?.delivery ?? null;
  const location = body?.location ?? null;
  const agreement = body?.agreement ?? null;
  const terms = body?.terms ?? null;

  if (!isNonEmpty(company_name, 2)) return jsonError(rid, 400, "VALIDATION", "Firmanavn er påkrevd");
  if (orgnr.length !== 9) return jsonError(rid, 400, "VALIDATION", "Org.nr må være 9 siffer");
  if (!Number.isFinite(employee_count) || employee_count < 20)
    return jsonError(rid, 400, "VALIDATION", "Firma må ha minimum 20 ansatte");

  if (!isNonEmpty(full_name, 2)) return jsonError(rid, 400, "VALIDATION", "Navn er påkrevd");
  if (!isEmail(email)) return jsonError(rid, 400, "VALIDATION", "Ugyldig e-postadresse");
  if (phone.length < 6) return jsonError(rid, 400, "VALIDATION", "Telefon er påkrevd");
  if (password.length < 10) return jsonError(rid, 400, "VALIDATION", "Passord må være minimum 10 tegn");
  if (password !== password_confirm) return jsonError(rid, 400, "VALIDATION", "Passordene er ikke like");

  if (!delivery) return jsonError(rid, 400, "VALIDATION", "Leveringsinfo mangler");
  if (!location) return jsonError(rid, 400, "VALIDATION", "Lokasjon mangler");

  if (!isNonEmpty(delivery?.where, 2)) return jsonError(rid, 400, "VALIDATION", "Leveringspunkt er påkrevd");
  if (!isNonEmpty(delivery?.when_note, 2)) return jsonError(rid, 400, "VALIDATION", "Leveringsinstruksjon er påkrevd");
  if (!isNonEmpty(delivery?.contact_name, 2)) return jsonError(rid, 400, "VALIDATION", "Kontaktperson er påkrevd");
  if (!isNonEmpty(delivery?.contact_phone, 2)) return jsonError(rid, 400, "VALIDATION", "Telefon ved levering er påkrevd");
  if (!isValidTimeHHMM(String(delivery?.window_from ?? "")) || !isValidTimeHHMM(String(delivery?.window_to ?? ""))) {
    return jsonError(rid, 400, "VALIDATION", "Leveringsvindu må være på format HH:MM");
  }

  if (!isNonEmpty(location?.name, 2)) return jsonError(rid, 400, "VALIDATION", "Lokasjon (navn) er påkrevd");
  if (!isNonEmpty(location?.address, 2)) return jsonError(rid, 400, "VALIDATION", "Adresse er påkrevd");
  if (!isNonEmpty(location?.postal_code, 2)) return jsonError(rid, 400, "VALIDATION", "Postnummer er påkrevd");
  if (!isNonEmpty(location?.city, 2)) return jsonError(rid, 400, "VALIDATION", "Poststed er påkrevd");

  const vatRate = Number.isFinite(Number(agreement?.vat_rate)) ? Number(agreement?.vat_rate) : 0.25;
  const daysParsed = normalizeDays(agreement?.days, vatRate);
  if (!daysParsed) return jsonError(rid, 400, "VALIDATION", "Ugyldig avtaleoppsett. Kontroller dager/nivå/pris.");
  if (!daysParsed.hasAnyEnabled) return jsonError(rid, 400, "VALIDATION", "Velg minst én leveringsdag (man–fre).");

  // Preflight
  try {
    const existing = await findAuthUserIdByEmail(SB, email);
    if (existing) return jsonError(rid, 409, "EMAIL_EXISTS", "E-post er allerede registrert. Bruk innlogging eller en annen e-post.");
  } catch (e: any) {
    return jsonError(rid, 500, "AUTH_LOOKUP_FAILED", "Kunne ikke sjekke e-post i auth", e?.message ?? e);
  }

  const orgCheck = await SB.from("companies").select("id").eq("orgnr", orgnr).limit(1);
  if (orgCheck.error) return jsonError(rid, 500, "DB", "Kunne ikke sjekke org.nr", orgCheck.error);
  if ((orgCheck.data ?? []).length) return jsonError(rid, 409, "ORGNR_EXISTS", "Org.nr er allerede registrert");

  const nowISO = new Date().toISOString();
  const daysNorm = daysParsed.days;
  const dominantTier: PlanTier = Object.values(daysNorm).some((d) => d.enabled && d.tier === "LUXUS") ? "LUXUS" : "BASIS";

  const agreement_json = buildAgreementJsonSafe({
    nowISO,
    company_name,
    orgnr,
    employee_count,
    full_name,
    email,
    phone,
    dominantTier,
    vatRate,
    daysNorm,
    delivery,
    location,
    terms,
  });

  let companyId: string | null = null;
  let userId: string | null = null;
  let locationId: string | null = null;

  const fail = async (e: any) => {
    // rollback best effort
    try {
      const delTerms = await SB.from("company_terms_acceptance").delete().eq("company_id", companyId);
      if (delTerms?.error && !isTableMissingError(delTerms.error)) {
        // ignore
      }
    } catch {}
    try {
      const delAgr = await SB.from("company_agreements").delete().eq("company_id", companyId);
      if (delAgr?.error && !isTableMissingError(delAgr.error)) {
        // ignore
      }
    } catch {}
    try {
      if (locationId) await SB.from("company_locations").delete().eq("id", locationId);
    } catch {}
    try {
      if (userId) await SB.auth.admin.deleteUser(userId);
    } catch {}
    try {
      if (companyId) await SB.from("companies").delete().eq("id", companyId);
    } catch {}

    return jsonErr(rid, "Registrering feilet â€“ ingen data er lagret.", 500, { code: "ONBOARDING_FAILED", detail: e?.message ?? e });
  };

  try {
    // 1) company
    const insCompany = await SB.from("companies")
      .insert({
        name: company_name,
        orgnr,
        status: "pending",
        plan_tier: dominantTier,
        employee_count,
        agreement_json,
      })
      .select("id")
      .single();

    if (insCompany.error) return await fail(insCompany.error);
    companyId = insCompany.data.id;

    // 2) auth user (company_admin)
    const { data: created, error: createErr } = await SB.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        role: "company_admin",
        company_id: companyId,
        full_name,
        name: full_name,
        phone,
      },
    });
    if (createErr) return await fail(createErr);

    userId = created?.user?.id ?? null;
    if (!userId) return await fail(new Error("AUTH_CREATE_NO_USER_ID"));

    // 3) profiles — IKKE insert. Vent på trigger + oppdater trygge felter.
    const prof = await syncProfileSafe(SB, userId, full_name, phone);
    if (prof.error) return await fail(prof.error);

    // 4) company_locations (all fields + hard NOT NULL)
    const deliveryCountry = pickString(delivery?.contact_country) ?? "NO";

    const delivery_json_for_location = {
      where: String(delivery.where).trim(),
      when_note: String(delivery.when_note).trim(),
      contact_name: String(delivery.contact_name).trim(),
      contact_phone: digitsOnly(delivery.contact_phone),
      contact_country: deliveryCountry,
      window_from: String(delivery.window_from).trim(),
      window_to: String(delivery.window_to).trim(),
      contact_email: delivery?.contact_email ? String(delivery.contact_email).trim() : null,
    };

    const locRes = await insertLocationAllFieldsSmart(SB, {
      company_id: companyId,
      location_name: String(location.name).trim(),
      address: String(location.address).trim(),
      postal_code: String(location.postal_code).trim(),
      city: String(location.city).trim(),
      delivery_where: String(delivery.where).trim(),
      delivery_when_note: String(delivery.when_note).trim(),
      delivery_contact_name: String(delivery.contact_name).trim(),
      delivery_contact_phone: digitsOnly(delivery.contact_phone),
      delivery_window_from: String(delivery.window_from).trim(),
      delivery_window_to: String(delivery.window_to).trim(),
      delivery_contact_country: deliveryCountry,
      delivery_json: delivery_json_for_location,
      delivery_contact_email: delivery?.contact_email ? String(delivery.contact_email).trim() : undefined,
    });

    if (locRes.error) return await fail(locRes.error);
    locationId = locRes.data?.id ?? null;

    // (valgfritt) Oppdater profile med location_id (trygt felt) etter at location finnes
    if (locationId) {
      const updLoc = await SB.from("profiles").update({ location_id: locationId }).eq("id", userId);
      if (updLoc.error) return await fail(updLoc.error);
    }

    // 5) OPTIONAL tables (best-effort)
    const insAgr = await SB.from("company_agreements").insert({
      company_id: companyId,
      location_id: locationId,
      days_json: daysNorm,
      billing_prices_include_vat: true,
    });
    if (insAgr.error && !isTableMissingError(insAgr.error)) return await fail(insAgr.error);

    if (terms?.version) {
      const insTerms = await SB.from("company_terms_acceptance").insert({
        company_id: companyId,
        version: String(terms.version),
        accepted_at: terms?.accepted_at ?? nowISO,
        credit_consent_at: terms?.credit_consent_at ?? (terms?.accepted_credit_check ? nowISO : null),
        credit_check_system: terms?.credit_check_system ?? "tripletex",
        binding_months: Number(terms?.binding_months ?? 12),
        notice_months: Number(terms?.notice_months ?? 3),
      });
      if (insTerms.error && !isTableMissingError(insTerms.error)) return await fail(insTerms.error);
    }

    return jsonOk(rid, { ok: true, status: "pending", companyId, userId, locationId }, 200);
  } catch (e: any) {
    // rollback best effort
    try {
      const delTerms = await SB.from("company_terms_acceptance").delete().eq("company_id", companyId);
      if (delTerms?.error && !isTableMissingError(delTerms.error)) {
        // ignore
      }
    } catch {}
    try {
      const delAgr = await SB.from("company_agreements").delete().eq("company_id", companyId);
      if (delAgr?.error && !isTableMissingError(delAgr.error)) {
        // ignore
      }
    } catch {}
    try {
      if (locationId) await SB.from("company_locations").delete().eq("id", locationId);
    } catch {}
    try {
      if (userId) await SB.auth.admin.deleteUser(userId);
    } catch {}
    try {
      if (companyId) await SB.from("companies").delete().eq("id", companyId);
    } catch {}

    return jsonError(rid, 500, "ONBOARDING_FAILED", "Registrering feilet – ingen data er lagret.", e?.message ?? e);
  }
}
