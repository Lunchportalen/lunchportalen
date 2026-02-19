// app/api/company/create/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import "server-only";

import type { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";
import { logOpsEventBestEffort } from "@/lib/ops/logOpsEvent";

type Tier = "BASIS" | "LUXUS";
type DayKey = "monday" | "tuesday" | "wednesday" | "thursday" | "friday";

const DAYS: DayKey[] = ["monday", "tuesday", "wednesday", "thursday", "friday"];

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}
function toInt(v: unknown) {
  const n = Number(String(v ?? "").trim());
  return Number.isFinite(n) ? Math.trunc(n) : NaN;
}
function toNum(v: unknown) {
  const raw = String(v ?? "").replace(",", ".").trim();
  const n = Number(raw);
  return Number.isFinite(n) ? n : NaN;
}

function normalizeTier(v: unknown): Tier {
  const s = safeStr(v).toUpperCase();
  if (s === "BASIS") return "BASIS";
  if (s === "LUXUS") return "LUXUS";
  // accept common legacy variants
  if (s === "PREMIUM") return "LUXUS";
  if (s === "BASIC") return "BASIS";
  return "BASIS";
}

function buildAgreement(body: any) {
  const agreement: Record<string, any> = {};

  for (const day of DAYS) {
    const enabled = !!body?.[`${day}_enabled`];
    if (!enabled) continue;

    const tier = normalizeTier(body?.[`${day}_tier`]);
    const price = toNum(body?.[`${day}_price`]);

    agreement[day] = {
      enabled: true,
      tier,
      price,
    };
  }

  return agreement;
}

function validatePayload(body: any) {
  const company_name = safeStr(body?.company_name);
  const orgnr = safeStr(body?.orgnr);
  const employee_count = toInt(body?.employee_count);

  const address = safeStr(body?.address);
  const postal_code = safeStr(body?.postal_code);
  const city = safeStr(body?.city);

  const delivery_from = safeStr(body?.delivery_from);
  const delivery_to = safeStr(body?.delivery_to);

  if (!company_name) return { ok: false as const, message: "Bedriftsnavn må fylles ut.", code: "VALIDATION" };

  if (!Number.isFinite(employee_count) || employee_count < 20) {
    return { ok: false as const, message: "Antall ansatte må være minst 20.", code: "VALIDATION" };
  }

  if (!address) return { ok: false as const, message: "Adresse må fylles ut.", code: "VALIDATION" };
  if (!/^[0-9]{4}$/.test(postal_code)) {
    return { ok: false as const, message: "Postnummer må være 4 siffer.", code: "VALIDATION" };
  }
  if (!city) return { ok: false as const, message: "Poststed må fylles ut.", code: "VALIDATION" };

  if (!delivery_from || !delivery_to || delivery_from >= delivery_to) {
    return { ok: false as const, message: "Leveringsvindu er ugyldig (fra må være før til).", code: "VALIDATION" };
  }

  // lightweight orgnr check (optional)
  if (orgnr && !/^[0-9]{9}$/.test(orgnr)) {
    return { ok: false as const, message: "Organisasjonsnummer må være 9 siffer (eller tomt).", code: "VALIDATION" };
  }

  return {
    ok: true as const,
    company_name,
    orgnr: orgnr || null,
    employee_count,
    address,
    postal_code,
    city,
    delivery_from,
    delivery_to,
  };
}

function validateAgreement(agreement: Record<string, any>) {
  const enabledDays = Object.keys(agreement);
  if (enabledDays.length === 0) {
    return { ok: false as const, message: "Velg minst én leveringsdag.", code: "AGREEMENT_VALIDATION" };
  }

  for (const day of enabledDays) {
    const row = agreement[day];
    const tier = safeStr(row?.tier).toUpperCase();
    const price = Number(row?.price);

    if (!(tier === "BASIS" || tier === "LUXUS")) {
      return { ok: false as const, message: `Ugyldig nivå for ${day}.`, code: "AGREEMENT_VALIDATION" };
    }
    if (!Number.isFinite(price) || price <= 0) {
      return { ok: false as const, message: `Ugyldig pris for ${day}.`, code: "AGREEMENT_VALIDATION" };
    }
  }

  return { ok: true as const };
}

