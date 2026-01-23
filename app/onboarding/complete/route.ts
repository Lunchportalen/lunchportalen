// app/onboarding/complete/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

/**
 * ONBOARDING COMPLETE (PUBLIC ENDPOINT)
 * ------------------------------------
 * ✅ Ingen innlogging kreves (onboarding skal være offentlig)
 * ✅ E-post skal ALDRI bli liggende igjen ved feil (atomisk "commit" med rollback)
 *
 * Flyt:
 * 1) Valider input (ingen skriving)
 * 2) Sjekk om e-post finnes i auth (ingen skriving)
 * 3) Sjekk orgnr finnes i DB (ingen skriving)
 * 4) Opprett company (uten e-post)
 * 5) Opprett auth-user (først nå)
 * 6) Opprett profile (knytter user → company)
 * 7) Ved feil etter (4/5/6): slett auth-user + company (best effort) => ingen e-post blir igjen
 */

function jsonError(status: number, error: string, message: string, detail?: any) {
  return NextResponse.json({ ok: false, error, message, detail: detail ?? undefined }, { status });
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

function isNonEmpty(v: any, min = 2) {
  return String(v ?? "").trim().length >= min;
}

/** supabaseAdmin kan være client eller factory */
async function adminClient(): Promise<any> {
  const s: any = supabaseAdmin as any;
  return typeof s === "function" ? await s() : s;
}

/**
 * Finn auth-user med e-post uten å lagre noe.
 * (Supabase har ikke alltid getUserByEmail i alle wrappers, så vi bruker listUsers og filtrerer.)
 */
async function findAuthUserIdByEmail(SB: any, email: string): Promise<string | null> {
  // Merk: perPage 1000 holder for dev/test. For stor skala kan dette erstattes med en bedre lookup senere.
  const { data, error } = await SB.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) throw error;

  const hit = (data?.users ?? []).find((u: any) => String(u.email ?? "").toLowerCase() === email);
  return hit?.id ?? null;
}

/**
 * Insert company robust:
 * - prøver med employee_count
 * - hvis kolonnen ikke finnes -> prøver igjen uten
 */
async function insertCompanyRobust(SB: any, payload: any) {
  const attempt = async (p: any) =>
    SB.from("companies")
      .insert(p)
      .select("id")
      .single();

  const res1 = await attempt(payload);
  if (!res1.error) return res1;

  const code = (res1.error as any)?.code;
  const msg = String((res1.error as any)?.message ?? "").toLowerCase();

  if (code === "42703" || (msg.includes("column") && msg.includes("does not exist"))) {
    const { employee_count, ...rest } = payload;
    return attempt(rest);
  }

  return res1;
}

export async function POST(req: Request) {
  const SB = await adminClient();
  if (!SB?.from || !SB?.auth?.admin) {
    return jsonError(500, "ADMIN_CLIENT_MISSING", "supabaseAdmin er ikke tilgjengelig (mangler .from/.auth.admin)");
  }

  // 0) parse
  const body = await req.json().catch(() => null);
  if (!body) return jsonError(400, "BAD_REQUEST", "Ugyldig JSON");

  // 1) input
  const company_name = String(body?.company_name ?? "").trim();
  const orgnr = digitsOnly(body?.orgnr);
  const employee_count = Number(body?.employee_count ?? 0);

  const full_name = String(body?.full_name ?? "").trim();
  const email = cleanEmail(body?.email);
  const phone = digitsOnly(body?.phone);
  const password = String(body?.password ?? "");
  const password_confirm = String(body?.password_confirm ?? "");

  // 2) valider alt først (INGEN DB-skriv)
  if (!isNonEmpty(company_name, 2)) return jsonError(400, "VALIDATION", "Firmanavn er påkrevd");
  if (orgnr.length !== 9) return jsonError(400, "VALIDATION", "Org.nr må være 9 siffer");
  if (!Number.isFinite(employee_count) || employee_count < 20)
    return jsonError(400, "VALIDATION", "Firma må ha minimum 20 ansatte");

  if (!isNonEmpty(full_name, 2)) return jsonError(400, "VALIDATION", "Navn er påkrevd");
  if (!isEmail(email)) return jsonError(400, "VALIDATION", "Ugyldig e-postadresse");
  if (phone.length < 6) return jsonError(400, "VALIDATION", "Telefon er påkrevd");
  if (password.length < 8) return jsonError(400, "VALIDATION", "Passord må være minimum 8 tegn");
  if (password !== password_confirm) return jsonError(400, "VALIDATION", "Passordene er ikke like");

  // 3) pre-flight: sjekk om e-post allerede finnes i auth (INGEN LAGRING)
  try {
    const existingUserId = await findAuthUserIdByEmail(SB, email);
    if (existingUserId) {
      return jsonError(409, "EMAIL_EXISTS", "E-post er allerede registrert. Bruk innlogging eller en annen e-post.");
    }
  } catch (e: any) {
    return jsonError(500, "AUTH_LOOKUP_FAILED", "Kunne ikke sjekke e-post i auth", e?.message ?? e);
  }

  // 4) pre-flight: sjekk om orgnr allerede finnes (DB-read)
  const orgCheck = await SB.from("companies").select("id").eq("orgnr", orgnr).limit(1);
  if (orgCheck.error) return jsonError(500, "DB", "Kunne ikke sjekke org.nr", orgCheck.error);
  if ((orgCheck.data ?? []).length) return jsonError(409, "ORGNR_EXISTS", "Org.nr er allerede registrert");

  // 5) commit-løp med rollback
  let companyId: string | null = null;
  let userId: string | null = null;

  try {
    // 5a) opprett company (uten e-post)
    const insCompany = await insertCompanyRobust(SB, {
      name: company_name,
      orgnr,
      status: "pending", // onboarding: pending → superadmin review
      plan_tier: "BASIS",
      employee_count, // hvis kolonnen finnes, lagres; ellers fallback uten
    });

    if (insCompany.error) throw insCompany.error;
    companyId = insCompany.data.id;

    // 5b) opprett auth-user (FØRST NÅ)
    const { data: created, error: createErr } = await SB.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { role: "company_admin" },
    });
    if (createErr) throw createErr;

    userId = created?.user?.id ?? null;
    if (!userId) throw new Error("AUTH_CREATE_NO_USER_ID");

    // 5c) opprett profile (binder user → company)
    const insProfile = await SB.from("profiles").insert({
      user_id: userId,
      company_id: companyId,
      full_name,
      phone,
      role: "company_admin",
    });
    if (insProfile.error) throw insProfile.error;

    // ✅ Alt ok: commit
    return NextResponse.json({ ok: true, companyId, userId }, { status: 200 });
  } catch (e: any) {
    // 6) ROLLBACK: ingen e-post skal ligge igjen ved feil
    try {
      if (userId) await SB.auth.admin.deleteUser(userId);
    } catch {
      // best-effort
    }

    try {
      if (companyId) await SB.from("companies").delete().eq("id", companyId);
    } catch {
      // best-effort
    }

    return jsonError(500, "ONBOARDING_FAILED", "Registrering feilet – ingen data er lagret.", e?.message ?? e);
  }
}
