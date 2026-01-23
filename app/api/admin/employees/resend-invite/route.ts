// app/api/admin/employees/resend-invite/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse, type NextRequest } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

function jsonError(status: number, error: string, message: string, detail?: any) {
  return NextResponse.json({ ok: false, error, message, detail: detail ?? undefined }, { status });
}

function isUuid(v: any): v is string {
  return (
    typeof v === "string" &&
    /^[0-9a-fA-F-]{8}-[0-9a-fA-F-]{4}-[1-5][0-9a-fA-F-]{3}-[89abAB][0-9a-fA-F-]{3}-[0-9a-fA-F-]{12}$/.test(v)
  );
}

function normEmail(v: any) {
  return String(v ?? "").trim().toLowerCase();
}

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
    .select("user_id, company_id, role")
    .eq("user_id", user.id)
    .maybeSingle();

  if (perr) throw Object.assign(new Error("db_error"), { code: "db_error", detail: perr });
  if (!profile?.company_id) throw Object.assign(new Error("missing_company"), { code: "missing_company" });
  if (String(profile.role ?? "").toLowerCase() !== "company_admin")
    throw Object.assign(new Error("role_mismatch"), { code: "role_mismatch" });

  return { sb, companyId: String(profile.company_id) };
}

export async function POST(req: NextRequest) {
  const rid = `resend_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

  try {
    const { sb, companyId } = await requireCompanyAdmin();

    const body = await req.json().catch(() => ({} as any));
    const userId = String(body?.user_id ?? "").trim();

    if (!isUuid(userId)) return jsonError(400, "invalid_user_id", "Mangler/ugyldig user_id.", { rid });

    // 1) Verify employee belongs to company + fetch email + disabled state
    const { data: prof, error: pErr } = await sb
      .from("profiles")
      .select("user_id,email,company_id,role,disabled_at")
      .eq("user_id", userId)
      .maybeSingle();

    if (pErr) return jsonError(500, "db_error", "Kunne ikke lese ansattprofil.", pErr);
    if (!prof) return jsonError(404, "not_found", "Ansatt finnes ikke.", { rid });

    if (String((prof as any).company_id) !== companyId) return jsonError(403, "forbidden", "Ingen tilgang.", { rid });
    if (String((prof as any).role ?? "").toLowerCase() !== "employee")
      return jsonError(403, "forbidden_role", "Kun employee kan få ny invitasjon.", { rid });
    if ((prof as any).disabled_at) return jsonError(409, "disabled", "Ansatt er deaktivert. Aktiver før invitasjon.", { rid });

    const email = normEmail((prof as any).email);
    if (!email) return jsonError(400, "missing_email", "Ansatt mangler e-post.", { rid });

    // blokkér systemkontoer uansett (failsafe)
    const systemEmails = new Set(["superadmin@lunchportalen.no", "kjokken@lunchportalen.no", "driver@lunchportalen.no"]);
    if (systemEmails.has(email)) return jsonError(400, "forbidden_email", "Kan ikke invitere systemkonto.", { rid });

    // 2) Check auth user activity (avoid spamming active users)
    const admin = supabaseAdmin();

    const { data: uData, error: uErr } = await admin.auth.admin.getUserById(userId);
    if (uErr) return jsonError(500, "auth_read_failed", "Kunne ikke lese auth-bruker.", uErr);

    const au = uData?.user as any;
    const lastSignIn = (au?.last_sign_in_at as string | null) ?? null;
    if (lastSignIn) {
      return jsonError(409, "already_active", "Brukeren er allerede aktiv (har logget inn).", { rid });
    }

    // 3) Re-send invite by email (Supabase sends invite mail)
    const { error: invErr } = await admin.auth.admin.inviteUserByEmail(email, {
      data: {
        // HARD-LOCK metadata
        role: "employee",
        company_id: companyId,
      },
    });

    if (invErr) return jsonError(400, "invite_failed", "Kunne ikke sende invitasjon på nytt.", invErr);

    // 4) Employee audit light (best effort)
    try {
      const { data: auth } = await sb.auth.getUser();
      const actorEmail = auth?.user?.email ?? null;
      const actorUserId = auth?.user?.id ?? null;

      await admin.from("employee_audit").insert({
        employee_user_id: userId,
        company_id: companyId,
        actor_user_id: actorUserId,
        actor_email: actorEmail,
        action: "resend_invite",
        diff: { email, rid },
      });
    } catch {
      // ignore
    }

    return NextResponse.json({ ok: true, rid, user_id: userId, email }, { status: 200 });
  } catch (e: any) {
    const code = e?.code || "unknown";
    if (code === "not_authenticated") return jsonError(401, "not_authenticated", "Du må være innlogget.");
    if (code === "forbidden") return jsonError(403, "forbidden", "Ingen tilgang.");
    if (code === "missing_company") return jsonError(400, "missing_company", "Mangler company_id på admin-profilen.");
    if (code === "role_mismatch") return jsonError(403, "role_mismatch", "Rolle mismatch mellom auth og profil.");
    if (code === "db_error") return jsonError(500, "db_error", "Databasefeil.", e?.detail);
    return jsonError(500, "server_error", "Uventet feil.", String(e?.message ?? e));
  }
}
