export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";

import { computeSocialAbDecisions } from "@/lib/social/abDecisionsCore";
import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";
import { denyResponse, requireRoleOr403, scopeOr401 } from "@/lib/http/routeGuard";
import { hasSupabaseAdminConfig } from "@/lib/supabase/admin";

/** GET: vinnere per variant-gruppe + skaleringsforslag (samme datagrunnlag som /api/social/ab/analytics, uten intern HTTP). */
export async function GET(req: NextRequest): Promise<Response> {
  const rid = makeRid("social_ab_decisions");
  try {
    const gate = await scopeOr401(req);
    if (gate.ok === false) return denyResponse(gate);
    const deny = requireRoleOr403(gate.ctx, ["superadmin"]);
    if (deny) return deny;

    if (!hasSupabaseAdminConfig()) {
      return jsonErr(rid, "Supabase admin er ikke konfigurert.", 503, "CONFIG_ERROR");
    }

    const dec = await computeSocialAbDecisions();
    if (dec.ok === false) {
      return jsonErr(rid, dec.error, 500, "SOCIAL_AB_DECISIONS_FAILED");
    }

    return jsonOk(rid, { winners: dec.data.winners, actions: dec.data.actions }, 200);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return jsonErr(rid, message, 500, "SOCIAL_AB_DECISIONS_UNHANDLED");
  }
}
