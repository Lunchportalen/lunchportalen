export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";

import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";
import { denyResponse, readJson, scopeOr401 } from "@/lib/http/routeGuard";
import { scheduleAuditEvent } from "@/lib/security/audit";

/**
 * POST: registrer slettingsønske — fail-closed: ingen automatisk hard-delete i RC.
 * Følger opp manuelt / via etablert prosess (reversibelt inntil behandling).
 */
export async function POST(req: NextRequest): Promise<Response> {
  const gate = await scopeOr401(req);
  if (gate.ok === false) return denyResponse(gate);

  const rid = gate.ctx.rid || makeRid("gdpr_delete_request");
  const uid = gate.ctx.scope.userId;
  if (!uid) {
    return jsonErr(rid, "Mangler bruker-ID.", 401, "UNAUTHORIZED");
  }

  const body = await readJson(req);
  const o = body && typeof body === "object" && !Array.isArray(body) ? (body as Record<string, unknown>) : {};
  const confirm = o.confirm === true;

  if (!confirm) {
    return jsonErr(rid, "Bekreft med { confirm: true } for å registrere forespørsel.", 422, "CONFIRMATION_REQUIRED");
  }

  scheduleAuditEvent({
    companyId: gate.ctx.scope.companyId ?? null,
    userId: uid,
    action: "gdpr_delete_requested",
    resource: "user",
    metadata: { rid, surface: "api/user/gdpr/delete" },
  });

  return jsonOk(
    rid,
    {
      status: "accepted",
      message:
        "Slettingsforespørsel er registrert. Full sletting krever manuell verifisering i henhold til intern prosedyre (RC).",
      subjectUserId: uid,
    },
    202,
  );
}
