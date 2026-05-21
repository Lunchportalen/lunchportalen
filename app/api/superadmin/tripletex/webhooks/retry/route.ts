export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";
import { jsonErr, jsonOk } from "@/lib/http/respond";
import { denyResponse, readJson, requireRoleOr403, scopeOr401 } from "@/lib/http/routeGuard";
import { reprocessWebhookEventById } from "@/lib/integrations/tripletex/reprocessWebhookEvent";

function safeStr(v: unknown): string {
  return String(v ?? "").trim();
}

export async function POST(req: NextRequest): Promise<Response> {
  const s = await scopeOr401(req);
  if (s.ok === false) return denyResponse(s);

  const ctx = s.ctx;
  const deny = requireRoleOr403(ctx, "api.superadmin.tripletex.webhooks.retry.POST", ["superadmin"]);
  if (deny) return deny;

  const body = await readJson(req);
  const id = safeStr(body?.id);
  if (!id) return jsonErr(ctx.rid, "Mangler webhook-id.", 400, "BAD_REQUEST");

  const result = await reprocessWebhookEventById(id);
  if (!result.ok) {
    return jsonErr(ctx.rid, "Kunne ikke reprosessere webhook.", 500, "WEBHOOK_RETRY_FAILED");
  }

  return jsonOk(ctx.rid, { id, reprocessed: true }, 200);
}
