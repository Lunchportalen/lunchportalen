export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";

import { getGlobalIntelligenceSnapshot } from "@/lib/global/intelligenceSnapshot";
import { denyResponse, requireRoleOr403, scopeOr401 } from "@/lib/http/routeGuard";
import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";
import { runInstrumentedApi } from "@/lib/http/withObservability";
import { supabaseAdmin } from "@/lib/supabase/admin";

/**
 * Read-only: beste combo per marked + forhåndsvisning av overføringer (ingen auto-apply).
 */
export async function GET(req: NextRequest): Promise<Response> {
  const gate = await scopeOr401(req);
  if (gate.ok === false) return denyResponse(gate);
  const deny = requireRoleOr403(gate.ctx, ["superadmin"]);
  if (deny) return deny;

  const rid = gate.ctx.rid || makeRid("global_intel");

  return runInstrumentedApi(req, { rid, route: "/api/superadmin/global-intelligence/summary" }, async () => {
    try {
      const admin = supabaseAdmin();
      const snapshot = await getGlobalIntelligenceSnapshot(admin);
      if (!snapshot) {
        return jsonErr(rid, "Kunne ikke lese læringsdata.", 503, "GLOBAL_INTEL_UNAVAILABLE");
      }
      return jsonOk(
        rid,
        {
          graphTotalRevenue: snapshot.graphTotalRevenue,
          bestPerMarket: snapshot.bestPerMarket,
          transferPreview: snapshot.transferPreview,
          safetyNote:
            "Ingen global læring brukes direkte i produksjon. Test lokalt før eventuell rollout.",
        },
        200
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return jsonErr(rid, msg, 500, "GLOBAL_INTEL_FAILED");
    }
  });
}
