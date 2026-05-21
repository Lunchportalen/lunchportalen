export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";
import { jsonErr, jsonOk } from "@/lib/http/respond";
import { denyResponse, readJson, requireRoleOr403, scopeOr401 } from "@/lib/http/routeGuard";
import { supabaseServer } from "@/lib/supabase/server";

function safeStr(v: unknown): string {
  return String(v ?? "").trim();
}

export async function POST(req: NextRequest): Promise<Response> {
  const s = await scopeOr401(req);
  if (s.ok === false) return denyResponse(s);

  const ctx = s.ctx;
  const deny = requireRoleOr403(ctx, "api.superadmin.tripletex.outbox.retry.POST", ["superadmin"]);
  if (deny) return deny;

  const body = await readJson(req);
  const eventId = safeStr(body?.event_id ?? body?.id);
  if (!eventId) return jsonErr(ctx.rid, "Mangler event_id.", 400, "BAD_REQUEST");

  const sb = await supabaseServer();
  const { data, error } = await sb.rpc("lp_outbox_retry_event", { p_event_id: eventId });

  if (error) {
    const msg = safeStr(error.message);
    if (msg.includes("PERMISSION_DENIED")) {
      return jsonErr(ctx.rid, "Ingen tilgang.", 403, "FORBIDDEN");
    }
    if (msg.includes("OUTBOX_EVENT_NOT_FOUND")) {
      return jsonErr(ctx.rid, "Hendelse finnes ikke.", 404, "NOT_FOUND");
    }
    if (msg.includes("OUTBOX_RETRY_STATUS_INVALID")) {
      return jsonErr(ctx.rid, "Kan ikke retry denne statusen.", 409, "INVALID_STATUS");
    }
    return jsonErr(ctx.rid, "Kunne ikke retry outbox.", 500, "OUTBOX_RETRY_FAILED");
  }

  return jsonOk(ctx.rid, data ?? { ok: true, event_id: eventId }, 200);
}
