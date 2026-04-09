export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";

import { insertAiCeoLog } from "@/lib/ai/ceo/ceoLog";
import { trackOutcome } from "@/lib/ai/ceo/attribution";
import type { CeoDecisionType } from "@/lib/ai/ceo/types";
import { jsonOk, jsonErr, makeRid } from "@/lib/http/respond";
import { withApiAiEntrypoint } from "@/lib/http/withApiAiEntrypoint";
import { denyResponse, readJson, requireRoleOr403, scopeOr401 } from "@/lib/http/routeGuard";

const DECISION_TYPES: CeoDecisionType[] = ["seo_fix", "content_improve", "experiment", "publish"];

function isDecisionType(v: unknown): v is CeoDecisionType {
  return typeof v === "string" && (DECISION_TYPES as string[]).includes(v);
}

/** POST: log user execute / ignore on a recommendation (no CMS mutations). */
export async function POST(req: NextRequest): Promise<Response> {
  return withApiAiEntrypoint(req, "POST", async () => {
  const gate = await scopeOr401(req);
  if (gate.ok === false) return denyResponse(gate);
  const ctx = gate.ctx;
  const deny = requireRoleOr403(ctx, ["superadmin"]);
  if (deny) return deny;

  const rid = ctx.rid || makeRid("ceo_fb");
  const body = await readJson(req);
  const o = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const actionId = typeof o.actionId === "string" ? o.actionId.trim() : "";
  const intent = o.intent === "ignore" ? "ignore" : o.intent === "execute" ? "execute" : null;

  if (!actionId || !intent) {
    return jsonErr(rid, "Ugyldig forespørsel (actionId / intent).", 422, "VALIDATION_ERROR");
  }
  if (!isDecisionType(o.decisionType)) {
    return jsonErr(rid, "Ugyldig decisionType.", 422, "VALIDATION_ERROR");
  }

  const actor = ctx.scope.userId;
  const companyId = ctx.scope.companyId;

  const feedbackRid = makeRid("ceo_user_fb");
  const logRes = await insertAiCeoLog({
    rid: feedbackRid,
    entry_type: "ceo_user_feedback",
    actor_user_id: actor,
    company_id: companyId,
    payload: {
      actionId,
      decisionType: o.decisionType,
      intent,
      source: "cms_panel",
    },
  });
  if (!logRes.ok) {
    return jsonErr(rid, logRes.error ?? "Kunne ikke logge tilbakemelding.", 500, "CEO_LOG_FAILED");
  }

  const dt = o.decisionType;
  const outRes =
    intent === "ignore"
      ? await trackOutcome(
          feedbackRid,
          { actionId, result: "dismissed", decisionType: dt, metadata: { source: "cms_panel" } },
          { actor_user_id: actor, company_id: companyId },
        )
      : await trackOutcome(
          feedbackRid,
          {
            actionId,
            result: "manual_followup",
            decisionType: dt,
            impactHint: "user_ack_execute_no_auto_mutation",
            metadata: { source: "cms_panel" },
          },
          { actor_user_id: actor, company_id: companyId },
        );

  if (!outRes.ok) {
    return jsonErr(rid, outRes.error ?? "Kunne ikke lagre outcome.", 500, "CEO_OUTCOME_FAILED");
  }

  return jsonOk(rid, { logged: true, intent, actionId, decisionType: o.decisionType }, 200);
  });
}
