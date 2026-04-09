export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";

import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";
import { runInstrumentedApi } from "@/lib/http/withObservability";
import { denyResponse, requireRoleOr403, scopeOr401 } from "@/lib/http/routeGuard";
import { runAutonomy } from "@/lib/autonomy/run";
import type { AutonomyGrowthInput, MappedActionType } from "@/lib/autonomy/types";
import { opsLog } from "@/lib/ops/log";
import {
  AI_RATE_LIMIT_SCOPE,
  AUTONOMY_RUN_RL,
  checkAiRateLimit,
  rateLimitOverload,
} from "@/lib/security/rateLimit";
import { parseValidatedJson } from "@/lib/validation/withValidation";
import { autonomyRunBodySchema } from "@/lib/validation/schemas";

function getClientIp(req: Request) {
  const xf = req.headers.get("x-forwarded-for");
  if (xf) return xf.split(",")[0]?.trim() || "unknown";
  return req.headers.get("x-real-ip") || "unknown";
}

function parseApproved(raw: unknown): MappedActionType[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const allowed: MappedActionType[] = [];
  const set: Set<MappedActionType> = new Set([
    "adjust_sequence",
    "update_copy",
    "retry_jobs",
    "observe",
  ]);
  for (const x of raw) {
    if (typeof x === "string" && set.has(x as MappedActionType)) {
      allowed.push(x as MappedActionType);
    }
  }
  return allowed.length ? allowed : undefined;
}

function parseGrowth(raw: unknown): AutonomyGrowthInput | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const o = raw as Record<string, unknown>;
  const pageId = typeof o.pageId === "string" ? o.pageId.trim() : "";
  const companyId = typeof o.companyId === "string" ? o.companyId.trim() : "";
  if (!pageId || !companyId) return undefined;
  const userId = typeof o.userId === "string" ? o.userId.trim() : undefined;
  const locale = typeof o.locale === "string" ? o.locale.trim() : undefined;
  let postMetrics: AutonomyGrowthInput["postMetrics"];
  const pm = o.postMetrics;
  if (pm && typeof pm === "object" && !Array.isArray(pm)) {
    const p = pm as Record<string, unknown>;
    const clicks = Number(p.clicks);
    const orders = Number(p.orders);
    const revenue = Number(p.revenue);
    if (Number.isFinite(clicks) && Number.isFinite(orders) && Number.isFinite(revenue)) {
      postMetrics = { clicks, orders, revenue };
    }
  }
  return { pageId, companyId, userId, locale, postMetrics };
}

/**
 * Kjør autonomi-løkke (strategi + policy + trygg utførelse). Krever superadmin.
 */
export async function POST(req: NextRequest): Promise<Response> {
  const gate = await scopeOr401(req);
  if (gate.ok === false) return denyResponse(gate);
  const deny = requireRoleOr403(gate.ctx, ["superadmin"]);
  if (deny) return deny;

  const rid = gate.ctx.rid || makeRid("autonomy_run");

  const identity = gate.ctx.scope?.userId ?? gate.ctx.scope?.email ?? "unknown";
  const rl = checkAiRateLimit(String(identity), `${AI_RATE_LIMIT_SCOPE}:autonomy_run`, AUTONOMY_RUN_RL);
  if (!rl.allowed) {
    return jsonErr(
      rid,
      "For mange autonomi-kjøringer. Prøv igjen senere.",
      429,
      "RATE_LIMIT",
      undefined,
      rl.retryAfterSeconds != null ? { "Retry-After": String(rl.retryAfterSeconds) } : undefined,
    );
  }
  if (!rateLimitOverload(getClientIp(req), 50)) {
    return jsonErr(rid, "Systemet er under høy last. Prøv igjen om litt.", 503, "OVERLOAD");
  }

  const actorUserId = gate.ctx.scope.userId;

  return runInstrumentedApi(req, { rid, route: "/api/autonomy/run" }, async () => {
    const parsed = await parseValidatedJson(autonomyRunBodySchema, req, rid);
    if (parsed.ok === false) return parsed.response;

    const body = parsed.data;
    let windowDays = 30;
    const wd = Number(body.windowDays);
    if (Number.isFinite(wd)) windowDays = wd;
    const forceDryRun = body.forceDryRun === true;
    const approved = parseApproved(body.approvedActionTypes);
    const growth = parseGrowth(body.growth);

    try {
      const out = await runAutonomy({
        windowDays,
        forceDryRun,
        approvedActionTypes: approved,
        growth,
        actorUserId,
      });
      if (out.ok === false) {
        opsLog("autonomy_run_failed", { rid, reason: out.reason });
        return jsonErr(rid, "Autonomi utilgjengelig.", 503, "AUTONOMY_UNAVAILABLE");
      }
      return jsonOk(
        rid,
        {
          rid: out.rid,
          effectiveMode: out.effectiveMode,
          configSource: out.configSource,
          roadmap: out.roadmap,
          mapped: out.mapped,
          results: out.results,
          signals: out.signals,
          verification: out.verification,
        },
        200
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      opsLog("autonomy_run_exception", { rid, message: msg });
      return jsonErr(rid, msg, 500, "AUTONOMY_RUN_FAILED");
    }
  });
}
