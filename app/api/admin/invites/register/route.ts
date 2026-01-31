// app/api/admin/invites/register/route.ts

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";

import { rid as makeRid } from "@/lib/http/respond";
import { noStoreHeaders } from "@/lib/http/noStore";

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
function jsonErr(status: number, rid: string, error: string, message: string, detail?: any) {
  const body = { ok: false, rid, error, message, detail: detail ?? undefined };
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...noStoreHeaders(), "content-type": "application/json; charset=utf-8" },
  });
}
function jsonOk(rid: string, body: any, status = 200) {
  return new Response(JSON.stringify({ ...body, rid }), {
    status,
    headers: { ...noStoreHeaders(), "content-type": "application/json; charset=utf-8" },
  });
}

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

    if (!invite) return jsonErr(400, rid, "missing_invite", "Mangler invitasjonskode.");
    if (!name) return jsonErr(400, rid, "invalid_name", "Navn må være minst 2 tegn.");
    if (!email || !isEmail(email)) return jsonErr(400, rid, "invalid_email", "Ugyldig e-post.");
    if (!password || password.length < 10) return jsonErr(400, rid, "weak_password", "Passord må være minst 10 tegn.");
    if (password2 && password !== password2) return jsonErr(400, rid, "pw_mismatch", "Passordene er ikke like.");

    const admin = supabaseAdmin();

    /* 1) Resolve invite */
    const { data: inv, error: invErr } = await admin
      .from("company_invites")
      .select("code, company_id, revoked_at")
      .eq("code", invite)
      .maybeSingle();

    if (invErr) return jsonErr(500, rid, "db_error", "Kunne ikke validere invitasjonskode.", errDetail(invErr));
    if (!inv) return jsonErr(404, rid, "not_found", "Invitasjonslenken finnes ikke.");
    if ((inv as any).revoked_at) return jsonErr(410, rid, "revoked", "Invitasjonslenken er ikke lenger aktiv.");

    const company_id = safeStr((inv as any).company_id);
    if (!company_id) return jsonErr(500, rid, "invite_corrupt", "Invitasjonen mangler company_id.");

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
        return jsonErr(500, rid, "list_users_failed", "Kunne ikke lese auth-brukere.", errDetail(found.error));
      }

      if (!found.userid) {
        return jsonErr(400, rid, "create_user_failed", "Kunne ikke opprette bruker. E-post kan allerede være i bruk.");
      }

      userId = found.userid;

      const upd = await admin.auth.admin.updateUserById(userId, {
        password,
        email_confirm: true,
        user_metadata: { name, full_name: name, role: "employee", company_id },
      });

      if (upd.error) {
        return jsonErr(500, rid, "auth_update_failed", "Kunne ikke oppdatere bruker.", errDetail(upd.error));
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
      return jsonErr(500, rid, "profile_not_created", "Profil ble ikke opprettet automatisk (mangler trigger).", { userId });
    }

    if (!profile.company_id) {
      return jsonErr(500, rid, "profile_not_bound", "Profil mangler company_id (trigger-feil).", { userId });
    }

    if (String(profile.company_id) !== company_id) {
      return jsonErr(409, rid, "company_mismatch", "Kontoen er knyttet til et annet firma.", {
        existingCompany: profile.company_id,
        inviteCompany: company_id,
      });
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
      return jsonErr(500, rid, "profile_update_failed", "Kunne ikke oppdatere profil.", errDetail(profUpdErr));
    }

    return jsonOk(rid, { ok: true, user_id: userId, company_id, role: "employee" }, 200);
  } catch (e: any) {
    return jsonErr(500, rid, "server_error", "Uventet feil ved registrering.", errDetail(e));
  }
}


