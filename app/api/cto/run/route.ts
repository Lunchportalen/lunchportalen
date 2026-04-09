export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";

import { buildAiActivityLogRow } from "@/lib/ai/logging/aiActivityLogRow";
import { analyzeSystem } from "@/lib/cto/analyze";
import { collectCtoData } from "@/lib/cto/data";
import { buildBusinessModel } from "@/lib/cto/model";
import { generateOpportunities } from "@/lib/cto/opportunities";
import { buildStrategy } from "@/lib/cto/output";
import { prioritize } from "@/lib/cto/prioritize";
import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";
import { withApiAiEntrypoint } from "@/lib/http/withApiAiEntrypoint";
import { denyResponse, requireRoleOr403, scopeOr401 } from "@/lib/http/routeGuard";
import { opsLog } from "@/lib/ops/log";
import { hasSupabaseAdminConfig, supabaseAdmin } from "@/lib/supabase/admin";

/**
 * POST: kjør CTO-pipeline (superadmin, service role for data).
 * Respons: { model, issues, roadmap, audit } i `data`.
 */
export async function POST(_req: NextRequest): Promise<Response> {
  return withApiAiEntrypoint(_req, "POST", async () => {
  const rid = makeRid("cto_run");

  try {
    const gate = await scopeOr401(_req);
    if (gate.ok === false) return denyResponse(gate);
    const deny = requireRoleOr403(gate.ctx, ["superadmin"]);
    if (deny) return deny;

    if (!hasSupabaseAdminConfig()) {
      return jsonErr(
        rid,
        "Supabase admin er ikke konfigurert.",
        503,
        "SERVICE_UNAVAILABLE",
        { message: "Kunne ikke kjøre CTO-analyse uten service role." }
      );
    }

    const admin = supabaseAdmin();
    const raw = await collectCtoData(admin);
    const model = buildBusinessModel(raw);
    const issues = analyzeSystem(model);
    const opportunities = generateOpportunities(issues);
    const prioritized = prioritize(opportunities);
    const roadmap = buildStrategy(prioritized);

    let auditOk = true;
    try {
      const logRow = buildAiActivityLogRow({
        action: "cto_decision",
        actor_user_id: gate.ctx.scope.userId,
        metadata: {
          rid,
          roadmap,
          model: {
            revenue: model.revenue,
            leads: model.leads,
            orders: model.orders,
            conversion: model.conversion,
          },
        },
      });
      const { error: insErr } = await admin.from("ai_activity_log").insert(logRow as Record<string, unknown>);
      if (insErr) {
        auditOk = false;
        opsLog("cto_run_log_failed", { rid, detail: insErr.message });
      }
    } catch (e) {
      auditOk = false;
      opsLog("cto_run_log_failed", { rid, detail: String(e) });
    }

    return jsonOk(
      rid,
      {
        model,
        issues,
        roadmap,
        audit: { written: auditOk },
      },
      200
    );
  } catch (e) {
    opsLog("cto_run_error", { rid, detail: String(e) });
    return jsonErr(rid, "CTO-kjøring feilet.", 500, "INTERNAL", {
      message: e instanceof Error ? e.message : "Ukjent feil",
    });
  }
  });
}
