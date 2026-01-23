// app/api/admin/employees/invite/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

function jsonError(status: number, error: string, message: string, detail?: any) {
  return NextResponse.json({ ok: false, error, message, detail: detail ?? undefined }, { status });
}

function cleanEmail(v: any) {
  return String(v ?? "").trim().toLowerCase();
}
function isEmail(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}
function safeText(v: any, max = 120) {
  const s = String(v ?? "").trim();
  if (!s) return null;
  return s.slice(0, max);
}
function safeUUID(v: any) {
  const s = String(v ?? "").trim();
  if (!s) return null;
  const ok =
    /^[0-9a-fA-F-]{8}-[0-9a-fA-F-]{4}-[1-5][0-9a-fA-F-]{3}-[89abAB][0-9a-fA-F-]{3}-[0-9a-fA-F-]{12}$/.test(s);
  return ok ? s : null;
}

/**
 * Hent innlogget user + profile og verifiser at han er company_admin.
 * Viktig: company_id hentes fra DB, aldri fra klient.
 */
async function requireCompanyAdmin() {
  const sb = await supabaseServer();

  const {
    data: { user },
    error: uerr,
  } = await sb.auth.getUser();

  if (uerr || !user) throw Object.assign(new Error("not_authenticated"), { code: "not_authenticated" });

  const role = String(user.user_metadata?.role ?? "employee").trim().toLowerCase();
  if (role !== "company_admin") throw Object.assign(new Error("forbidden"), { code: "forbidden" });

  const { data: profile, error: perr } = await sb
    .from("profiles")
    .select("user_id, company_id, role, email, full_name")
    .eq("user_id", user.id)
    .maybeSingle();

  if (perr) throw Object.assign(new Error("db_error"), { code: "db_error", detail: perr });
  if (!profile?.company_id) throw Object.assign(new Error("missing_company"), { code: "missing_company" });
  if (String(profile.role ?? "").toLowerCase() !== "company_admin")
    throw Object.assign(new Error("role_mismatch"), { code: "role_mismatch" });

  return { sb, user, profile, companyId: profile.company_id as string };
}

export async function POST(req: Request) {
  const rid = `emp_invite_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

  try {
    const { sb, companyId } = await requireCompanyAdmin();

    const body = await req.json().catch(() => ({}));

    // --- input (rolle IGNORERES uansett) ---
    const email = cleanEmail(body.email);
    const full_name = safeText(body.full_name ?? body.name, 120);
    const department = safeText(body.department, 80);
    const location_id = safeUUID(body.location_id);

    if (!email || !isEmail(email)) return jsonError(400, "invalid_email", "Ugyldig e-postadresse.", { rid });

    // Forhindre at systemkontoer blir invitert som “ansatt”
    const systemEmails = new Set(["superadmin@lunchportalen.no", "kjokken@lunchportalen.no", "driver@lunchportalen.no"]);
    if (systemEmails.has(email)) return jsonError(400, "forbidden_email", "Denne e-posten kan ikke inviteres som ansatt.", { rid });

    // --- Auth: inviter bruker + tving metadata ---
    const admin = supabaseAdmin();

    const { data: invited, error: ierr } = await admin.auth.admin.inviteUserByEmail(email, {
      data: {
        role: "employee", // HARD-LOCK
        company_id: companyId, // DB er fasit, men fint å ha i metadata
        location_id: location_id ?? null,
        department: department ?? null,
        full_name: full_name ?? null,
      },
    });

    if (ierr) return jsonError(400, "invite_failed", "Kunne ikke invitere bruker.", ierr);

    const invitedUserId = invited?.user?.id;
    if (!invitedUserId) return jsonError(500, "invite_missing_id", "Invitasjonen returnerte ikke user id.", { rid });

    // --- DB: upsert profile (HARD-LOCK role=employee) ---
    const { error: upErr } = await admin
      .from("profiles")
      .upsert(
        {
          user_id: invitedUserId,
          email,
          full_name,
          role: "employee",
          company_id: companyId,
          location_id,
          department,
        },
        { onConflict: "user_id" }
      );

    if (upErr) return jsonError(500, "profile_upsert_failed", "Kunne ikke lagre ansattprofil.", upErr);

    // --- employee audit light (best effort) ---
    try {
      const { data: auth } = await sb.auth.getUser();
      const actorEmail = auth?.user?.email ?? null;
      const actorUserId = auth?.user?.id ?? null;

      await admin.from("employee_audit").insert({
        employee_user_id: invitedUserId,
        company_id: companyId,
        actor_user_id: actorUserId,
        actor_email: actorEmail,
        action: "invite",
        diff: { email, full_name, department, location_id, rid },
      });
    } catch {
      // ignore
    }

    return NextResponse.json({
      ok: true,
      rid,
      employee: {
        user_id: invitedUserId,
        email,
        role: "employee",
        company_id: companyId,
        location_id,
        department,
        full_name,
      },
    });
  } catch (e: any) {
    const code = e?.code || "unknown";
    if (code === "not_authenticated") return jsonError(401, "not_authenticated", "Du må være innlogget.", { rid });
    if (code === "forbidden") return jsonError(403, "forbidden", "Ingen tilgang.", { rid });
    if (code === "missing_company") return jsonError(400, "missing_company", "Mangler company_id på admin-profilen.", { rid });
    if (code === "role_mismatch") return jsonError(403, "role_mismatch", "Rolle mismatch mellom auth og profil.", { rid });
    if (code === "db_error") return jsonError(500, "db_error", "Databasefeil.", e?.detail);
    return jsonError(500, "server_error", "Uventet feil.", String(e?.message ?? e));
  }
}
