// app/api/admin/accept-invite/complete/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";
import crypto from "node:crypto";

import { jsonOk, jsonErr, rid as makeRid } from "@/lib/http/respond";
import { readJson } from "@/lib/http/routeGuard";

function safeText(v: unknown, max = 120) {
  const s = String(v ?? "").trim();
  return s ? s.slice(0, max) : null;
}
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

/** Late-bound type */
type AdminClient = ReturnType<typeof import("@/lib/supabase/admin").supabaseAdmin>;

async function getAdmin(): Promise<AdminClient> {
  // ✅ Late import: unngår env-evaluering under next build
  const mod = await import("@/lib/supabase/admin");
  return mod.supabaseAdmin();
}

async function safeDeleteAuthUser(admin: AdminClient, userId: string) {
  try {
    await admin.auth.admin.deleteUser(userId);
  } catch {
    // ignore
  }
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
  const maxRetries = 30; // ~6s
  const sleepMs = 200;

  for (let i = 0; i < maxRetries; i++) {
    const { data, error } = await admin.from("profiles").select("id, company_id").eq("id", userId).maybeSingle();
    if (!error && data?.id) return data as { id: string; company_id: string | null };
    await new Promise((r) => setTimeout(r, sleepMs));
  }
  return null;
}

export async function POST(req: NextRequest) {
  const rid = makeRid();
  const ctx = { rid } as any;

  try {
    const body = await readJson(req);

    const token = String(body?.token ?? "").trim();
    const password = String(body?.password ?? "");
    const password2 = String(body?.password2 ?? "");
    const nameInput = safeText(body?.name ?? body?.full_name ?? body?.fullName, 120);

    if (!token) return jsonErr(ctx, "missing_token", "Mangler token.");
    if (!password || password.length < 10) return jsonErr(ctx, "bad_password", "Passord må være minst 10 tegn.");
    if (password2 && password !== password2) return jsonErr(ctx, "pw_mismatch", "Passordene er ikke like.");

    const admin = await getAdmin();
    const token_hash = sha256Hex(token);
    const nowIso = new Date().toISOString();

    // 1) Finn gyldig invite (ubrukt + ikke utløpt)
    const inv = await admin
      .from("employee_invites")
      .select("id, email, company_id, location_id, department, full_name, expires_at, used_at")
      .eq("token_hash", token_hash)
      .is("used_at", null)
      .gt("expires_at", nowIso)
      .maybeSingle();

    if (inv.error) return jsonErr(ctx, "invite_lookup_failed", "Kunne ikke verifisere invitasjon.", inv.error);
    if (!inv.data) return jsonErr(ctx, "invalid_token", "Ugyldig eller utløpt invitasjon.");

    const email = normEmail(inv.data.email);
    if (!email || !isEmail(email)) return jsonErr(ctx, "invalid_email", "Ugyldig e-post på invitasjonen.");

    const company_id = String(inv.data.company_id ?? "");
    if (!company_id) return jsonErr(ctx, "invite_corrupt", "Invitasjonen mangler company_id.");

    const location_id = inv.data.location_id ? String(inv.data.location_id) : null;
    const department = inv.data.department ?? null;
    const inviteFullName = inv.data.full_name ?? null;

    const full_name =
      nameInput?.trim()
        ? nameInput.trim()
        : inviteFullName?.trim()
          ? inviteFullName.trim()
          : null;

    const displayName = full_name || email;

    // 2) Opprett/oppdater auth-user (idempotent)
    let createdNewAuthUser = false;
    let userId: string | null = null;

    const create = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        role: "employee",
        company_id,
        location_id,
        department,
        full_name,
        name: displayName,
      },
    });

    if (!create.error) {
      createdNewAuthUser = true;
      userId = String((create as any)?.data?.user?.id ?? "") || null;
      if (!userId) {
        const u = await findAuthUserByEmail(admin, email);
        userId = u?.id ? String(u.id) : null;
      }
    } else {
      const existing = await findAuthUserByEmail(admin, email);
      if (!existing?.id) {
        return jsonErr(ctx, "auth_user_lookup_failed", "Kunne ikke opprette eller finne brukerkonto.", {
          create_error: (create as any)?.error?.message ?? "unknown",
        });
      }

      userId = String(existing.id);

      const upd = await admin.auth.admin.updateUserById(userId, {
        password,
        user_metadata: {
          ...(existing.user_metadata ?? {}),
          role: "employee",
          company_id,
          location_id,
          department,
          full_name,
          name: displayName,
        },
      });

      if (upd.error) {
        return jsonErr(ctx, "auth_update_failed", "Kunne ikke oppdatere konto.", (upd as any).error?.message);
      }
    }

    if (!userId) {
      if (createdNewAuthUser) {
        const u = await findAuthUserByEmail(admin, email);
        if (u?.id) await safeDeleteAuthUser(admin, String(u.id));
      }
      return jsonErr(ctx, "auth_not_ready", "Kunne ikke bekrefte bruker i auth.");
    }

    // 3) Vent til profiles finnes (trigger)
    const profile = await waitForProfile(admin, userId);
    if (!profile) {
      if (createdNewAuthUser) await safeDeleteAuthUser(admin, userId);
      return jsonErr(
        ctx,
        "profile_not_created",
        "Profil ble ikke opprettet automatisk. Sjekk DB-trigger på auth.users → public.profiles.",
        { userId }
      );
    }

    // 4) Sikkerhet: company må stemme
    if (!profile.company_id) {
      return jsonErr(ctx, "profile_not_bound", "Profil er ikke knyttet til firma.", { userId });
    }
    if (String(profile.company_id) !== String(company_id)) {
      return jsonErr(ctx, "company_mismatch", "Kontoen er knyttet til et annet firma. Kontakt superadmin.", {
        existingCompany: profile.company_id,
        inviteCompany: company_id,
      });
    }

    // 5) Oppdater trygge felt i profiles (IKKE company_id)
    const profUpd = await admin
      .from("profiles")
      .update({
        email,
        full_name: full_name ?? inviteFullName ?? null,
        name: displayName,
        department,
        location_id,
        role: "employee",
        is_active: true,
        disabled_at: null,
        disabled_reason: null,
      })
      .eq("id", userId);

    if (profUpd.error) return jsonErr(ctx, "profile_update_failed", "Kunne ikke oppdatere profil.", profUpd.error);

    // 6) Marker invitasjon brukt (race-safe)
    const mark = await admin.from("employee_invites").update({ used_at: nowIso }).eq("id", inv.data.id).is("used_at", null);

    if (mark.error) {
      return jsonOk(ctx, {
        ok: true,
        rid,
        message: "Konto opprettet, men kunne ikke markere invitasjon brukt.",
        warning: mark.error,
      });
    }

    return jsonOk(ctx, { ok: true, rid, message: "Konto opprettet." });
  } catch (e: any) {
    return jsonErr(ctx, "server_error", "Uventet feil.", safeStr(e?.message ?? e));
  }
}

export async function GET(_req: NextRequest) {
  const rid = makeRid();
  const ctx = { rid } as any;
  return jsonErr(ctx, "method_not_allowed", "Bruk POST for å fullføre invitasjon.", { method: "GET" });
}
