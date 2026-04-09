export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";

import { getPageEnterpriseInsights } from "@/lib/ai/enterprise/pageInsights";
import { jsonOk, jsonErr, makeRid } from "@/lib/http/respond";
import { withApiAiEntrypoint } from "@/lib/http/withApiAiEntrypoint";
import { denyResponse, requireRoleOr403, scopeOr401 } from "@/lib/http/routeGuard";

export async function GET(req: NextRequest): Promise<Response> {
  return withApiAiEntrypoint(req, "GET", async () => {
  const gate = await scopeOr401(req);
  if (gate.ok === false) return denyResponse(gate);
  const ctx = gate.ctx;
  const deny = requireRoleOr403(ctx, ["superadmin"]);
  if (deny) return deny;

  const rid = ctx.rid || makeRid("ent_page");
  const pageId = new URL(req.url).searchParams.get("pageId")?.trim() ?? "";
  if (!pageId) {
    return jsonErr(rid, "pageId er påkrevd.", 422, "VALIDATION_ERROR");
  }

  const insights = await getPageEnterpriseInsights(pageId, rid);
  if (!insights) {
    return jsonOk(rid, { insights: null, message: "Ingen data eller feil ved lasting." }, 200);
  }
  return jsonOk(rid, { insights }, 200);
  });
}
