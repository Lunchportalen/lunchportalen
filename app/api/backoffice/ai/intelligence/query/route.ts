import type { NextRequest } from "next/server";

import { answerIntelligenceQuestion, getSystemIntelligence } from "@/lib/ai/intelligence";
import { jsonErr, jsonOk } from "@/lib/http/respond";
import { readJson, requireRoleOr403, scopeOr401 } from "@/lib/http/routeGuard";
import { withApiAiEntrypoint } from "@/lib/http/withApiAiEntrypoint";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/** POST { question: string } — deterministic answers over shared intelligence (superadmin). */
export async function POST(req: NextRequest) {
  return withApiAiEntrypoint(req, "POST", async () => {
    const gate = await scopeOr401(req);
    if (gate.ok === false) return gate.res;
    const deny = requireRoleOr403(gate.ctx, ["superadmin"]);
    if (deny) return deny;
    const ctx = gate.ctx;

    const body = await readJson(req);
    const o = body && typeof body === "object" && !Array.isArray(body) ? (body as Record<string, unknown>) : null;
    const question = typeof o?.question === "string" ? o.question.trim() : "";
    if (!question) return jsonErr(ctx.rid, "Mangler question.", 422, "MISSING_QUESTION");

    try {
      const intel = await getSystemIntelligence({ limit: 1000, recentEventLimit: 80 });
      const answer = answerIntelligenceQuestion(question, intel);
      return jsonOk(
        ctx.rid,
        {
          ...answer,
          snapshotGeneratedAt: intel.generatedAt,
        },
        200,
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : "INTEL_QUERY_FAILED";
      return jsonErr(ctx.rid, msg, 500, "INTEL_QUERY_FAILED");
    }
  });
}
