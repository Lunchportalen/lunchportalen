// app/api/register/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { supabaseAdmin } from "@/lib/supabase/admin";

type Role = "employee" | "company_admin" | "superadmin" | "kitchen" | "driver";
type CompanyStatus = "pending" | "active" | "paused" | "closed";

function jsonError(status: number, error: string, message: string, detail?: any) {
  return NextResponse.json({ ok: false, error, message, detail: detail ?? undefined }, { status });
}

function safeText(v: any) {
  const s = String(v ?? "").trim();
  return s.length ? s : null;
}

function cleanEmail(v: any) {
  return String(v ?? "").trim().toLowerCase();
}

function isEmail(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

function digitsOnly(v: any) {
  return String(v ?? "").replace(/\D/g, "");
}

function toInt(v: any) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : NaN;
}

function strongEnoughPassword(pw: string) {
  // Baseline: 10+ tegn, minst én bokstav og ett tall
  if (typeof pw !== "string") return false;
  if (pw.length < 10) return false;
  const hasLetter = /[A-Za-z]/.test(pw);
  const hasNumber = /\d/.test(pw);
  return hasLetter && hasNumber;
}

function isUuid(v: any) {
  return (
    typeof v === "string" &&
    /^[0-9a-fA-F-]{8}-[0-9a-fA-F-]{4}-[1-5][0-9a-fA-F-]{3}-[89abAB][0-9a-fA-F-]{3}-[0-9a-fA-F-]{12}$/.test(v)
  );
}

/**
 * Registrering er STENGT som standard i prod.
 * Åpnes ved:
 * - REGISTRATIONS_ENABLED=true
 * eller ved header-key:
 * - REGISTRATIONS_ADMIN_KEY=<hemmelig>
 * - request header: x-registration-key: <hemmelig>
 */
function registrationsEnabled(req: Request) {
  const enabled = String(process.env.REGISTRATIONS_ENABLED ?? "").toLowerCase() === "true";
  if (enabled) return true;

  const key = (process.env.REGISTRATIONS_ADMIN_KEY ?? "").trim();
  if (!key) return false;

  const provided = (req.headers.get("x-registration-key") ?? "").trim();
  return !!provided && provided === key;
}

type RegisterBody = {
  // Firma
  companyName: string;
  orgnr?: string | null;
  employeesCount: number;

  // Adresse (til default lokasjon)
  address?: string | null;
  postalCode?: string | null;
  city?: string | null;

  // Admin bruker
  adminName: string;
  adminEmail: string;
  adminPassword: string;
  adminPhone?: string | null;
};

// -----------------------------
// DB helpers (robuste varianter)
// -----------------------------
async function insertCompany(
  sb: ReturnType<typeof supabaseAdmin>,
  payload: { name: string; orgnr: string | null; status: CompanyStatus; employeesCount: number }
) {
  // prøv ulike kolonnenavn for ansattfelt (dersom schema varierer)
  const variants: any[] = [
    { name: payload.name, orgnr: payload.orgnr, status: payload.status, employees_count: payload.employeesCount },
    { name: payload.name, orgnr: payload.orgnr, status: payload.status, employee_count: payload.employeesCount },
    { name: payload.name, orgnr: payload.orgnr, status: payload.status, employees: payload.employeesCount },
    { name: payload.name, orgnr: payload.orgnr, status: payload.status }, // fallback: uten ansattefelt
  ];

  let lastErr: any = null;

  for (const v of variants) {
    const { data, error } = await sb.from("companies").insert(v).select("*").single();
    if (!error && data?.id) return data;
    lastErr = error;
  }

  throw lastErr ?? new Error("company_create_failed");
}

async function upsertProfileCompanyAdmin(
  sb: ReturnType<typeof supabaseAdmin>,
  args: {
    userId: string;
    companyId: string;
    locationId: string;
    adminName: string;
    adminEmail: string;
    adminPhone: string | null;
  }
) {
  const base = {
    company_id: args.companyId,
    location_id: args.locationId,
    role: "company_admin" as Role,
    name: args.adminName,
    email: args.adminEmail,
    phone: args.adminPhone,
    is_active: true,
  };

  // Dere har (skjermbilde): user_id + id i profiles.
  // Vi setter begge for å være 100% kompatible.
  const variants: any[] = [
    { id: args.userId, user_id: args.userId, ...base },
    { user_id: args.userId, ...base },
    { id: args.userId, ...base },
  ];

  let lastErr: any = null;

  for (const row of variants) {
    // 1) prøv upsert onConflict id
    {
      const { error } = await sb.from("profiles").upsert(row, { onConflict: "id" } as any);
      if (!error) return;
      lastErr = error;
    }

    // 2) prøv upsert onConflict user_id
    {
      const { error } = await sb.from("profiles").upsert(row, { onConflict: "user_id" } as any);
      if (!error) return;
      lastErr = error;
    }

    // 3) fallback insert
    {
      const { error } = await sb.from("profiles").insert(row);
      if (!error) return;
      lastErr = error;
    }
  }

  throw lastErr ?? new Error("profile_create_failed");
}

