export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";

import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";
import { runInstrumentedApi } from "@/lib/http/withObservability";
import { denyResponse, requireRoleOr403, scopeOr401 } from "@/lib/http/routeGuard";
import { withApiAiEntrypoint } from "@/lib/http/withApiAiEntrypoint";
import { executeUnifiedSocialGenerate } from "@/lib/social/unifiedGenerateHandler";
import { socialAiGenerateBodySchema } from "@/lib/validation/schemas";
import { parseValidatedJson } from "@/lib/validation/withValidation";

/**
 * POST: samme motor som `/api/social/unified/generate` — AI (`generateConversionPost`) med deterministisk fallback + valgfri persist.
 * Respons er additiv vs. eldre `{ text, hashtags, platform, aiOk }`.
 */
export async function POST(req: NextRequest): Promise<Response> {
  return withApiAiEntrypoint(req, "POST", async () => {
    let rid = makeRid("social_ai_generate");
    try {
      const gate = await scopeOr401(req);
      if (gate.ok === false) return denyResponse(gate);
      const deny = requireRoleOr403(gate.ctx, ["superadmin"]);
      if (deny) return deny;

      rid = gate.ctx.rid || rid;
      return runInstrumentedApi(req, { rid, route: "/api/social/ai/generate" }, async () => {
        const validated = await parseValidatedJson(socialAiGenerateBodySchema, req, rid);
        if (validated.ok === false) return validated.response;
        const { result, savedId, saved } = await executeUnifiedSocialGenerate(validated.data);

        return jsonOk(
          rid,
          {
            text: result.text,
            hashtags: result.hashtags,
            images: result.images,
            platform: result.platform,
            source: result.source,
            aiOk: result.aiOk,
            calendarPostId: result.calendarPostId,
            revenueTrackingPath: result.revenueTrackingPath ?? null,
            link: result.link ?? null,
            saved,
            savedId,
          },
          200,
        );
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      return jsonErr(rid, message, 500, "SOCIAL_AI_GENERATE_UNHANDLED");
    }
  });
}
