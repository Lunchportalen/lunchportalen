export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";

import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";
import { denyResponse, requireRoleOr403, scopeOr401 } from "@/lib/http/routeGuard";
import { hasSupabaseAdminConfig, supabaseAdmin } from "@/lib/supabase/admin";

/** GET: list persisted social posts (superadmin). */
export async function GET(req: NextRequest): Promise<Response> {
  const rid = makeRid("social_posts_list");
  try {
    const gate = await scopeOr401(req);
    if (gate.ok === false) return denyResponse(gate);
    const deny = requireRoleOr403(gate.ctx, ["superadmin"]);
    if (deny) return deny;

    if (!hasSupabaseAdminConfig()) {
      return jsonErr(rid, "Supabase admin er ikke konfigurert.", 503, "CONFIG_ERROR");
    }

    const { data, error } = await supabaseAdmin()
      .from("social_posts")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      return jsonErr(rid, error.message, 500, "SOCIAL_POSTS_FETCH_FAILED", { detail: error });
    }

    return jsonOk(rid, data ?? [], 200);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return jsonErr(rid, message, 500, "SOCIAL_POSTS_LIST_UNHANDLED");
  }
}
