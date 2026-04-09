export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";

import { generateOutboundMessage } from "@/lib/outbound/generator";
import { denyResponse, readJson, requireRoleOr403, scopeOr401 } from "@/lib/http/routeGuard";
import { jsonErr, jsonOk } from "@/lib/http/respond";
import { withApiAiEntrypoint } from "@/lib/http/withApiAiEntrypoint";

export async function POST(req: NextRequest): Promise<Response> {
  return withApiAiEntrypoint(req, "POST", async () => {
    const gate = await scopeOr401(req);
    if (gate.ok === false) return denyResponse(gate);
    const deny = requireRoleOr403(gate.ctx, "api.outbound.generate.POST", ["superadmin"]);
    if (deny) return deny;

    try {
      const body = await readJson(req);
      const o = body && typeof body === "object" && !Array.isArray(body) ? (body as Record<string, unknown>) : {};
      const company = typeof o.company === "string" ? o.company : "";
      const pain = typeof o.pain === "string" ? o.pain : "";
      const message = await generateOutboundMessage({ company, pain });
      return jsonOk(gate.ctx.rid, { message }, 200);
    } catch (e) {
      return jsonErr(gate.ctx.rid, "Kunne ikke generere uttrekk.", 500, "OUTBOUND_GENERATE_FAILED", e);
    }
  });
}
