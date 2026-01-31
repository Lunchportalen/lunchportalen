// app/api/admin/accept-invite/complete/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse, type NextRequest } from "next/server";
import crypto from "node:crypto";

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}
function normEmail(v: unknown) {
  return safeStr(v).toLowerCase();
}
function isEmail(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}
function sha256Hex(input: string) {
  return crypto.createHash("sha256").update(input).digest("hex");
}

async function readJsonLoose(req: NextRequest) {
  // ✅ Ingen imports – robust og CI-safe
  try {
    return await req.json();
  } catch {
    return null;
  }
}

function ok(rid: string, body: any, status = 200) {
  return NextResponse.json({ ok: true, rid, ...body }, { status });
}
function err(rid: string, status: number, code: string, message: string, detail?: any) {
  return NextResponse.json({ ok: false, rid, error: code, message, detail: detail ?? null }, { status });
}

type AdminClient = ReturnType<typeof import("@/lib/supabase/admin").supabaseAdmin>;
async function getAdmin(): Promise<AdminClient> {
  // ✅ Late import – env leses aldri under build
  const mod = await import("@/lib/supabase/admin");
  return mod.supabaseAdmin();
}

async function findAuthUserByEmail(admin: AdminClient, email: string) {
  const target = normEmail(email);
  const perPage = 200;
  const maxPages = 10;

  for (let page = 1; page <= maxPages; page++) {
    const res = await admin.auth.admin.listUsers({ page, perPage });
    const users = ((res as any)?.data?.users as any[]) ?? [];
    const hit = users.find((u) => normEmail(u?.email) === target);
    if (hit?.id) return hit;
    if (users.length < perPage) break;
  }
  return null;
}

async function waitForProfile(admin: AdminClient, userId: string) {
  for (let i = 0; i < 30; i++) {
    const { data, error } = await admin.from("profiles").select("id, company_id").eq("id", userId).maybeSingle();
    if (!error && data?.id) return data as { id: string; company_id: string | null };
    await new Promise((r) => setTimeout(r, 200));
  }
  return null;
}

export async function POST(req: NextRequest) {
  const rid = safeStr(req.headers.get("x-rid")) || `rid_${Date.now()}_${Math.random().toString(16).slice(2)}`;

  const body = (await readJsonLoose(req)) ?? {};
  const token = safeStr((body as any).token);
  const password = String((body as any).password ?? "");
  const password2 = String((body as any).password2 ?? "");

  if (!token) return err(rid, 400, "missing_token", "Mangler token.");
  if (!password || password.length < 10) return err(rid, 400, "bad_password", "Passord må være minst 10 tegn.");
  if (password2 && password !== password2) return err(rid, 400, "pw_mismatch", "Passordene er ikke like.");

  const admin = await getAdmin();
  const token_hash = sha256Hex(token);
  const nowIso = new Date().toISOString();

  // 1) invite
  const inv = await admin
    .from("employee_invites")
    .select("id,email,company_id,location_id,department,full_name,expires_at,used_at")
    .eq("token_hash", token_hash)
    .is("used_at", null)
    .gt("expires_at", nowIso)
    .maybeSingle();

  if (inv.error) return err(rid, 500, "invite_lookup_failed", "Kunne ikke verifisere invitasjon.", inv.error.message);
  if (!inv.data) return err(rid, 400, "invalid_token", "Ugyldig eller utløpt invitasjon.");

  const email = normEmail(inv.data.email);
  if (!email || !isEmail(email)) return err(rid, 400, "invalid_email", "Ugyldig e-post på invitasjonen.");

  const company_id = String(inv.data.company_id ?? "");
  if (!company_id) return err(rid, 500, "invite_corrupt", "Invitasjonen mangler company_id.");

  const full_name = safeStr(inv.data.full_name) || email;

  // 2) create or update user
  let userId: string | null = null;

  const create = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      role: "employee",
      company_id,
      location_id: inv.data.location_id ?? null,
      department: inv.data.department ?? null,
      full_name,
      name: full_name,
    },
  });

  if (!create.error) {
    userId = String((create as any)?.data?.user?.id ?? "") || null;
    if (!userId) {
      const u = await findAuthUserByEmail(admin, email);
      userId = u?.id ? String(u.id) : null;
    }
  } else {
    const existing = await findAuthUserByEmail(admin, email);
    if (!existing?.id) return err(rid, 500, "auth_user_lookup_failed", "Kunne ikke opprette eller finne konto.");

    userId = String(existing.id);

    const upd = await admin.auth.admin.updateUserById(userId, {
      password,
      user_metadata: {
        ...(existing.user_metadata ?? {}),
        role: "employee",
        company_id,
        location_id: inv.data.location_id ?? null,
        department: inv.data.department ?? null,
        full_name,
        name: full_name,
      },
    });

    if (upd.error) return err(rid, 500, "auth_update_failed", "Kunne ikke oppdatere konto.", upd.error.message);
  }

  if (!userId) return err(rid, 500, "auth_not_ready", "Kunne ikke bekrefte bruker i auth.");

  // 3) wait profile
  const profile = await waitForProfile(admin, userId);
  if (!profile) return err(rid, 500, "profile_not_created", "Profil ble ikke opprettet automatisk.", { userId });

  if (!profile.company_id) return err(rid, 500, "profile_not_bound", "Profil er ikke knyttet til firma.", { userId });
  if (String(profile.company_id) !== company_id)
    return err(rid, 403, "company_mismatch", "Kontoen er knyttet til et annet firma.", {
      existingCompany: profile.company_id,
      inviteCompany: company_id,
    });

  // 4) update profile safe fields
  const profUpd = await admin
    .from("profiles")
    .update({
      email,
      full_name,
      name: full_name,
      department: inv.data.department ?? null,
      location_id: inv.data.location_id ?? null,
      role: "employee",
      is_active: true,
      disabled_at: null,
      disabled_reason: null,
    })
    .eq("id", userId);

  if (profUpd.error) return err(rid, 500, "profile_update_failed", "Kunne ikke oppdatere profil.", profUpd.error.message);

  // 5) mark invite used
  const mark = await admin.from("employee_invites").update({ used_at: nowIso }).eq("id", inv.data.id).is("used_at", null);
  if (mark.error) return ok(rid, { message: "Konto opprettet, men kunne ikke markere invitasjon brukt." }, 200);

  return ok(rid, { message: "Konto opprettet." }, 200);
}

export async function GET(req: NextRequest) {
  const rid = safeStr(req.headers.get("x-rid")) || `rid_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  return err(rid, 405, "method_not_allowed", "Bruk POST for å fullføre invitasjon.", { method: "GET" });
}
