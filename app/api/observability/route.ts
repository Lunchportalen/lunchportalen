export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";

import { layeredGet, layeredSet } from "@/lib/cache/layeredCache";
import { validateSystemRuntimeEnv } from "@/lib/env/system";
import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";
import { denyResponse, requireRoleOr403, scopeOr401 } from "@/lib/http/routeGuard";
import { buildGraphMetricsPayload } from "@/lib/observability/graphMetrics";
import { getHealthSnapshot, getMetrics } from "@/lib/observability/store";
import { hasSupabaseAdminConfig, supabaseAdmin } from "@/lib/supabase/admin";

function versionFromEnv() {
  return (
    process.env.APP_VERSION ||
    process.env.NEXT_PUBLIC_APP_VERSION ||
    process.env.VERCEL_GIT_COMMIT_SHA ||
    "unknown"
  );
}

/**
 * GET: aggregert operasjonssynlighet (ingen hemmeligheter) — kun superadmin.
 */
export async function GET(req: NextRequest): Promise<Response> {
  const gate = await scopeOr401(req);
  if (gate.ok === false) return denyResponse(gate);
  const deny = requireRoleOr403(gate.ctx, ["superadmin"]);
  if (deny) return deny;

  const rid = gate.ctx.rid || makeRid("observability");
  const url = new URL(req.url);
  const wantGraph = url.searchParams.get("graph") === "1";
  const noCache = url.searchParams.get("noCache") === "1";
  const perf = process.env.DEBUG_API_PERF === "1";
  const cacheKey = `observability:${wantGraph ? "graph" : "base"}`;

  if (perf) console.time(`observability:${rid}`);
  if (!noCache) {
    const hit = await layeredGet<Record<string, unknown>>(cacheKey);
    if (hit) {
      if (perf) console.timeEnd(`observability:${rid}`);
      return jsonOk(rid, { ...hit, _cached: true }, 200);
    }
  }

  const envReport = validateSystemRuntimeEnv();
  let dbPing = false;
  try {
    if (hasSupabaseAdminConfig()) {
      const { error } = await supabaseAdmin().from("profiles").select("id").limit(1);
      dbPing = !error;
    }
  } catch {
    dbPing = false;
  }

  const processMetrics = {
    metrics: getMetrics(),
    health: getHealthSnapshot(),
  };

  /** Last N failed cron rows (DB) — pilot minimum for cron failure visibility. */
  let cronRecentFailures: Array<{ job: string; status: string; detail: string | null; ran_at: string }> = [];
  try {
    if (hasSupabaseAdminConfig()) {
      const r = await supabaseAdmin()
        .from("cron_runs")
        .select("job,status,detail,ran_at")
        .eq("status", "error")
        .order("ran_at", { ascending: false })
        .limit(20);
      if (!r.error && Array.isArray(r.data)) {
        cronRecentFailures = r.data.map((row: { job?: string; status?: string; detail?: string | null; ran_at?: string }) => ({
          job: String(row.job ?? ""),
          status: String(row.status ?? ""),
          detail: row.detail ?? null,
          ran_at: String(row.ran_at ?? ""),
        }));
      }
    }
  } catch {
    cronRecentFailures = [];
  }

  const base = {
    ts: new Date().toISOString(),
    version: versionFromEnv(),
    uptimeSeconds: Math.floor(process.uptime()),
    node: process.version,
    env: { ok: envReport.ok, report: envReport },
    database: { reachable: dbPing },
    processMetrics,
    cronRecentFailures,
  };

  if (!wantGraph) {
    await layeredSet(cacheKey, base, 5000);
    if (perf) console.timeEnd(`observability:${rid}`);
    return jsonOk(rid, base, 200);
  }

  let graphBlock: Record<string, unknown> = {};
  try {
    const g = await buildGraphMetricsPayload({ windowHours: 6, activityLimit: 3000 });
    graphBlock = {
      api: g.api,
      db: g.db,
      revenue: g.revenue,
      graphHealth: g.health,
      graphMeta: { windowHours: g.windowHours, generatedAt: g.generatedAt },
    };
  } catch {
    graphBlock = {
      api: {},
      db: {},
      revenue: {},
      graphHealth: { aiLogOk: false, databaseReachable: dbPing },
      graphMeta: { windowHours: 6, generatedAt: new Date().toISOString(), error: true },
    };
  }

  const full = { ...base, ...graphBlock };
  await layeredSet(cacheKey, full, 5000);
  if (perf) console.timeEnd(`observability:${rid}`);
  return jsonOk(rid, full, 200);
}
