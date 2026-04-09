export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";

import { addLead, getQueue } from "@/lib/sdr/queue";
import { denyResponse, readJson, requireRoleOr403, scopeOr401 } from "@/lib/http/routeGuard";
import { jsonErr, jsonOk } from "@/lib/http/respond";

/**
 * GET: queue snapshot (superadmin). In-memory only; not durable on serverless.
 */
export async function GET(req: NextRequest): Promise<Response> {
  const gate = await scopeOr401(req);
  if (gate.ok === false) return denyResponse(gate);
  const deny = requireRoleOr403(gate.ctx, "api.sdr.queue.GET", ["superadmin"]);
  if (deny) return deny;

  const q = getQueue();
  return jsonOk(
    gate.ctx.rid,
    {
      count: q.length,
      leads: q.map((l) => ({
        company: String(l.company ?? "").slice(0, 200),
        pain: String(l.pain ?? "").slice(0, 300),
        idempotencyKey: l.idempotencyKey ?? null,
      })),
    },
    200,
  );
}

/**
 * POST: enqueue lead (superadmin). Does not send mail.
 */
export async function POST(req: NextRequest): Promise<Response> {
  const gate = await scopeOr401(req);
  if (gate.ok === false) return denyResponse(gate);
  const deny = requireRoleOr403(gate.ctx, "api.sdr.queue.POST", ["superadmin"]);
  if (deny) return deny;

  try {
    const body = await readJson(req);
    const o = body && typeof body === "object" && !Array.isArray(body) ? (body as Record<string, unknown>) : {};
    const company = typeof o.company === "string" ? o.company : "";
    const pain = typeof o.pain === "string" ? o.pain : "";
    const idempotencyKey = typeof o.idempotencyKey === "string" ? o.idempotencyKey : undefined;

    if (!company.trim() || !pain.trim()) {
      return jsonErr(gate.ctx.rid, "company og pain er påkrevd.", 422, "VALIDATION_ERROR");
    }

    addLead({ company, pain, idempotencyKey });
    return jsonOk(gate.ctx.rid, { queued: getQueue().length }, 200);
  } catch (e) {
    return jsonErr(gate.ctx.rid, "Kunne ikke legge lead i kø.", 500, "SDR_QUEUE_FAILED", e);
  }
}
