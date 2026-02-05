// app/api/admin/invites/register/route.ts

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";

import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";

/* =========================================================
   Types
========================================================= */

type Body = {
  invite: string;
  name: string;
  email: string;
  password: string;
  password2?: string;
};

type FindUserRes = { ok: true; userid: string | null } | { ok: false; error: any };
function isFindUserErr(r: FindUserRes): r is { ok: false; error: any } {
  return (r as any).ok === false;
}

/* =========================================================
   Response helpers (explicit status)
========================================================= */
 

/* =========================================================
   Utils
========================================================= */

function cleanEmail(v: any) {
  return String(v ?? "").trim().toLowerCase();
}
function isEmail(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}
function safeName(v: any) {
  const s = String(v ?? "").trim();
  return s.length >= 2 ? s : null;
}
function safeStr(v: any) {
  return String(v ?? "").trim();
}
function errDetail(e: any) {
  if (!e) return null;
  if (typeof e === "string") return e;
  if (e instanceof Error) return { name: e.name, message: e.message };
  try {
    return JSON.parse(JSON.stringify(e));
  } catch {
    return String(e);
  }
}

async function readJsonSafe(req: NextRequest) {
  const t = await req.text();
  if (!t) return {};
  try {
    return JSON.parse(t);
  } catch {
    return {};
  }
}

/* =========================================================
   Helpers (auth / profile)
========================================================= */

async function listUsersFindByEmail(admin: ReturnType<typeof import("@/lib/supabase/admin").supabaseAdmin>, email: string): Promise<FindUserRes> {
  const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) return { ok: false, error };

  const hit = (data?.users ?? []).find((u: any) => String(u?.email ?? "").toLowerCase() === email);
  return { ok: true, userid: hit?.id ? String(hit.id) : null };
}

async function waitForProfile(admin: ReturnType<typeof import("@/lib/supabase/admin").supabaseAdmin>, userId: string) {
  const maxRetries = 25; // ~5s
  const sleepMs = 200;

  for (let i = 0; i < maxRetries; i++) {
    const { data, error } = await admin.from("profiles").select("id, company_id").eq("id", userId).maybeSingle();
    if (!error && data?.id) return data as { id: string; company_id: string | null };
    await new Promise((r) => setTimeout(r, sleepMs));
  }
  return null;
}

/* =========================================================
   POST
========================================================= */

export async function POST(req: NextRequest) {
  
  const { supabaseAdmin } = await import("@/lib/supabase/admin");
  const rid = makeRid();

  try {
    const raw = (await readJsonSafe(req)) as Partial<Body>;

    const invite = safeStr(raw.invite);
    const name = safeName(raw.name);
    const email = cleanEmail(raw.email);
    const password = String(raw.password ?? "");
    const password2 = String(raw.password2 ?? "");

    if (!invite) return jsonErr(rid, "Mangler invitasjonskode.", 400, "missing_invite");
    if (!name) return jsonErr(rid, "Navn må være minst 2 tegn.", 400, "invalid_name");
    if (!email || !isEmail(email)) return jsonErr(rid, "Ugyldig e-post.", 400, "invalid_email");
    if (!password || password.length < 10) return jsonErr(rid, "Passord må være minst 10 tegn.", 400, "weak_password");
    if (password2 && password !== password2) return jsonErr(rid, "Passordene er ikke like.", 400, "pw_mismatch");

    const admin = supabaseAdmin();

    /* 1) Resolve invite */
    const { data: inv, error: invErr } = await admin
      .from("company_invites")
      .select("code, company_id, revoked_at")
      .eq("code", invite)
      .maybeSingle();

    if (invErr) return jsonErr(rid, "Kunne ikke validere invitasjonskode.", 500, { code: "db_error", detail: errDetail(invErr) });
    if (!inv) return jsonErr(rid, "Invitasjonslenken finnes ikke.", 404, "not_found");
    if ((inv as any).revoked_at) return jsonErr(rid, "Invitasjonslenken er ikke lenger aktiv.", 410, "revoked");

    const company_id = safeStr((inv as any).company_id);
    if (!company_id) return jsonErr(rid, "Invitasjonen mangler company_id.", 500, "invite_corrupt");

    /* 2) Create / update auth user (idempotent) */
    let createdNew = false;

    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name, full_name: name, role: "employee", company_id },
    });

    let userId: string | null = created?.user?.id ? String(created.user.id) : null;

    if (createErr || !userId) {
      const found = await listUsersFindByEmail(admin, email);

      if (isFindUserErr(found)) {
        return jsonErr(rid, "Kunne ikke lese auth-brukere.", 500, { code: "list_users_failed", detail: errDetail(found.error) });
      }

      if (!found.userid) {
        return jsonErr(rid, "Kunne ikke opprette bruker. E-post kan allerede være i bruk.", 400, "create_user_failed");
      }

      userId = found.userid;

      const upd = await admin.auth.admin.updateUserById(userId, {
        password,
        email_confirm: true,
        user_metadata: { name, full_name: name, role: "employee", company_id },
      });

      if (upd.error) {
        return jsonErr(rid, "Kunne ikke oppdatere bruker.", 500, { code: "auth_update_failed", detail: errDetail(upd.error) });
      }
    } else {
      createdNew = true;
    }

    /* 3) Wait for profile */
    const profile = await waitForProfile(admin, userId);

    if (!profile) {
      if (createdNew) {
        try {
          await admin.auth.admin.deleteUser(userId);
        } catch {}
      }
      return jsonErr(rid, "Profil ble ikke opprettet automatisk (mangler trigger).", 500, { code: "profile_not_created", detail: { userId } });
    }

    if (!profile.company_id) {
      return jsonErr(rid, "Profil mangler company_id (trigger-feil).", 500, { code: "profile_not_bound", detail: { userId } });
    }

    if (String(profile.company_id) !== company_id) {
      return jsonErr(rid, "Kontoen er knyttet til et annet firma.", 409, { code: "company_mismatch", detail: {
        existingCompany: profile.company_id,
        inviteCompany: company_id,
      } });
    }

    /* 4) Update profile fields (IKKE company_id) */
    const { error: profUpdErr } = await admin
      .from("profiles")
      .update({
        email,
        name,
        full_name: name,
        role: "employee",
        is_active: true,
        disabled_at: null,
        disabled_reason: null,
      })
      .eq("id", userId);

    if (profUpdErr) {
      return jsonErr(rid, "Kunne ikke oppdatere profil.", 500, { code: "profile_update_failed", detail: errDetail(profUpdErr) });
    }

    return jsonOk(rid, { user_id: userId, company_id, role: "employee" }, 200);
  } catch (e: any) {
    return jsonErr(rid, "Uventet feil ved registrering.", 500, { code: "server_error", detail: errDetail(e) });
  }
}
