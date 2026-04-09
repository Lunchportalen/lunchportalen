export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";

import { layeredGet, layeredSet } from "@/lib/cache/layeredCache";
import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";
import { denyResponse, requireRoleOr403, scopeOr401 } from "@/lib/http/routeGuard";
import { opsLog } from "@/lib/ops/log";
import { runStrategyEngine } from "@/lib/strategy/run";

function clampWindowDays(v: unknown): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return 30;
  return Math.max(7, Math.min(90, Math.floor(n)));
}

/**
 * Kjør strategianalyse (data fra ordre, pipeline, logger). Krever superadmin — ingen auto-implementering.
 */
export async function POST(req: NextRequest): Promise<Response> {
  const gate = await scopeOr401(req);
  if (gate.ok === false) return denyResponse(gate);
  const deny = requireRoleOr403(gate.ctx, ["superadmin"]);
  if (deny) return deny;

  const rid = gate.ctx.rid || makeRid("strategy_run");

  let windowDays = 30;
  try {
    const body = (await req.json()) as { windowDays?: unknown };
    windowDays = clampWindowDays(body?.windowDays);
  } catch {
    windowDays = 30;
  }

  const perf = process.env.DEBUG_API_PERF === "1";
  const cacheKey = `strategy_run:${windowDays}`;

  try {
    if (perf) console.time(`strategy_run:${rid}`);
    const cached = await layeredGet<{
      funnel: unknown;
      issues: unknown;
      roadmap: unknown;
      meta: Record<string, unknown>;
    }>(cacheKey);
    if (cached) {
      return jsonOk(rid, { ...cached, meta: { ...cached.meta, cached: true } }, 200);
    }

    const out = await runStrategyEngine({ windowDays });
    if (out.ok === false) {
      opsLog("strategy_run_failed", { rid, reason: out.reason });
      return jsonErr(rid, "Strategimotor utilgjengelig.", 503, "STRATEGY_UNAVAILABLE");
    }
    const payload = {
      funnel: out.data.funnel,
      issues: out.data.issues,
      roadmap: out.data.roadmap,
      meta: {
        rid: out.data.rid,
        dataExplain: out.data.dataExplain,
        windowDays,
        totalRevenue: out.data.totalRevenue,
      },
    };
    await layeredSet(cacheKey, payload, 45_000);
    return jsonOk(rid, payload, 200);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    opsLog("strategy_run_exception", { rid, message: msg });
    return jsonErr(rid, msg, 500, "STRATEGY_RUN_FAILED");
  } finally {
    if (perf) console.timeEnd(`strategy_run:${rid}`);
  }
}
