export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";

import { insertAutonomyLog } from "@/lib/ai/autonomy/autonomyLog";
import { trackAutonomyOutcome } from "@/lib/ai/autonomy/autonomyAttribution";
import type { AutonomyActionKind } from "@/lib/ai/autonomy/types";
import { jsonOk, jsonErr, makeRid } from "@/lib/http/respond";
import { withApiAiEntrypoint } from "@/lib/http/withApiAiEntrypoint";
import { denyResponse, readJson, requireRoleOr403, scopeOr401 } from "@/lib/http/routeGuard";

const KINDS: AutonomyActionKind[] = ["seo_fix", "content_improve", "experiment", "publish", "bug_fix"];

function isKind(v: unknown): v is AutonomyActionKind {
  return typeof v === "string" && (KINDS as string[]).includes(v);
}

export async function POST(req: NextRequest): Promise<Response> {
  return withApiAiEntrypoint(req, "POST", async () => {
  const gate = await scopeOr401(req);
  if (gate.ok === false) return denyResponse(gate);
  const ctx = gate.ctx;
  const deny = requireRoleOr403(ctx, ["superadmin"]);
  if (deny) return deny;

  const rid = ctx.rid || makeRid("autonomy_fb");
  const body = await readJson(req);
  const o = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const actionId = typeof o.actionId === "string" ? o.actionId.trim() : "";
  const intent = o.intent === "ignore" ? "ignore" : o.intent === "execute" ? "execute" : null;

  if (!actionId || !intent) {
    return jsonErr(rid, "Ugyldig forespørsel (actionId / intent).", 422, "VALIDATION_ERROR");
  }
  if (!isKind(o.kind)) {
    return jsonErr(rid, "Ugyldig kind.", 422, "VALIDATION_ERROR");
  }

  const actor = ctx.scope.userId;
  const companyId = ctx.scope.companyId;
  const fbRid = makeRid("autonomy_user_fb");

  const logRes = await insertAutonomyLog({
    rid: fbRid,
    entry_type: "autonomy_user_feedback",
    actor_user_id: actor,
    company_id: companyId,
    payload: { actionId, kind: o.kind, intent, source: "cms_panel" },
  });
  if (!logRes.ok) {
    return jsonErr(rid, logRes.error ?? "Kunne ikke logge.", 500, "AUTONOMY_LOG_FAILED");
  }

  const kind = o.kind;
  const out =
    intent === "ignore"
      ? await trackAutonomyOutcome(
          fbRid,
          { actionId, kind, result: "dismissed", metadata: { source: "cms_panel" } },
          { actor_user_id: actor, company_id: companyId },
        )
      : await trackAutonomyOutcome(
          fbRid,
          {
            actionId,
            kind,
            result: "manual_followup",
            impactHint: "user_ack_execute_no_auto_mutation",
            metadata: { source: "cms_panel" },
          },
          { actor_user_id: actor, company_id: companyId },
        );

  if (!out.ok) {
    return jsonErr(rid, out.error ?? "Kunne ikke lagre outcome.", 500, "AUTONOMY_OUTCOME_FAILED");
  }

  return jsonOk(rid, { logged: true, intent, actionId, kind }, 200);
  });
}
