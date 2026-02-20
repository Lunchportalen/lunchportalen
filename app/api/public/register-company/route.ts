export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import "server-only";

import type { NextRequest } from "next/server";
import { makeRid } from "@/lib/http/respond";
import { supabaseAdmin } from "@/lib/supabase/admin";

type RegisterBody = {
  orgnr?: unknown;
  company_name?: unknown;
  companyName?: unknown;
  name?: unknown;
  employee_count?: unknown;
  employeesCount?: unknown;
  contact_name?: unknown;
  contactName?: unknown;
  adminName?: unknown;
  contact_email?: unknown;
  contactEmail?: unknown;
  adminEmail?: unknown;
  email?: unknown;
  contact_phone?: unknown;
  contactPhone?: unknown;
  adminPhone?: unknown;
  phone?: unknown;
  address_line?: unknown;
  addressLine?: unknown;
  address?: unknown;
  postal_code?: unknown;
  postalCode?: unknown;
  postnummer?: unknown;
  postal_city?: unknown;
  postalCity?: unknown;
  poststed?: unknown;
  city?: unknown;
};

type RegisterRpcOut = {
  company_id?: unknown;
  status?: unknown;
  receipt?: unknown;
} | null;

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}

function digitsOnly(v: unknown) {
  return safeStr(v).replace(/\D/g, "");
}

function asInt(v: unknown) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : NaN;
}