export async function POST(req: Request) {
  const sb = supabaseAdmin();

  // 0) Hard gate
  if (!registrationsEnabled(req)) {
    return jsonError(403, "registrations_disabled", "Registrering er midlertidig stengt.");
  }

  let body: RegisterBody;
  try {
    body = (await req.json()) as RegisterBody;
  } catch {
    return jsonError(400, "invalid_json", "Ugyldig JSON i request.");
  }

  // 1) Normalisering
  const companyName = safeText(body.companyName);
  const orgnrRaw = safeText(body.orgnr);
  const orgnr = orgnrRaw ? digitsOnly(orgnrRaw) : null;

  const employeesCount = toInt(body.employeesCount);

  const adminName = safeText(body.adminName);
  const adminEmail = cleanEmail(body.adminEmail);
  const adminPassword = String(body.adminPassword ?? "");
  const adminPhone = safeText(body.adminPhone) ? digitsOnly(body.adminPhone) : null;

  const address = safeText(body.address);
  const postalCode = safeText(body.postalCode) ? digitsOnly(body.postalCode) : null;
  const city = safeText(body.city);

  // 2) Validering
  if (!companyName) return jsonError(400, "missing_companyName", "Mangler firmanavn.");
  if (!Number.isFinite(employeesCount)) return jsonError(400, "invalid_employeesCount", "Ugyldig antall ansatte.");
  if (employeesCount < 20) {
    return jsonError(400, "min_employees", "Firma må ha minimum 20 ansatte.", { min: 20, got: employeesCount });
  }

  if (orgnr && orgnr.length !== 9) return jsonError(400, "invalid_orgnr", "Org.nr må være 9 siffer.", { orgnr });

  if (!adminName) return jsonError(400, "missing_adminName", "Mangler navn på admin.");
  if (!adminEmail || !isEmail(adminEmail)) return jsonError(400, "invalid_email", "Ugyldig e-postadresse.");
  if (!strongEnoughPassword(adminPassword)) {
    return jsonError(400, "weak_password", "Passordet må være minst 10 tegn og inneholde både bokstaver og tall.");
  }

  // 3) Sjekk at orgnr ikke er i bruk (hvis oppgitt)
  if (orgnr) {
    const { data: existingCompany, error: existingCompanyErr } = await sb
      .from("companies")
      .select("id")
      .eq("orgnr", orgnr)
      .maybeSingle();

    if (existingCompanyErr) return jsonError(500, "db_error", "Kunne ikke sjekke org.nr.", existingCompanyErr);
    if (existingCompany) return jsonError(409, "orgnr_exists", "Et firma med dette org.nr finnes allerede.");
  }

  // 4) Opprett auth-user (company_admin)
  const createUserRes = await sb.auth.admin.createUser({
    email: adminEmail,
    password: adminPassword,
    email_confirm: true,
    user_metadata: {
      role: "company_admin" satisfies Role,
      name: adminName,
    },
  });

  if (createUserRes.error) {
    return jsonError(409, "auth_create_failed", "Kunne ikke opprette bruker. E-post kan allerede være registrert.", {
      message: createUserRes.error.message,
    });
  }

  const user = createUserRes.data.user;
  const userId = user?.id;

  if (!userId || !isUuid(userId)) {
    return jsonError(500, "auth_bad_user", "Opprettet bruker mangler gyldig id.");
  }

  // rollback: auth-user
  const rollbackAuthUser = async () => {
    try {
      await sb.auth.admin.deleteUser(userId);
    } catch {
      // best effort
    }
  };

  // 5) Opprett firma (pending)
  const status: CompanyStatus = "pending";

  let companyRow: any = null;

  try {
    companyRow = await insertCompany(sb, {
      name: companyName,
      orgnr,
      status,
      employeesCount,
    });
  } catch (e: any) {
    await rollbackAuthUser();
    return jsonError(500, "company_create_failed", "Kunne ikke opprette firma.", e?.message ?? e);
  }

  const companyId = companyRow?.id;
  if (!companyId || !isUuid(companyId)) {
    // cleanup (best effort)
    try {
      await sb.from("companies").delete().eq("id", companyId ?? "__nope__");
    } catch {}
    await rollbackAuthUser();
    return jsonError(500, "company_bad_id", "Firma ble opprettet, men fikk ugyldig id.");
  }

  const rollbackCompany = async () => {
    try {
      await sb.from("companies").delete().eq("id", companyId);
    } catch {
      // best effort
    }
  };

  // 6) Default lokasjon
  const locationId = crypto.randomUUID();

  const { error: locErr } = await sb.from("company_locations").insert({
    id: locationId,
    company_id: companyId,
    name: "Hovedlokasjon",
    address: address,
    postal_code: postalCode,
    city: city,
  } as any);

  if (locErr) {
    await rollbackCompany();
    await rollbackAuthUser();
    return jsonError(500, "location_create_failed", "Kunne ikke opprette lokasjon.", locErr);
  }

  const rollbackLocation = async () => {
    try {
      await sb.from("company_locations").delete().eq("id", locationId);
    } catch {
      // best effort
    }
  };

  // 7) Profil for admin (må sette role + company_id + location_id)
  try {
    await upsertProfileCompanyAdmin(sb, {
      userId,
      companyId,
      locationId,
      adminName: adminName!,
      adminEmail,
      adminPhone,
    });
  } catch (e: any) {
    await rollbackLocation();
    await rollbackCompany();
    await rollbackAuthUser();
    return jsonError(500, "profile_create_failed", "Kunne ikke opprette profil.", e?.message ?? e);
  }

  return NextResponse.json({
    ok: true,
    company: { id: companyId, status },
    admin: { user_id: userId, email: adminEmail },
    location: { id: locationId },
  });
}
