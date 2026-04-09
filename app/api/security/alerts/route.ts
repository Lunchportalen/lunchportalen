export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";

import { denyResponse, requireRoleOr403, scopeOr401 } from "@/lib/http/routeGuard";
import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";
import { parseSecurityAlertBody, sendSecurityAlert } from "@/lib/security/alerts";

/**
 * Async security alert fan-out (Slack / optional e-post). Superadmin only.
 * Does not await outbound delivery in a way that blocks the HTTP response beyond accept.
 */
export async function POST(req: NextRequest) {
  const rid = makeRid("sec");

  const gate = await scopeOr401(req);
  if (!gate.ok) return denyResponse(gate);

  const deny = requireRoleOr403(gate.ctx, ["superadmin"]);
  if (deny) return deny;

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return jsonErr(rid, "Ugyldig JSON.", 400, "BAD_REQUEST");
  }

  const alert = parseSecurityAlertBody(raw);
  if (!alert) {
    return jsonErr(rid, "Ugyldig varsel.", 400, "BAD_REQUEST");
  }

  void sendSecurityAlert(alert);

  return jsonOk(rid, { ok: true }, 200);
}