function isEmail(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

function redactEmail(raw: string) {
  const email = safeStr(raw).toLowerCase();
  const at = email.indexOf("@");
  if (at <= 0) return "***";
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  return `${local.slice(0, 2)}***@${domain}`;
}

function json(rid: string, status: number, payload: Record<string, unknown>) {
  return new Response(JSON.stringify({ ...payload, rid }), {
    status,
    headers: {
      "cache-control": "no-store",
      "content-type": "application/json; charset=utf-8",
      "x-rid": rid,
    },
  });
}

function err(rid: string, status: number, code: string, message: string) {
  return json(rid, status, {
    ok: false,
    status,
    error: { code },
    message,
  });
}

function mapRpcError(messageRaw: unknown) {
  const m = safeStr(messageRaw).toUpperCase();

  if (m.includes("ORGNR_INVALID") || m.includes("ORGNR_MUST_BE_9_DIGITS")) {
    return { status: 400, code: "ORGNR_INVALID", message: "Org.nr må være 9 siffer." };
  }
  if (m.includes("COMPANY_NAME_REQUIRED") || m.includes("NAME_REQUIRED")) {
    return { status: 400, code: "COMPANY_NAME_REQUIRED", message: "Firmanavn må fylles ut." };
  }
  if (m.includes("EMPLOYEE_COUNT_MIN_20")) {
    return { status: 400, code: "EMPLOYEE_COUNT_MIN_20", message: "Firma må ha minimum 20 ansatte." };
  }
  if (m.includes("CONTACT_NAME_REQUIRED")) {
    return { status: 400, code: "CONTACT_NAME_REQUIRED", message: "Kontaktperson må fylles ut." };
  }
  if (m.includes("CONTACT_EMAIL_REQUIRED") || m.includes("CONTACT_EMAIL_INVALID")) {
    return { status: 400, code: "CONTACT_EMAIL_INVALID", message: "E-post må være gyldig." };
  }
  if (m.includes("CONTACT_PHONE_REQUIRED")) {
    return { status: 400, code: "CONTACT_PHONE_REQUIRED", message: "Telefon må fylles ut." };
  }
  if (m.includes("ADDRESS_LINE_REQUIRED")) {
    return { status: 400, code: "ADDRESS_LINE_REQUIRED", message: "Adresse må fylles ut." };
  }
  if (m.includes("POSTAL_CODE_INVALID")) {
    return { status: 400, code: "POSTAL_CODE_INVALID", message: "Postnummer må være 4 siffer." };
  }
  if (m.includes("POSTAL_CITY_REQUIRED")) {
    return { status: 400, code: "POSTAL_CITY_REQUIRED", message: "Poststed må fylles ut." };
  }

  return { status: 500, code: "REGISTER_FAILED", message: "Registreringen kunne ikke fullføres nå." };
}

function maybeLog(rid: string, email: string, code: string) {
  if (process.env.NODE_ENV === "production" && process.env.LP_DEBUG_AUTH !== "1") return;
  // eslint-disable-next-line no-console
  console.info("[register.company]", { rid, email: redactEmail(email), code });
}

export async function POST(req: NextRequest) {
  const rid = makeRid("rid_register");

  try {
    const ct = safeStr(req.headers.get("content-type")).toLowerCase();
    if (!ct.includes("application/json")) {
      return err(rid, 415, "UNSUPPORTED_MEDIA_TYPE", "Vi kunne ikke motta registreringen.");
    }

    const body = (await req.json().catch(() => null)) as RegisterBody | null;
    if (!body || typeof body !== "object") {
      return err(rid, 400, "BAD_JSON", "Vi kunne ikke motta registreringen.");
    }

    const orgnr = digitsOnly(body.orgnr);
    const companyName = safeStr(body.company_name ?? body.companyName ?? body.name);
    const employeeCount = asInt(body.employee_count ?? body.employeesCount);

    const contactName = safeStr(body.contact_name ?? body.contactName ?? body.adminName);
    const contactEmail = safeStr(body.contact_email ?? body.contactEmail ?? body.adminEmail ?? body.email).toLowerCase();
    const contactPhone = digitsOnly(body.contact_phone ?? body.contactPhone ?? body.adminPhone ?? body.phone);

    const addressLine = safeStr(body.address_line ?? body.addressLine ?? body.address);
    const postalCode = digitsOnly(body.postal_code ?? body.postalCode ?? body.postnummer);
    const postalCity = safeStr(body.postal_city ?? body.postalCity ?? body.poststed ?? body.city);

    if (orgnr.length !== 9) return err(rid, 400, "ORGNR_INVALID", "Org.nr må være 9 siffer.");
    if (!companyName) return err(rid, 400, "COMPANY_NAME_REQUIRED", "Firmanavn må fylles ut.");
    if (!Number.isFinite(employeeCount) || employeeCount < 20) {
      return err(rid, 400, "EMPLOYEE_COUNT_MIN_20", "Firma må ha minimum 20 ansatte.");
    }
    if (!contactName) return err(rid, 400, "CONTACT_NAME_REQUIRED", "Kontaktperson må fylles ut.");
    if (!contactEmail || !isEmail(contactEmail)) return err(rid, 400, "CONTACT_EMAIL_INVALID", "E-post må være gyldig.");
    if (!contactPhone) return err(rid, 400, "CONTACT_PHONE_REQUIRED", "Telefon må fylles ut.");
    if (!addressLine) return err(rid, 400, "ADDRESS_LINE_REQUIRED", "Adresse må fylles ut.");
    if (!/^\d{4}$/.test(postalCode)) return err(rid, 400, "POSTAL_CODE_INVALID", "Postnummer må være 4 siffer.");
    if (!postalCity) return err(rid, 400, "POSTAL_CITY_REQUIRED", "Poststed må fylles ut.");

    const admin = supabaseAdmin();
    const { data, error } = await admin.rpc("lp_company_register", {
      p_orgnr: orgnr,
      p_company_name: companyName,
      p_employee_count: employeeCount,
      p_contact_name: contactName,
      p_contact_email: contactEmail,
      p_contact_phone: contactPhone,
      p_address_line: addressLine,
      p_postal_code: postalCode,
      p_postal_city: postalCity,
    });

    if (error) {
      const mapped = mapRpcError(error.message);
      maybeLog(rid, contactEmail, mapped.code);
      return err(rid, mapped.status, mapped.code, mapped.message);
    }

    const out = (data ?? null) as RegisterRpcOut;
    const companyId = safeStr(out?.company_id);
    if (!companyId) {
      maybeLog(rid, contactEmail, "REGISTER_BAD_RESPONSE");
      return err(rid, 500, "REGISTER_BAD_RESPONSE", "Registreringen kunne ikke fullføres nå.");
    }

    maybeLog(rid, contactEmail, "OK");

    return json(rid, 200, {
      ok: true,
      companyId,
      receipt: {
        message: "Registreringen er mottatt.",
      },
    });
  } catch {
    return err(rid, 500, "REGISTER_UNEXPECTED", "Registreringen kunne ikke fullføres nå.");
  }
}


