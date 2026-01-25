// app/api/superadmin/firms/[companyId]/employees/delete/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

function noStore() {
  return { "Cache-Control": "no-store, max-age=0", Pragma: "no-cache", Expires: "0" };
}
function json(body: any, status = 200) {
  return NextResponse.json(body, { status, headers: noStore() });
}

function norm(v: any) {
  return String(v ?? "").trim().toLowerCase();
}
function isUuid(v: any) {
  return (
    typeof v === "string" &&
    /^[0-9a-fA-F-]{8}-[0-9a-fA-F-]{4}-[1-5][0-9a-fA-F-]{3}-[89abAB][0-9a-fA-F-]{3}-[0-9a-fA-F-]{12}$/.test(v)
  );
}

async function requireSuperadmin() {
  const sb = await supabaseServer();
  const { data: auth, error } = await sb.auth.getUser();
  const user = auth?.user ?? null;
  if (error || !user) throw new Error("not_authenticated");
  if (norm(user.email) !== "superadmin@lunchportalen.no") throw new Error("forbidden");
  return user;
}

function isProtectedSystemEmail(email: string) {
  const e = norm(email);
  return e === "superadmin@lunchportalen.no" || e === "kjokken@lunchportalen.no" || e === "driver@lunchportalen.no";
}

export async function POST(req: Request, ctx: { params: { companyId: string } }) {
  const rid = `sa_emp_del_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

  try {
    const actor = await requireSuperadmin();
    const companyId = String(ctx.params.companyId ?? "");

    const body = await req.json().catch(() => ({}));
    const user_id = String(body.user_id ?? "");

    if (!isUuid(user_id)) return json({ ok: false, rid, error: "invalid_user_id" }, 400);

    const admin = supabaseAdmin();

    // Les profil for å verifisere firma-tilhørighet
    const prof = await admin
      .from("profiles")
      .select("user_id,email,company_id,role")
      .eq("user_id", user_id)
      .maybeSingle();

    if (prof.error) return json({ ok: false, rid, error: "profile_read_failed", detail: prof.error }, 500);
    if (!prof.data) return json({ ok: false, rid, error: "not_found" }, 404);

    const email = String(prof.data.email ?? "");
    if (email && isProtectedSystemEmail(email)) {
      return json({ ok: false, rid, error: "protected_account", message: "Systemkonto kan ikke slettes." }, 403);
    }

    if (String(prof.data.company_id ?? "") !== companyId) {
      return json({ ok: false, rid, error: "tenant_mismatch" }, 403);
    }

    // 1) Slett pending invites for epost (clean-up)
    if (email) {
      await admin.from("employee_invites").delete().eq("email", email);
    }

    // 2) Slett profil
    const delProf = await admin.from("profiles").delete().eq("user_id", user_id);
    if (delProf.error) return json({ ok: false, rid, error: "profile_delete_failed", detail: delProf.error }, 500);

    // 3) Slett auth-user
    const delAuth = await admin.auth.admin.deleteUser(user_id);
    if (delAuth.error) {
      // Profil er allerede slettet, så vi må gi klar beskjed
      return json({ ok: false, rid, error: "auth_delete_failed", message: "Profil slettet, men auth-user kunne ikke slettes.", detail: delAuth.error }, 500);
    }

    // (Valgfritt) Audit – hvis du har audit_events, kan vi insert her også

    return json({ ok: true, rid, message: "Bruker slettet." });
  } catch (e: any) {
    const m = String(e?.message ?? e);
    if (m === "not_authenticated") return json({ ok: false, rid, error: "not_authenticated" }, 401);
    if (m === "forbidden") return json({ ok: false, rid, error: "forbidden" }, 403);
    return json({ ok: false, rid, error: "server_error", detail: m }, 500);
  }
}
