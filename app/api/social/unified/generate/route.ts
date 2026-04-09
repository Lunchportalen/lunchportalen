export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";

import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";
import { denyResponse, readJson, requireRoleOr403, scopeOr401 } from "@/lib/http/routeGuard";
import { executeUnifiedSocialGenerate } from "@/lib/social/unifiedGenerateHandler";

/**
 * POST: samme motor som `/api/social/ai/generate` — beholdt for bakoverkompatibilitet.
 */
export async function POST(req: NextRequest): Promise<Response> {
  const gate = await scopeOr401(req);
  if (gate.ok === false) return denyResponse(gate);
  const deny = requireRoleOr403(gate.ctx, ["superadmin"]);
  if (deny) return deny;

  const rid = gate.ctx.rid || makeRid("social_unified_generate");

  try {
    const body = await readJson(req);
    const { result, savedId, saved } = await executeUnifiedSocialGenerate(body);

    return jsonOk(
      rid,
      {
        text: result.text,
        hashtags: result.hashtags,
        images: result.images,
        source: result.source,
        platform: result.platform,
        aiOk: result.aiOk,
        calendarPostId: result.calendarPostId,
        revenueTrackingPath: result.revenueTrackingPath ?? null,
        link: result.link ?? null,
        saved,
        savedId,
      },
      200,
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return jsonErr(rid, message, 500, "SOCIAL_UNIFIED_GENERATE_FAILED");
  }
}
