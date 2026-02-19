// app/api/scope/options/route.ts

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import "server-only";

import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function GET() {
  const rid = makeRid();
  const { supabaseServer } = await import("@/lib/supabase/server");
  const supabase = await supabaseServer();
  const { data: userRes } = await supabase.auth.getUser();
  const user = userRes?.user ?? null;

  if (!user) return jsonErr(rid, "Ikke innlogget.", 401, "AUTH_REQUIRED");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();

  // Kun roller som faktisk kan bestille / sette scope
  if (!profile?.role || !["superadmin", "company_admin", "employee"].includes(profile.role)) {
    return jsonErr(rid, "Ingen tilgang.", 403, "FORBIDDEN");
  }

  let admin: ReturnType<typeof supabaseAdmin>;
  try {
    admin = supabaseAdmin();
  } catch {
    return jsonErr(rid, "Mangler service role-klient.", 500, "MISSING_SERVICE_ROLE_CLIENT");
  }

  const { data: companies, error: cErr } = await admin
    .from("companies")
    .select("id,name")
    .order("name");

  if (cErr) return jsonErr(rid, "Kunne ikke hente firma.", 500, { code: "COMPANIES_FAILED", detail: cErr.message });

  const { data: locations, error: lErr } = await admin
    .from("company_locations")
    .select("id,company_id,name")
    .order("name");

  if (lErr) return jsonErr(rid, "Kunne ikke hente lokasjoner.", 500, { code: "LOCATIONS_FAILED", detail: lErr.message });

  return jsonOk(rid, { ok: true, companies: companies ?? [], locations: locations ?? [] }, 200);
}
