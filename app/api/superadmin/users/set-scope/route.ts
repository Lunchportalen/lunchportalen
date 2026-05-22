// app/api/superadmin/users/set-scope/route.ts


export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";

type Role = "employee" | "company_admin" | "superadmin" | "kitchen" | "driver";

function jsonError(rid: string, status: number, error: string, message: string, detail?: any) {
  const err = detail !== undefined ? { code: error, detail } : error;
  return jsonErr(rid, message, status, err);
}

function clean(v: any) {
  return String(v ?? "").trim();
}

function cleanEmail(v: any) {
  return clean(v).toLowerCase();
}

function isUuid(v: any) {
  return (
    typeof v === "string" &&
    /^[0-9a-fA-F-]{8}-[0-9a-fA-F-]{4}-[1-5][0-9a-fA-F-]{3}-[89abAB][0-9a-fA-F-]{3}-[0-9a-fA-F-]{12}$/.test(v)
  );
}

function normRole(v: any): Role | null {
  const r = clean(v).toLowerCase();
  if (r === "employee") return "employee";
  if (r === "company_admin") return "company_admin";
  if (r === "superadmin") return "superadmin";
  if (r === "kitchen") return "kitchen";
  if (r === "driver") return "driver";
  return null;
}

export async function POST(req: Request) {
  const { supabaseServer } = await import("@/lib/supabase/server");
  const rid = makeRid();
  try {
    const body = await req.json().catch(() => null);
    if (!body) return jsonError(rid, 400, "invalid_json", "Ugyldig JSON i request.");

    const email = cleanEmail(body.email ?? body.p_target_email);
    const role = normRole(body.role ?? body.p_role);

    // Tillat enten direkte UUID eller (anbefalt) navn/label
    let company_id = body.company_id ?? body.p_company_id ?? null;
    let location_id = body.location_id ?? body.p_location_id ?? null;

    const companyName = clean(body.companyName ?? body.company_name ?? "");
    const locationLabel = clean(body.locationLabel ?? body.location_label ?? "");

    if (!email) return jsonError(rid, 400, "missing_email", "Mangler e-post.");
    if (!role) return jsonError(rid, 400, "invalid_role", "Ugyldig rolle.");

    const supabase = await supabaseServer();

    // Må være innlogget
    const { data: auth, error: authErr } = await supabase.auth.getUser();
    if (authErr) return jsonError(rid, 401, "unauthenticated", "Ikke innlogget.", authErr);
    if (!auth?.user) return jsonError(rid, 401, "unauthenticated", "Ikke innlogget.");

    // Ekstra sikkerhet: verifiser superadmin i profiles (RPC sjekker også)
    const { data: me, error: meErr } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", auth.user.id)
      .maybeSingle();

    if (meErr) return jsonError(rid, 500, "profile_read_failed", "Kunne ikke lese profil.", meErr);
    if (String(me?.role ?? "").toLowerCase() !== "superadmin") {
      return jsonError(rid, 403, "forbidden", "Kun superadmin kan endre rolle/scope.");
    }

    // ✅ For roller som trenger scope: slå opp IDs robust (unngå copy/paste UUID-problemer)
    if (role === "employee" || role === "company_admin") {
      // Hvis UUID mangler/er ugyldig, slå opp via navn/label
      if (!company_id || !isUuid(String(company_id))) {
        if (!companyName) {
          return jsonError(rid, 400, "missing_company", "Mangler companyName (eller gyldig company_id).");
        }
        const { data: c, error: cErr } = await supabase
          .from("companies")
          .select("id")
          .eq("name", companyName)
          .maybeSingle();

        if (cErr) return jsonError(rid, 500, "company_lookup_failed", "Kunne ikke finne firma.", cErr);
        if (!c?.id) return jsonError(rid, 404, "company_not_found", "Fant ikke firma.");
        company_id = c.id;
      }

      if (!location_id || !isUuid(String(location_id))) {
        if (!locationLabel) {
          return jsonError(rid, 400, "missing_location", "Mangler locationLabel (eller gyldig location_id).");
        }
        const { data: l, error: lErr } = await supabase
          .from("company_locations")
          .select("id")
          .eq("company_id", company_id)
          .eq("label", locationLabel)
          .maybeSingle();

        if (lErr) return jsonError(rid, 500, "location_lookup_failed", "Kunne ikke finne lokasjon.", lErr);
        if (!l?.id) return jsonError(rid, 404, "location_not_found", "Fant ikke lokasjon.");
        location_id = l.id;
      }
    } else {
      // For andre roller: scope skal være null
      company_id = null;
      location_id = null;
    }

    const { data: target, error: tErr } = await supabase
      .from("profiles")
      .select("id, email, role, company_id, location_id")
      .eq("email", email)
      .maybeSingle();

    if (tErr) return jsonError(rid, 500, "profile_read_failed", "Kunne ikke lese målprofil.", tErr);
    if (!target?.id) return jsonError(rid, 404, "profile_not_found", "Fant ikke profil for e-post.");

    const { supabaseAdmin } = await import("@/lib/supabase/admin");
    const admin = supabaseAdmin();

    const { data: updated, error: uErr } = await admin
      .from("profiles")
      .update({
        role,
        company_id,
        location_id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", target.id)
      .select("email, role, company_id, location_id")
      .single();

    if (uErr) {
      console.error("[api/superadmin/users/set-scope] update error:", uErr);
      return jsonError(rid, 500, "update_failed", "Kunne ikke oppdatere rolle/scope.", uErr);
    }

    return jsonOk(
      rid,
      {
        ok: true,
        email: updated.email,
        role: updated.role,
        company_id: updated.company_id,
        location_id: updated.location_id,
      },
      200
    );
  } catch (e: any) {
    console.error("[api/superadmin/users/set-scope] server error:", e);
    return jsonError(rid, 500, "server_error", "Uventet feil.", e?.message ?? e);
  }
}

