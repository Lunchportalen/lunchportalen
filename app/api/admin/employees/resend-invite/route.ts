// app/api/admin/employees/resend-invite/route.ts

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";


// ✅ Dag-10 standard: respond + routeGuard (rid + no-store + ok-contract)
import { jsonOk, jsonErr } from "@/lib/http/respond";
import { scopeOr401, requireRoleOr403, requireCompanyScopeOr403, readJson } from "@/lib/http/routeGuard";

function isUuid(v: any): v is string {
  return (
    typeof v === "string" &&
    /^[0-9a-fA-F-]{8}-[0-9a-fA-F-]{4}-[1-5][0-9a-fA-F-]{3}-[89abAB][0-9a-fA-F-]{3}-[0-9a-fA-F-]{12}$/.test(v)
  );
}

function normEmail(v: any) {
  return String(v ?? "").trim().toLowerCase();
}

export async function POST(req: NextRequest) {
  
  const { supabaseAdmin } = await import("@/lib/supabase/admin");
  const { supabaseServer } = await import("@/lib/supabase/server");
  const a = await scopeOr401(req);
  if (a.ok === false) return a.res;

  const { rid, scope } = a.ctx;

  const denyRole = requireRoleOr403(a.ctx, "admin.employees.resend_invite", ["company_admin"]);
  if (denyRole) return denyRole;

  const denyScope = requireCompanyScopeOr403(a.ctx);
  if (denyScope) return denyScope;

  const companyId = String(scope.companyId ?? "").trim();
  if (!companyId) return jsonErr(409, rid, "SCOPE_MISSING", "Mangler companyId i scope.");

  const body = await readJson(req);
  const userId = String((body as any)?.user_id ?? "").trim();
  if (!isUuid(userId)) return jsonErr(400, rid, "INVALID_USER_ID", "Mangler/ugyldig user_id.");

  try {
    const sb = await supabaseServer();

    // Verify employee belongs to company + fetch email + disabled state
    const { data: prof, error: pErr } = await sb
      .from("profiles")
      .select("id,email,company_id,role,disabled_at")
      .eq("id", userId) // profiles.id = auth.user.id
      .maybeSingle();

    if (pErr) return jsonErr(500, rid, "DB_ERROR", "Kunne ikke lese ansattprofil.", { message: pErr.message });
    if (!prof) return jsonErr(404, rid, "NOT_FOUND", "Ansatt finnes ikke.");

    if (String((prof as any).company_id ?? "") !== companyId) return jsonErr(403, rid, "FORBIDDEN", "Ingen tilgang.");
    if (String((prof as any).role ?? "").toLowerCase() !== "employee") {
      return jsonErr(403, rid, "FORBIDDEN_ROLE", "Kun employee kan få ny invitasjon.");
    }
    if ((prof as any).disabled_at) {
      return jsonErr(409, rid, "DISABLED", "Ansatt er deaktivert. Aktiver før invitasjon.");
    }

    const email = normEmail((prof as any).email);
    if (!email) return jsonErr(400, rid, "MISSING_EMAIL", "Ansatt mangler e-post.");

    // failsafe: blokkér systemkontoer
    const systemEmails = new Set(["superadmin@lunchportalen.no", "kjokken@lunchportalen.no", "driver@lunchportalen.no"]);
    if (systemEmails.has(email)) return jsonErr(400, rid, "FORBIDDEN_EMAIL", "Kan ikke invitere systemkonto.");

    const admin = supabaseAdmin();

    // Check auth user activity (avoid spamming active users)
    const { data: uData, error: uErr } = await admin.auth.admin.getUserById(userId);
    if (uErr) return jsonErr(500, rid, "AUTH_READ_FAILED", "Kunne ikke lese auth-bruker.", { message: uErr.message });

    const au = (uData as any)?.user as any;
    const lastSignIn = (au?.last_sign_in_at as string | null) ?? null;
    if (lastSignIn) {
      return jsonErr(409, rid, "ALREADY_ACTIVE", "Brukeren er allerede aktiv (har logget inn).", { lastSignIn });
    }

    // Re-send invite by email (Supabase sends invite mail)
    const { error: invErr } = await admin.auth.admin.inviteUserByEmail(email, {
      data: {
        role: "employee",
        company_id: companyId,
      },
    });

    if (invErr) return jsonErr(400, rid, "INVITE_FAILED", "Kunne ikke sende invitasjon på nytt.", { message: invErr.message });

    // Employee audit light (best effort)
    try {
      const actorEmail = scope.email ?? null;
      const actorUserId = String(scope.userId ?? "").trim() || null;

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

    return jsonOk({ ok: true, rid, user_id: userId, email }, 200);
  } catch (e: any) {
    return jsonErr(500, rid, "UNHANDLED", "Uventet feil.", { message: String(e?.message ?? e) });
  }
}


