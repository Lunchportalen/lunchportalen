export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";

import { logObjectionReplyLogged } from "@/lib/sales/objectionAudit";
import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";
import { denyResponse, requireRoleOr403, scopeOr401 } from "@/lib/http/routeGuard";

/**
 * Logger at selger har bekreftet tekst (ingen auto-utsendelse herfra).
 * Læring: success kan senere kobles til deal-utfall.
 */
export async function POST(req: NextRequest): Promise<Response> {
  const gate = await scopeOr401(req);
  if (gate.ok === false) return denyResponse(gate);
  const deny = requireRoleOr403(gate.ctx, ["superadmin"]);
  if (deny) return deny;

  const rid = gate.ctx.rid || makeRid("objection_send");

  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return jsonErr(rid, "Ugyldig JSON.", 400, "BAD_JSON");
  }

  const leadId = typeof body.leadId === "string" ? body.leadId.trim() : "";
  const replyText = typeof body.replyText === "string" ? body.replyText.trim() : "";

  if (!leadId) {
    return jsonErr(rid, "leadId er påkrevd.", 422, "LEAD_ID_REQUIRED");
  }
  if (!replyText) {
    return jsonErr(rid, "replyText er påkrevd.", 422, "REPLY_REQUIRED");
  }

  await logObjectionReplyLogged(rid, {
    leadId,
    replyLength: replyText.length,
    success: null,
  });

  return jsonOk(rid, { logged: true }, 200);
}
