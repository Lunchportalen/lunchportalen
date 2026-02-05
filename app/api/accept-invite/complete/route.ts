// app/api/accept-invite/complete/route.ts
// ✅ FASIT (låst/automatisk):
// - company_id/location_id skal komme fra invite (som får location automatisk av DB default_location)
// - vi endrer ALDRI company_id/location_id i profiles via API
// - profiles.location_id er immutable hos dere (guard), så vi oppdaterer den ikke
// - lookup/update i profiles skjer på user_id (siden schema har user_id som kobling mot auth)
// - vi feiler tidlig hvis invite mangler location_id (det betyr at default-lokasjon ikke er satt/trigger mangler)



export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import crypto from "node:crypto";
import { jsonOk, jsonErr, makeRid } from "@/lib/http/respond";

/* =========================
   Response helpers
========================= */
function jsonError(status: number, error: string, message: string, detail?: any) {
  const r = String(detail?.rid ?? "") || makeRid();
  return jsonErr(r, message, status, error);
}

/* =========================
   Utils
========================= */
function safeText(v: any, max = 120) {
  const s = String(v ?? "").trim();
  return s ? s.slice(0, max) : null;
}
function normEmail(v: any) {
  return String(v ?? "").trim().toLowerCase();
}
function isEmail(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}
function sha256Hex(input: string) {
  return crypto.createHash("sha256").update(input).digest("hex");
}
function toMs(v: any): number | null {
  const d = new Date(String(v ?? ""));
  const ms = d.getTime();
  return Number.isFinite(ms) ? ms : null;
}

async function safeDeleteAuthUser(admin: ReturnType<typeof import("@/lib/supabase/admin").supabaseAdmin>, userId: string) {
  try {
    await admin.auth.admin.deleteUser(userId);
  } catch {}
}

/** ⚠️ listUsers kan være paginert – vi bruker den kun som fallback (dev/små miljø). */
async function listAuthUsers(admin: ReturnType<typeof import("@/lib/supabase/admin").supabaseAdmin>) {
  const res = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const users = (res as any)?.data?.users as any[] | undefined;
  return users ?? [];
}
async function findAuthUserByEmail(admin: ReturnType<typeof import("@/lib/supabase/admin").supabaseAdmin>, email: string) {
  const users = await listAuthUsers(admin);
  return users.find((u) => normEmail(u?.email) === email) ?? null;
}

/**
 * ✅ Best-effort venting på profiles (opprettes av trigger/flow)
 * NB: lookup på user_id (ikke id) pga schema/guard.
 * Vi FEILER IKKE hvis den ikke er synlig ennå.
 */
async function waitForProfileRowByUserId(admin: ReturnType<typeof import("@/lib/supabase/admin").supabaseAdmin>, userId: string) {
  const maxRetries = 20; // ~4s
  const sleepMs = 200;

  for (let i = 0; i < maxRetries; i++) {
    const p = await admin
      .from("profiles")
      .select("id, user_id, company_id, location_id")
      .eq("user_id", userId)
      .maybeSingle();

    if (!p.error && p.data?.user_id) {
      return p.data as { id: string; user_id: string; company_id: string | null; location_id: string | null };
    }

    await new Promise((r) => setTimeout(r, sleepMs));
  }
  return null;
}

