// app/api/admin/accept-invite/complete/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { type NextRequest } from "next/server";
import crypto from "node:crypto";
import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";

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
  const rid = makeRid();

  const body = (await readJsonLoose(req)) ?? {};
  const token = safeStr((body as any).token);
  const password = String((body as any).password ?? "");
  const password2 = String((body as any).password2 ?? "");

  if (!token) return jsonErr(rid, "Mangler token.", 400, "missing_token");
  if (!password || password.length < 10) return jsonErr(rid, "Passord må være minst 10 tegn.", 400, "bad_password");
  if (password2 && password !== password2) return jsonErr(rid, "Passordene er ikke like.", 400, "pw_mismatch");

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

  if (inv.error) return jsonErr(rid, "Kunne ikke verifisere invitasjon.", 500, { code: "invite_lookup_failed", detail: inv.error.message });
  if (!inv.data) return jsonErr(rid, "Ugyldig eller utløpt invitasjon.", 400, "invalid_token");

  const email = normEmail(inv.data.email);
  if (!email || !isEmail(email)) return jsonErr(rid, "Ugyldig e-post på invitasjonen.", 400, "invalid_email");

  const company_id = String(inv.data.company_id ?? "");
  if (!company_id) return jsonErr(rid, "Invitasjonen mangler company_id.", 500, "invite_corrupt");

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
    if (!existing?.id) return jsonErr(rid, "Kunne ikke opprette eller finne konto.", 500, "auth_user_lookup_failed");

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

    if (upd.error) return jsonErr(rid, "Kunne ikke oppdatere konto.", 500, { code: "auth_update_failed", detail: upd.error.message });
  }

  if (!userId) return jsonErr(rid, "Kunne ikke bekrefte bruker i auth.", 500, "auth_not_ready");

  // 3) wait profile
  const profile = await waitForProfile(admin, userId);
  if (!profile) return jsonErr(rid, "Profil ble ikke opprettet automatisk.", 500, { code: "profile_not_created", detail: { userId } });

  if (!profile.company_id) return jsonErr(rid, "Profil er ikke knyttet til firma.", 500, { code: "profile_not_bound", detail: { userId } });
  if (String(profile.company_id) !== company_id)
    return jsonErr(rid, "Kontoen er knyttet til et annet firma.", 403, { code: "company_mismatch", detail: {
      existingCompany: profile.company_id,
      inviteCompany: company_id,
    } });

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

  if (profUpd.error) return jsonErr(rid, "Kunne ikke oppdatere profil.", 500, { code: "profile_update_failed", detail: profUpd.error.message });

  // 5) mark invite used
  const mark = await admin.from("employee_invites").update({ used_at: nowIso }).eq("id", inv.data.id).is("used_at", null);
  if (mark.error) return jsonOk(rid, { message: "Konto opprettet, men kunne ikke markere invitasjon brukt." }, 200);

  return jsonOk(rid, { message: "Konto opprettet." }, 200);
}

export async function GET(req: NextRequest) {
  const rid = makeRid();
  return jsonErr(rid, "Bruk POST for å fullføre invitasjon.", 405, { code: "method_not_allowed", detail: { method: "GET" } });
}
