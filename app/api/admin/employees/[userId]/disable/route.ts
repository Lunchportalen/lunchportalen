// app/api/admin/employees/[userId]/disable/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

type RouteCtx = {
  params: { userId: string } | Promise<{ userId: string }>;
};

function jsonError(status: number, error: string, message: string, detail?: any) {
  return NextResponse.json({ ok: false, error, message, detail: detail ?? undefined }, { status });
}

function isUuid(v: any) {
  return (
    typeof v === "string" &&
    /^[0-9a-fA-F-]{8}-[0-9a-fA-F-]{4}-[1-5][0-9a-fA-F-]{3}-[89abAB][0-9a-fA-F-]{3}-[0-9a-fA-F-]{12}$/.test(v)
  );
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
    .select("user_id, company_id, role")
    .eq("user_id", user.id)
    .maybeSingle();

  if (perr) throw Object.assign(new Error("db_error"), { code: "db_error", detail: perr });
  if (!profile?.company_id) throw Object.assign(new Error("missing_company"), { code: "missing_company" });
  if (String(profile.role ?? "").toLowerCase() !== "company_admin")
    throw Object.assign(new Error("role_mismatch"), { code: "role_mismatch" });

  return { sb, user, companyId: profile.company_id as string };
}

export async function PATCH(req: Request, ctx: RouteCtx) {
  try {
    const params = await Promise.resolve(ctx.params);
    const targetUserId = params?.userId;

    if (!isUuid(targetUserId)) return jsonError(400, "invalid_user_id", "Ugyldig userId.");

    const { sb, companyId } = await requireCompanyAdmin();

    const body = await req.json().catch(() => ({}));
    const disabled = !!body?.disabled; // true => disable, false => enable

    // 1) Hent target profile og verifiser same company + role=employee
    const { data: target, error: terr } = await sb
      .from("profiles")
      .select("user_id, company_id, role, disabled_at, email, full_name")
      .eq("user_id", targetUserId)
      .maybeSingle();

    if (terr) return jsonError(500, "db_error", "Kunne ikke lese ansattprofil.", terr);
    if (!target) return jsonError(404, "not_found", "Fant ikke ansatt.");

    if (String((target as any).company_id) !== String(companyId)) {
      return jsonError(403, "forbidden", "Du har ikke tilgang til denne brukeren.");
    }

    if (String((target as any).role ?? "").toLowerCase() !== "employee") {
      return jsonError(403, "forbidden_role", "Kun ansatte (employee) kan deaktiveres.");
    }

    // 2) Oppdater disabled_at
    const nextDisabledAt = disabled ? new Date().toISOString() : null;

    const { data: updated, error: uerr } = await sb
      .from("profiles")
      .update({ disabled_at: nextDisabledAt })
      .eq("user_id", targetUserId)
      .select("user_id, email, full_name, role, company_id, disabled_at")
      .maybeSingle();

    if (uerr) return jsonError(500, "update_failed", "Kunne ikke oppdatere ansatt.", uerr);

    // 3) Audit light (best effort, må aldri stoppe operasjonen)
    try {
      const { data: auth } = await sb.auth.getUser();
      const actorEmail = auth?.user?.email ?? null;
      const actorUserId = auth?.user?.id ?? null;

      await sb.from("employee_audit").insert({
        employee_user_id: targetUserId,
        company_id: companyId,
        actor_user_id: actorUserId,
        actor_email: actorEmail,
        action: disabled ? "disable" : "enable",
        diff: { disabled, prev_disabled_at: (target as any).disabled_at ?? null, next_disabled_at: nextDisabledAt },
      });
    } catch {
      // ignore
    }

    return NextResponse.json({
      ok: true,
      employee: updated,
    });
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
