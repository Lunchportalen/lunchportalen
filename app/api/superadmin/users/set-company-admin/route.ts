

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";

function jsonError(rid: string, status: number, error: string, message: string, detail?: any) {
  const err = detail !== undefined ? { code: error, detail } : error;
  return jsonErr(rid, message, status, err);
}

function cleanEmail(v: any) {
  return String(v ?? "").trim().toLowerCase();
}

export async function POST(req: Request) {
  const rid = makeRid();
  const { supabaseAdmin } = await import("@/lib/supabase/admin");
  try {
    const body = await req.json().catch(() => null);

    const email = cleanEmail(body?.email);
    const companyName = String(body?.companyName ?? "").trim();
    const locationLabel = String(body?.locationLabel ?? "").trim();

    if (!email) return jsonError(rid, 400, "missing_email", "Mangler e-post.");
    if (!companyName) return jsonError(rid, 400, "missing_companyName", "Mangler companyName.");
    if (!locationLabel) return jsonError(rid, 400, "missing_locationLabel", "Mangler locationLabel.");

    const sb = supabaseAdmin();

    // 1) Finn firma
    const { data: company, error: cErr } = await sb
      .from("companies")
      .select("id")
      .eq("name", companyName)
      .maybeSingle();

    if (cErr) return jsonError(rid, 500, "company_lookup_failed", "Kunne ikke slå opp firma.", cErr);
    if (!company?.id) return jsonError(rid, 404, "company_not_found", "Fant ikke firma.");

    // 2) Finn lokasjon (label)
    const { data: loc, error: lErr } = await sb
      .from("company_locations")
      .select("id")
      .eq("company_id", company.id)
      .eq("label", locationLabel)
      .maybeSingle();

    if (lErr) return jsonError(rid, 500, "location_lookup_failed", "Kunne ikke slå opp lokasjon.", lErr);
    if (!loc?.id) return jsonError(rid, 404, "location_not_found", "Fant ikke lokasjon.");

    // 3) Finn auth-user (via listUsers – Supabase mangler getUserByEmail)
    const { data: usersPage, error: listErr } = await sb.auth.admin.listUsers({ page: 1, perPage: 2000 });
    if (listErr) return jsonError(rid, 500, "auth_list_failed", "Kunne ikke hente auth-brukere.", listErr);

    const authUser = (usersPage.users ?? []).find((u) => cleanEmail(u.email) === email);
    if (!authUser?.id) return jsonError(rid, 404, "auth_user_not_found", "Fant ikke auth-bruker på e-post.");

    // 4) Oppdater profile (service role bypasser RLS; trigger kan fortsatt stoppe, men dette er riktig vei i app)
    //    NB: i deres schema bruker dere user_id for kobling (bekreftet i SQL).
    const { error: pErr } = await sb
      .from("profiles")
      .update({
        role: "company_admin",
        company_id: company.id,
        location_id: loc.id,
      } as any)
      .eq("user_id", authUser.id);

    if (pErr) return jsonError(rid, 500, "profile_update_failed", "Kunne ikke oppdatere profile.", pErr);

    // 5) Oppdater auth metadata (rolle)
    const { error: metaErr } = await sb.auth.admin.updateUserById(authUser.id, {
      user_metadata: { ...(authUser.user_metadata ?? {}), role: "company_admin" },
    });

    if (metaErr) return jsonError(rid, 500, "auth_meta_failed", "Kunne ikke oppdatere auth metadata.", metaErr);

    return jsonOk(rid, {
      ok: true,
      email,
      role: "company_admin",
      company_id: company.id,
      location_id: loc.id,
    }, 200);
  } catch (e: any) {
    return jsonError(rid, 500, "server_error", "Uventet feil.", e?.message ?? e);
  }
}

