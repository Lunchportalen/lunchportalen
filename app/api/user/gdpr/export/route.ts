export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";

import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";
import { denyResponse, scopeOr401 } from "@/lib/http/routeGuard";
import { supabaseServer } from "@/lib/supabase/server";

/**
 * GET: eksporter begrenset profilinformasjon for innlogget bruker (dataminimering).
 */
export async function GET(req: NextRequest): Promise<Response> {
  const gate = await scopeOr401(req);
  if (gate.ok === false) return denyResponse(gate);

  const rid = gate.ctx.rid || makeRid("gdpr_export");
  const uid = gate.ctx.scope.userId;
  if (!uid) {
    return jsonErr(rid, "Mangler bruker-ID.", 401, "UNAUTHORIZED");
  }

  try {
    const sb = await supabaseServer();
    const { data, error } = await sb
      .from("profiles")
      .select("id, role, company_id, location_id, created_at, updated_at")
      .eq("id", uid)
      .maybeSingle();

    if (error) {
      return jsonErr(rid, "Kunne ikke hente profil.", 503, "PROFILE_READ_FAILED");
    }
    if (!data) {
      return jsonErr(rid, "Profil ikke funnet.", 404, "PROFILE_NOT_FOUND");
    }

    return jsonOk(
      rid,
      {
        purpose: "brukerinitiert eksport (GDPR art. 15 / dataminimering)",
        generatedAt: new Date().toISOString(),
        profile: data,
      },
      200,
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return jsonErr(rid, "Eksport feilet.", 500, "GDPR_EXPORT_FAILED", process.env.NODE_ENV !== "production" ? { message: msg } : undefined);
  }
}
