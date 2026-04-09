// app/onboarding/complete/route.ts
// DEPRECATED — do not use. Canonical onboarding commit: POST /api/onboarding/complete (same payload contract).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

/**
 * ONBOARDING COMPLETE (PUBLIC ENDPOINT)
 * ------------------------------------
 * ✅ Ingen innlogging kreves (onboarding skal være offentlig)
 * ✅ Ingen profiles INSERT her (FK-race / profiles_id_fkey). DB-trigger på auth.users skal opprette profiles-raden.
 * ✅ company_id settes via auth.user_metadata ved createUser (trigger leser metadata).
 * ✅ Ved feil etter company-opprettelse: rollback company + auth-user (best effort) => ingen e-post blir igjen "låst"
 *
 * Flyt:
 * 1) Valider input (ingen skriving)
 * 2) Sjekk e-post finnes i auth (ingen skriving)
 * 3) Sjekk orgnr finnes (ingen skriving)
 * 4) Opprett company (pending)
 * 5) Opprett auth-user (company_admin) med user_metadata: company_id + role + navn/telefon
 * 6) Vent til profile-raden finnes (trigger) og oppdater trygge felter (IKKE company_id)
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

async function adminClient(): Promise<any> {
  const s: any = supabaseAdmin as any;
  return typeof s === "function" ? await s() : s;
}

async function findAuthUserIdByEmail(SB: any, email: string): Promise<string | null> {
  const { data, error } = await SB.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) throw error;

  const hit = (data?.users ?? []).find((u: any) => String(u.email ?? "").toLowerCase() === email);
  return hit?.id ?? null;
}

async function insertCompanyRobust(SB: any, payload: any) {
  const attempt = async (p: any) => SB.from("companies").insert(p).select("id").single();

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

async function waitForProfile(SB: any, userId: string) {
  const maxRetries = 25; // ~5s
  const sleepMs = 200;

  for (let i = 0; i < maxRetries; i++) {
    const { data, error } = await SB.from("profiles").select("id, company_id, role").eq("id", userId).maybeSingle();
    if (!error && data?.id) return { ok: true as const, data };
    await new Promise((r) => setTimeout(r, sleepMs));
  }

  return { ok: false as const, error: { message: "PROFILE_NOT_CREATED" } };
}

export async function POST(req: Request) {
  const SB = await adminClient();
  if (!SB?.from || !SB?.auth?.admin) {
    return jsonError(500, "ADMIN_CLIENT_MISSING", "supabaseAdmin er ikke tilgjengelig (mangler .from/.auth.admin)");
  }

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
  if (!Number.isFinite(employee_count) || employee_count < 20) return jsonError(400, "VALIDATION", "Firma må ha minimum 20 ansatte");

  if (!isNonEmpty(full_name, 2)) return jsonError(400, "VALIDATION", "Navn er påkrevd");
  if (!isEmail(email)) return jsonError(400, "VALIDATION", "Ugyldig e-postadresse");
  if (phone.length < 6) return jsonError(400, "VALIDATION", "Telefon er påkrevd");
  if (password.length < 10) return jsonError(400, "VALIDATION", "Passord må være minimum 10 tegn");
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

  // 4) pre-flight: sjekk om orgnr allerede finnes
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
      status: "pending",
      plan_tier: "BASIS",
      employee_count,
    });

    if (insCompany.error) throw insCompany.error;
    companyId = insCompany.data.id;

    // 5b) opprett auth-user (FØRST NÅ) — metadata brukes av DB-trigger til å opprette profiles-raden korrekt
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
    if (createErr) throw createErr;

    userId = created?.user?.id ?? null;
    if (!userId) throw new Error("AUTH_CREATE_NO_USER_ID");

    // 5c) vent til profile finnes (trigger) + oppdater trygge felter (IKKE company_id)
    const waited = await waitForProfile(SB, userId);
    if (!waited.ok) throw waited.error;

    const profUpd = await SB
      .from("profiles")
      .update({
        role: "company_admin",
        name: full_name,
        full_name,
        phone,
        email,
        is_active: true,
        disabled_at: null,
        disabled_reason: null,
      })
      .eq("id", userId);

    if (profUpd.error) throw profUpd.error;

    return NextResponse.json({ ok: true, companyId, userId }, { status: 200 });
  } catch (e: any) {
    // 6) ROLLBACK: ingen e-post skal ligge igjen ved feil
    try {
      if (userId) await SB.auth.admin.deleteUser(userId);
    } catch {}
    try {
      if (companyId) await SB.from("companies").delete().eq("id", companyId);
    } catch {}

    return jsonError(500, "ONBOARDING_FAILED", "Registrering feilet – ingen data er lagret.", e?.message ?? e);
  }
}
