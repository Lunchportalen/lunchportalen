// app/api/superadmin/profiles/link-company/route.ts


export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { type NextRequest } from "next/server";
import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";

function jsonError(rid: string, status: number, error: string, message: string, detail?: any) {
  const err = detail !== undefined ? { code: error, detail } : error;
  return jsonErr(rid, message, status, err);
}

function isUuid(v: any): v is string {
  return (
    typeof v === "string" &&
    /^[0-9a-fA-F-]{8}-[0-9a-fA-F-]{4}-[1-5][0-9a-fA-F-]{3}-[89abAB][0-9a-fA-F-]{3}-[0-9a-fA-F-]{12}$/.test(v)
  );
}

export async function POST(req: NextRequest) {
  const rid = makeRid();
  const { supabaseServer } = await import("@/lib/supabase/server");
  const { supabaseAdmin } = await import("@/lib/supabase/admin");
  const sb = await supabaseServer();

  // Bekreft superadmin
  const { data: auth, error: authErr } = await sb.auth.getUser();
  if (authErr) return jsonError(rid, 401, "auth_failed", "Kunne ikke lese innlogget bruker.", authErr);
  const user = auth?.user;
  if (!user) return jsonError(rid, 401, "not_signed_in", "Du må være innlogget.");

  const { data: me, error: meErr } = await sb
    .from("profiles")
    .select("user_id,role,email")
    .eq("user_id", user.id)
    .maybeSingle();

  if (meErr) return jsonError(rid, 500, "me_profile_failed", "Kunne ikke lese din profil.", meErr);
  if (!me || me.role !== "superadmin") return jsonError(rid, 403, "forbidden", "Kun superadmin har tilgang.");

  // Body
  const body = await req.json().catch(() => null);
  const targetUserId = body?.user_id;
  const companyId = body?.company_id;
  const locationId = body?.location_id ?? null;

  if (!isUuid(targetUserId)) return jsonError(rid, 400, "bad_request", "Ugyldig user_id.");
  if (!isUuid(companyId)) return jsonError(rid, 400, "bad_request", "Ugyldig company_id.");
  if (locationId !== null && !isUuid(locationId)) return jsonError(rid, 400, "bad_request", "Ugyldig location_id.");

  // Verifiser firma finnes
  const { data: company, error: cErr } = await sb
    .from("companies")
    .select("id,name,status")
    .eq("id", companyId)
    .maybeSingle();

  if (cErr) return jsonError(rid, 500, "company_read_failed", "Kunne ikke lese firma.", cErr);
  if (!company) return jsonError(rid, 404, "not_found", "Firma finnes ikke.");

  // Oppdater target profile (bruk service role for å slippe RLS-trøbbel)
  const admin = supabaseAdmin();

  const { data: updated, error: uErr } = await admin
    .from("profiles")
    .update({
      company_id: companyId,
      location_id: locationId,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", targetUserId)
    .select("user_id,email,role,company_id,location_id")
    .maybeSingle();

  if (uErr) return jsonError(rid, 500, "profile_update_failed", "Kunne ikke knytte profil til firma.", uErr);
  if (!updated) return jsonError(rid, 404, "not_found", "Profil finnes ikke.");

  // (Valgfritt, men anbefalt) Audit event hvis dere har tabellen
  // Prøver å skrive, men feiler ikke hele requesten hvis audit ikke finnes.
  try {
    await admin.from("audit_events").insert({
      actor_user_id: me.user_id,
      actor_email: me.email,
      actor_role: "superadmin",
      action: "LINK_PROFILE_TO_COMPANY",
      entity_type: "profile",
      entity_id: targetUserId,
      summary: `Knyttet company_admin til firma ${company.name}`,
      detail: { companyId, locationId },
    });
  } catch {}

  return jsonOk(rid, { ok: true, company, profile: updated }, 200);
}