/* =========================
   Route
========================= */
export async function POST(req: Request) {
  
  const { supabaseAdmin } = await import("@/lib/supabase/admin");
  const rid = `accept_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

  try {
    const body = await req.json().catch(() => ({}));

    const token = String(body.token ?? "").trim();
    const password = String(body.password ?? "");
    const password2 = String(body.password2 ?? "");
    const nameInput = safeText(body.name ?? body.full_name ?? body.fullName, 120);

    if (!token) return jsonError(400, "missing_token", "Mangler token.", { rid });
    if (!password || password.length < 10) return jsonError(400, "bad_password", "Passord må være minst 10 tegn.", { rid });
    if (password2 && password !== password2) return jsonError(400, "pw_mismatch", "Passordene er ikke like.", { rid });

    const admin = supabaseAdmin();
    const token_hash = sha256Hex(token);
    const nowIso = new Date().toISOString();

    // 1) Finn invite (les used_at for idempotens)
    const inv = await admin
      .from("employee_invites")
      .select("id, email, company_id, location_id, department, full_name, expires_at, used_at")
      .eq("token_hash", token_hash)
      .maybeSingle();

    if (inv.error) return jsonError(500, "invite_lookup_failed", "Kunne ikke verifisere invitasjon.", { rid, detail: inv.error });
    if (!inv.data) return jsonError(400, "invalid_token", "Ugyldig invitasjon.", { rid });

    const email = normEmail(inv.data.email);
    if (!email || !isEmail(email)) return jsonError(400, "invalid_email", "Ugyldig e-post på invitasjonen.", { rid });

    // Idempotens: brukt invite → returner OK (frontend kan sende til /login)
    if (inv.data.used_at) {
      return jsonOk(rid, {
        ok: true,
        rid,
        email,
        needsLogin: true,
        pendingProfile: true,
        message: "Invitasjonen er allerede brukt. Logg inn med e-post og passord.",
      });
    }

    // Utløpt?
    const expMs = toMs(inv.data.expires_at);
    const nowMs = Date.now();
    if (!expMs || expMs <= nowMs) {
      return jsonError(400, "invalid_token", "Ugyldig eller utløpt invitasjon.", { rid });
    }

    const company_id = inv.data.company_id ? String(inv.data.company_id) : "";
    if (!company_id) return jsonError(500, "invite_corrupt", "Invitasjonen mangler company_id.", { rid });

    // ✅ LÅST: location_id må alltid finnes (skal settes automatisk av DB default-location ved invite)
    const location_id = inv.data.location_id ? String(inv.data.location_id) : "";
    if (!location_id) {
      return jsonError(
        409,
        "missing_location",
        "Firmaet mangler standard-lokasjon. Kontakt support/superadmin.",
        { rid, company_id }
      );
    }

    const department = inv.data.department ?? null;
    const inviteFullName = inv.data.full_name ?? null;

    const full_name =
      nameInput?.trim()
        ? nameInput.trim()
        : inviteFullName && String(inviteFullName).trim()
          ? String(inviteFullName).trim()
          : null;

    const displayName = full_name || email;

    // 2) Opprett/oppdater auth-user (metadata for senere DB-sync/innhold)
    let createdNewAuthUser = false;
    let userId: string | null = null;

    const create = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        role: "employee",
        company_id,
        location_id, // ✅ alltid satt
        department,
        full_name,
        name: displayName,
      },
    });

    if (!create.error) {
      createdNewAuthUser = true;
      userId = String((create as any)?.data?.user?.id ?? "");
      if (!userId) {
        const u = await findAuthUserByEmail(admin, email);
        userId = u?.id ? String(u.id) : null;
      }
    } else {
      const existing = await findAuthUserByEmail(admin, email);
      if (!existing?.id) {
        return jsonError(500, "auth_user_lookup_failed", "Kunne ikke opprette eller finne brukerkonto.", {
          rid,
          detail: (create as any)?.error?.message ?? "createUser failed",
        });
      }

      userId = String(existing.id);

      const upd = await admin.auth.admin.updateUserById(userId, {
        password,
        user_metadata: {
          ...(existing.user_metadata ?? {}),
          role: "employee",
          company_id,
          location_id, // ✅ alltid satt
          department,
          full_name,
          name: displayName,
        },
      });

      if (upd.error) return jsonError(500, "auth_update_failed", "Kunne ikke oppdatere konto.", { rid, detail: upd.error.message });
    }

    if (!userId) {
      if (createdNewAuthUser) {
        const u = await findAuthUserByEmail(admin, email);
        if (u?.id) await safeDeleteAuthUser(admin, String(u.id));
      }
      return jsonError(500, "auth_not_ready", "Kunne ikke bekrefte bruker i auth.", { rid });
    }

    // 3) Best-effort: vent kort på profiles (lookup på user_id)
    const profile = await waitForProfileRowByUserId(admin, userId);

    // 4) Hvis profiles finnes: mismatch-sjekk + oppdater KUN trygge felt (aldri company_id/location_id)
    let pendingProfile = false;
    let warning: any = null;

    if (!profile) {
      pendingProfile = true;
    } else {
      // Hvis company_id mangler i profile ennå → treat som latency
      if (!profile.company_id) {
        pendingProfile = true;
      } else if (String(profile.company_id) !== String(company_id)) {
        return jsonError(
          409,
          "company_mismatch",
          "Kontoen finnes allerede og er knyttet til et annet firma. Kontakt superadmin.",
          { rid, existingCompany: profile.company_id, inviteCompany: company_id }
        );
      }

      // ❗ IKKE sett location_id her (immutable)
      const profUpd = await admin
        .from("profiles")
        .update({
          email,
          full_name: full_name ?? inviteFullName ?? null,
          name: displayName,
          department,
          role: "employee",
          is_active: true,
          disabled_at: null,
          disabled_reason: null,
        })
        .eq("user_id", userId);

      if (profUpd.error) {
        pendingProfile = true;
        warning = { profileUpdate: profUpd.error };
      }
    }

    // 5) Marker invitasjon brukt (idempotent)
    const mark = await admin
      .from("employee_invites")
      .update({ used_at: nowIso })
      .eq("id", inv.data.id)
      .is("used_at", null);

    if (mark.error) {
      return jsonOk(rid, {
        ok: true,
        rid,
        userId,
        email,
        needsLogin: true,
        pendingProfile: true,
        message: "Konto opprettet, men kunne ikke markere invitasjon brukt.",
        warning: { ...(warning ?? {}), inviteMark: mark.error },
      });
    }

    return jsonOk(rid, {
      ok: true,
      rid,
      userId,
      email,
      needsLogin: true,
      pendingProfile,
      message: "Konto opprettet. Logg inn for å fullføre.",
      warning: warning ?? undefined,
    });
  } catch (e: any) {
    return jsonError(500, "server_error", "Uventet feil.", { rid, detail: String(e?.message ?? e) });
  }
}

export async function GET() {
  return jsonError(405, "method_not_allowed", "Bruk POST for å fullføre invitasjon.");
}
