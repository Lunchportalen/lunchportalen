import type { NextRequest } from "next/server";

import { getSystemIntelligence } from "@/lib/ai/intelligence";
import { jsonOk, jsonErr } from "@/lib/http/respond";
import { requireRoleOr403, scopeOr401 } from "@/lib/http/routeGuard";
import { withApiAiEntrypoint } from "@/lib/http/withApiAiEntrypoint";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/** GET: full system intelligence bundle for CMS dashboard (superadmin). */
export async function GET(req: NextRequest) {
  return withApiAiEntrypoint(req, "GET", async () => {
    const gate = await scopeOr401(req);
    if (gate.ok === false) return gate.res;
    const deny = requireRoleOr403(gate.ctx, ["superadmin"]);
    if (deny) return deny;
    const ctx = gate.ctx;

    try {
      const intel = await getSystemIntelligence({
        limit: 1200,
        recentEventLimit: 100,
      });
      return jsonOk(ctx.rid, intel, 200);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "INTEL_LOAD_FAILED";
      return jsonErr(ctx.rid, msg, 500, "INTEL_LOAD_FAILED");
    }
  });
}