export async function POST(req: NextRequest) {
  const rid = makeRid();

  try {
    // Guard: required envs
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return jsonErr(rid, "Serverkonfigurasjon mangler.", 500, {
        code: "MISSING_ENV",
        detail: {
          hasUrl: !!process.env.SUPABASE_URL,
          hasServiceRole: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
        },
      });
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return jsonErr(rid, "Ugyldig forespørsel.", 400, { code: "BAD_JSON" });
    }

    const v = validatePayload(body);
    if (!v.ok) {
      return jsonErr(rid, v.message, 400, { code: v.code });
    }

    const agreement = buildAgreement(body);
    const av = validateAgreement(agreement);
    if (!av.ok) {
      return jsonErr(rid, av.message, 400, { code: av.code });
    }

    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { "x-rid": rid } },
    });

    // 1) Atomic create via RPC
    const { data, error } = await supabase.rpc("lp_create_company_with_location", {
      p_company_name: v.company_name,
      p_orgnr: v.orgnr,
      p_employee_count: v.employee_count,
      p_agreement_by_weekday: agreement,
      p_location_name: "Hovedlokasjon",
      p_address_line1: v.address,
      p_postal_code: v.postal_code,
      p_city: v.city,
      p_delivery_from: v.delivery_from,
      p_delivery_to: v.delivery_to,
    });

    if (error) {
      return jsonErr(rid, "Kunne ikke opprette firma.", 400, {
        code: "COMPANY_CREATE_FAILED",
        detail: { message: error.message, hint: (error as any)?.hint, code: (error as any)?.code },
      });
    }

    const company_id = data?.[0]?.company_id as string | undefined;
    const location_id = data?.[0]?.location_id as string | undefined;

    if (!company_id || !location_id) {
      return jsonErr(rid, "Opprettet, men mangler kvittering. Dette skal ikke skje.", 500, {
        code: "MISSING_RECEIPT",
        detail: { company_id: !!company_id, location_id: !!location_id },
      });
    }

    // 2) Enforce onboarding: newly created companies should be pending until superadmin approves
    // NOTE: DB uses lowercase statuses per your superadmin API fasit.
    const { error: stErr } = await supabase.from("companies").update({ status: "pending" }).eq("id", company_id);
    if (stErr) {
      return jsonErr(rid, "Firma opprettet, men status kunne ikke settes. Kontakt support.", 500, {
        code: "SET_STATUS_FAILED",
        detail: { message: stErr.message, hint: (stErr as any)?.hint, code: (stErr as any)?.code },
      });
    }

    // 3) Audit (best-effort): COMPANY_CREATED + STATUS->pending
    await logOpsEventBestEffort(supabase, {
      rid,
      actor_user_id: null,
      actor_email: null,
      actor_role: "public",
      action: "COMPANY_CREATED",
      entity_type: "company",
      entity_id: company_id,
      summary: `Company created: ${v.company_name}`,
      detail: {
        company_id,
        location_id,
        name: v.company_name,
        orgnr: v.orgnr,
        employee_count: v.employee_count,
        address: { address_line1: v.address, postal_code: v.postal_code, city: v.city },
        delivery_window: { from: v.delivery_from, to: v.delivery_to },
        agreement_by_weekday: agreement,
      },
    });

    await logOpsEventBestEffort(supabase, {
      rid,
      actor_user_id: null,
      actor_email: null,
      actor_role: "public",
      action: "COMPANY_STATUS_CHANGED",
      entity_type: "company",
      entity_id: company_id,
      summary: "Status set to pending (on create)",
      detail: { from: null, to: "pending", reason: "ON_CREATE" },
    });

    return jsonOk(
      rid,
      {
        company_id,
        location_id,
        status: "pending",
      },
      201
    );
  } catch (e: any) {
    return jsonErr(rid, "Uventet feil.", 500, {
      code: "COMPANY_CREATE_CRASH",
      detail: { message: String(e?.message ?? e) },
    });
  }
}
