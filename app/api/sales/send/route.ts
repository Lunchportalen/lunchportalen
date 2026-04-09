export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";

import { auditLog } from "@/lib/core/audit";
import { checkAiRateLimit, AI_RATE_LIMIT_SCOPE } from "@/lib/ai/rateLimit";
import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";
import { withApiAiEntrypoint } from "@/lib/http/withApiAiEntrypoint";
import { denyResponse, readJson, requireRoleOr403, scopeOr401 } from "@/lib/http/routeGuard";
import { runAutoSend } from "@/lib/sales/autoSend";
import type { SalesChannel, SalesOutreachQueueItem, SalesQueueStatus } from "@/lib/sales/outreachQueueTypes";
import { getSalesSendCountToday } from "@/lib/sales/rateLimit";

const SEND_RL = { windowSeconds: 3600, max: 30 };

function parseQueueItem(raw: unknown): SalesOutreachQueueItem | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  const id = typeof r.id === "string" && r.id.trim() ? r.id.trim() : "";
  const dealId = typeof r.dealId === "string" && r.dealId.trim() ? r.dealId.trim() : "";
  const company = typeof r.company === "string" ? r.company : "";
  const message = typeof r.message === "string" ? r.message : "";
  const channel: SalesChannel = r.channel === "linkedin" ? "linkedin" : "email";
  const email = r.email === null || r.email === undefined ? null : typeof r.email === "string" ? r.email.trim() : null;
  const status = parseStatus(r.status);
  const approvedAt = typeof r.approvedAt === "number" && Number.isFinite(r.approvedAt) ? r.approvedAt : null;
  const sentAt = typeof r.sentAt === "number" && Number.isFinite(r.sentAt) ? r.sentAt : null;
  const createdAt = typeof r.createdAt === "number" && Number.isFinite(r.createdAt) ? r.createdAt : Date.now();
  if (!id || !dealId) return null;
  return {
    id,
    dealId,
    company,
    message,
    channel,
    email,
    status,
    approvedAt,
    sentAt,
    createdAt,
  };
}

function parseStatus(v: unknown): SalesQueueStatus {
  const s = typeof v === "string" ? v : "";
  if (
    s === "draft" ||
    s === "approved" ||
    s === "sent" ||
    s === "failed" ||
    s === "ready_manual"
  ) {
    return s;
  }
  return "draft";
}

/** POST: kjør kontrollert utsendelse (kill switch + eksplisitt flagg + rate limits). */
export async function POST(req: NextRequest): Promise<Response> {
  return withApiAiEntrypoint(req, "POST", async () => {
  const gate = await scopeOr401(req);
  if (gate.ok === false) return denyResponse(gate);
  const deny = requireRoleOr403(gate.ctx, ["superadmin"]);
  if (deny) return deny;

  const rid = gate.ctx.rid || makeRid("sales_send");
  const identity = gate.ctx.scope?.email ?? gate.ctx.scope?.sub ?? gate.ctx.scope?.userId ?? "unknown";
  const rl = checkAiRateLimit(String(identity), `${AI_RATE_LIMIT_SCOPE}:sales-send`, SEND_RL);
  if (!rl.allowed) {
    const extraHeaders: HeadersInit | undefined =
      rl.retryAfterSeconds != null ? { "Retry-After": String(rl.retryAfterSeconds) } : undefined;
    return jsonErr(rid, "For mange forsøk. Prøv igjen senere.", 429, "RATE_LIMIT", undefined, extraHeaders);
  }

  const body = await readJson(req);
  const o = body && typeof body === "object" && !Array.isArray(body) ? (body as Record<string, unknown>) : {};
  const explicitRun = o.explicitAutoSendApproved === true;
  const rawQueue = o.queue;
  if (!Array.isArray(rawQueue)) {
    return jsonErr(rid, "queue må være en liste.", 422, "VALIDATION_ERROR");
  }

  const queue: SalesOutreachQueueItem[] = [];
  for (const row of rawQueue) {
    const p = parseQueueItem(row);
    if (p) queue.push(p);
  }

  const actorEmail = gate.ctx.scope?.email ?? null;

  try {
    const idem =
      (typeof o.idempotencyKey === "string" && o.idempotencyKey.trim()) ||
      (req.headers.get("x-idempotency-key") ?? "").trim() ||
      rid;

    const result = await runAutoSend(queue, {
      explicitRunApproved: explicitRun,
      actorEmail,
      idempotencyKey: idem.slice(0, 120),
    });

    await auditLog({
      action: "sales_send_run",
      entity: "sales",
      metadata: {
        rid,
        blockedReason: result.blockedReason ?? null,
        count: result.results.length,
        sendsTodayAfter: getSalesSendCountToday(),
      },
    });

    return jsonOk(
      rid,
      {
        results: result.results,
        blockedReason: result.blockedReason ?? null,
        killSwitch: process.env.SALES_AUTOSEND_ENABLED === "true",
        sendsToday: getSalesSendCountToday(),
      },
      200,
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[SALES_SEND_API]", { rid, msg });
    return jsonErr(rid, "Utsendelse feilet.", 500, "SALES_SEND_FAILED");
  }
  });
}
