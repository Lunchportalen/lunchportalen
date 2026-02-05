// app/api/register/route.ts
// ✅ Oppdatert til "profiles.id === auth.users.id" + ingen profiles INSERT/UPSERT i samme løype som createUser
// - DB-trigger på auth.users skal opprette profiles-raden (id = auth.users.id) og sette company_id fra user_metadata
// - Denne ruten: oppretter company + default location, oppretter auth-user med metadata, venter på profiles, oppdaterer trygge felter (ikke company_id)



export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { type NextRequest } from "next/server";
import crypto from "node:crypto";
import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";

type Role = "employee" | "company_admin" | "superadmin" | "kitchen" | "driver";
type CompanyStatus = "pending" | "active" | "paused" | "closed";

function jsonError(rid: string, status: number, error: string, message: string, detail?: any) {
  const err = detail !== undefined ? { code: error, detail } : error;
  return jsonErr(rid, message, status, err);
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
function registrationsEnabled(req: NextRequest) {
  const enabled = String(process.env.REGISTRATIONS_ENABLED ?? "").toLowerCase() === "true";
  if (enabled) return true;

  const key = (process.env.REGISTRATIONS_ADMIN_KEY ?? "").trim();
  if (!key) return false;

  const provided = (req.headers.get("x-registration-key") ?? "").trim();
  return !!provided && provided === key;
}

type RegisterBody = {
  companyName: string;
  orgnr?: string | null;
  employeesCount: number;

  address?: string | null;
  postalCode?: string | null;
  city?: string | null;

  adminName: string;
  adminEmail: string;
  adminPassword: string;
  adminPhone?: string | null;
};

// -----------------------------
// DB helpers (robuste varianter)
// -----------------------------
async function insertCompany(
  sb: ReturnType<typeof import("@/lib/supabase/admin").supabaseAdmin>,
  payload: { name: string; orgnr: string | null; status: CompanyStatus; employeesCount: number }
) {
  const variants: any[] = [
    { name: payload.name, orgnr: payload.orgnr, status: payload.status, employees_count: payload.employeesCount },
    { name: payload.name, orgnr: payload.orgnr, status: payload.status, employee_count: payload.employeesCount },
    { name: payload.name, orgnr: payload.orgnr, status: payload.status, employees: payload.employeesCount },
    { name: payload.name, orgnr: payload.orgnr, status: payload.status },
  ];

  let lastErr: any = null;

  for (const v of variants) {
    const { data, error } = await sb.from("companies").insert(v).select("*").single();
    if (!error && data?.id) return { data, error: null };
    lastErr = error;
  }

  return { data: null, error: lastErr ?? new Error("company_create_failed") };
}

async function waitForProfile(sb: ReturnType<typeof import("@/lib/supabase/admin").supabaseAdmin>, userId: string) {
  const maxRetries = 25; // ~5s
  const sleepMs = 200;

  for (let i = 0; i < maxRetries; i++) {
    const { data, error } = await sb.from("profiles").select("id, company_id").eq("id", userId).maybeSingle();
    if (!error && data?.id) return { ok: true as const, data };
    await new Promise((r) => setTimeout(r, sleepMs));
  }

  return { ok: false as const, error: { message: "PROFILE_NOT_CREATED" } };
}

export async function POST(req: NextRequest) {
  
  const { supabaseAdmin } = await import("@/lib/supabase/admin");
  const rid = makeRid();
  const sb = supabaseAdmin();

  // 0) Hard gate
  if (!registrationsEnabled(req)) {
    return jsonError(rid, 403, "registrations_disabled", "Registrering er midlertidig stengt.");
  }

  let body: RegisterBody;
  try {
    body = (await req.json()) as RegisterBody;
  } catch {
    return jsonError(rid, 400, "invalid_json", "Ugyldig JSON i request.");
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
  if (!companyName) return jsonError(rid, 400, "missing_companyName", "Mangler firmanavn.");
  if (!Number.isFinite(employeesCount)) return jsonError(rid, 400, "invalid_employeesCount", "Ugyldig antall ansatte.");
  if (employeesCount < 20) return jsonError(rid, 400, "min_employees", "Firma må ha minimum 20 ansatte.", { min: 20, got: employeesCount });

  if (orgnr && orgnr.length !== 9) return jsonError(rid, 400, "invalid_orgnr", "Org.nr må være 9 siffer.", { orgnr });

  if (!adminName) return jsonError(rid, 400, "missing_adminName", "Mangler navn på admin.");
  if (!adminEmail || !isEmail(adminEmail)) return jsonError(rid, 400, "invalid_email", "Ugyldig e-postadresse.");
  if (!strongEnoughPassword(adminPassword)) {
    return jsonError(rid, 400, "weak_password", "Passordet må være minst 10 tegn og inneholde både bokstaver og tall.");
  }

  // 3) Sjekk at orgnr ikke er i bruk (hvis oppgitt)
  if (orgnr) {
    const { data: existingCompany, error: existingCompanyErr } = await sb.from("companies").select("id").eq("orgnr", orgnr).maybeSingle();
    if (existingCompanyErr) return jsonError(rid, 500, "db_error", "Kunne ikke sjekke org.nr.", existingCompanyErr);
    if (existingCompany) return jsonError(rid, 409, "orgnr_exists", "Et firma med dette org.nr finnes allerede.");
  }

  // 4) Opprett firma (pending) først, så default location, så auth-user med metadata som trigger bruker
  const status: CompanyStatus = "pending";
  let companyRow: any = null;
  let companyId: string | null = null;
  let locationId: string | null = null;
  let userId: string | null = null;

  // rollback helpers
  const rollbackAuthUser = async () => {
    try {
      if (userId) await sb.auth.admin.deleteUser(userId);
    } catch {}
  };
  const rollbackLocation = async () => {
    try {
      if (locationId) await sb.from("company_locations").delete().eq("id", locationId);
    } catch {}
  };
  const rollbackCompany = async () => {
    try {
      if (companyId) await sb.from("companies").delete().eq("id", companyId);
    } catch {}
  };

  const fail = async (e: any) => {
    await rollbackAuthUser();
    await rollbackLocation();
    await rollbackCompany();
    return jsonErr(rid, "Registrering feilet â€“ ingen data er lagret.", 500, { code: "register_failed", detail: {
      message: String(e?.message ?? e),
      detail: e?.detail ?? undefined,
    } });
  };

  try {
    // 4a) company
    const insCompany = await insertCompany(sb, { name: companyName, orgnr, status, employeesCount });
    if (insCompany.error) return await fail(insCompany.error);
    companyRow = insCompany.data;
    companyId = companyRow?.id ?? null;

    if (!companyId || !isUuid(companyId)) return await fail(new Error("company_bad_id"));

    // 4b) default location
    locationId = crypto.randomUUID();
    const { error: locErr } = await sb.from("company_locations").insert({
      id: locationId,
      company_id: companyId,
      name: "Hovedlokasjon",
      address: address,
      postal_code: postalCode,
      city: city,
    } as any);

    if (locErr) return await fail(locErr);

    // 4c) auth-user (company_admin) — metadata brukes av DB-trigger til å lage profiles.id-raden med riktig company_id uten app-insert
    const createUserRes = await sb.auth.admin.createUser({
      email: adminEmail,
      password: adminPassword,
      email_confirm: true,
      user_metadata: {
        role: "company_admin" satisfies Role,
        name: adminName,
        full_name: adminName,
        phone: adminPhone,
        company_id: companyId,
        location_id: locationId,
      },
    });

    if (createUserRes.error) {
      return await fail(Object.assign(new Error("auth_create_failed"), { detail: createUserRes.error.message }));
    }

    const user = createUserRes.data.user;
    userId = user?.id ?? null;

    if (!userId || !isUuid(userId)) return await fail(new Error("auth_bad_user"));

    // 4d) wait for trigger-created profile + update safe fields (IKKE company_id)
    const waited = await waitForProfile(sb, userId);
    if (!waited.ok) return await fail(Object.assign(new Error("profile_not_created"), { detail: waited.error }));

    const profUpd = await sb
      .from("profiles")
      .update({
        role: "company_admin",
        name: adminName,
        full_name: adminName,
        phone: adminPhone,
        email: adminEmail,
        location_id: locationId,
        is_active: true,
        disabled_at: null,
        disabled_reason: null,
      })
      .eq("id", userId);

    if (profUpd.error) return await fail(profUpd.error);

    return jsonOk(rid, {
      ok: true,
      company: { id: companyId, status },
      admin: { user_id: userId, email: adminEmail },
      location: { id: locationId },
    }, 200);
  } catch (e: any) {
    await rollbackAuthUser();
    await rollbackLocation();
    await rollbackCompany();

    return jsonError(rid, 500, "register_failed", "Registrering feilet – ingen data er lagret.", {
      message: String(e?.message ?? e),
      detail: e?.detail ?? undefined,
    });
  }
}


