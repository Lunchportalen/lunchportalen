import "server-only";

import { makeRid } from "@/lib/http/respond";
import type { GrowthMetrics } from "@/lib/experiment/measure";
import { buildGraphMetricsPayload } from "@/lib/observability/graphMetrics";
import { aggregateCurrentMetrics } from "@/lib/monitoring/metrics";
import { opsLog } from "@/lib/ops/log";
import { hasSupabaseAdminConfig, supabaseAdmin } from "@/lib/supabase/admin";
import type { RoadmapItem } from "@/lib/strategy/types";
import { runStrategyEngine } from "@/lib/strategy/run";

import { logAutonomyRun } from "./audit";
import { getAutonomyEnvConfig } from "./config";
import { executeAutonomyActions, type AutonomyExecuteGrowthContext } from "./execute";
import { loadAutonomyOverride, mergeAutonomyConfig } from "./override";
import { mapToActions } from "./mapActions";
import type { AutonomyRunInput, ExecutionResult, MappedActionType, MappedAutonomyAction } from "./types";

export type AutonomyRunResult =
  | {
      ok: true;
      rid: string;
      effectiveMode: "dry-run" | "semi" | "auto";
      configSource: string;
      roadmap: RoadmapItem[];
      mapped: MappedAutonomyAction[];
      results: ExecutionResult[];
      signals: {
        strategyRid: string;
        totalRevenue: number;
        metricsBefore: ReturnType<typeof aggregateCurrentMetrics>;
        metricsAfter: ReturnType<typeof aggregateCurrentMetrics>;
      };
      verification: { errorsDelta: number };
    }
  | { ok: false; reason: string };

function clampWindowDays(n: number): number {
  return Math.max(7, Math.min(90, Math.floor(n)));
}

/** Env fallback for growth copy (optional; request body overrides). */
function resolveGrowthFromEnv(): { pageId: string; companyId: string; userId: string } {
  return {
    pageId: String(process.env.AUTONOMY_GROWTH_PAGE_ID ?? "").trim(),
    companyId: String(
      process.env.AUTONOMY_GROWTH_COMPANY_ID ?? process.env.CMS_AI_DEFAULT_COMPANY_ID ?? ""
    ).trim(),
    userId: String(process.env.AUTONOMY_GROWTH_USER_ID ?? "").trim(),
  };
}

/**
 * Orkestrering: strategi + observability-signaler; utfører kun policy-godkjente, reversible operasjoner.
 */
export async function runAutonomy(input: AutonomyRunInput): Promise<AutonomyRunResult> {
  if (!hasSupabaseAdminConfig()) {
    return { ok: false, reason: "no_supabase_admin" };
  }

  const rid = makeRid("autonomy");
  const admin = supabaseAdmin();
  const windowDays = clampWindowDays(input.windowDays ?? 30);

  const envCfg = getAutonomyEnvConfig();
  const override = await loadAutonomyOverride(admin);
  const config = mergeAutonomyConfig(envCfg, override);

  let effectiveMode = config.mode;
  if (input.forceDryRun) effectiveMode = "dry-run";

  const strategy = await runStrategyEngine({ windowDays });
  if (strategy.ok === false) {
    return { ok: false, reason: strategy.reason };
  }

  const payloadBefore = await buildGraphMetricsPayload({ windowHours: 6, activityLimit: 3000 });
  const metricsBefore = aggregateCurrentMetrics(payloadBefore);

  const roadmap = strategy.data.roadmap;
  const mapped = mapToActions(roadmap).slice(0, config.limits.maxActionsPerRun);
  const approved = new Set<MappedActionType>(input.approvedActionTypes ?? []);

  const dryRun = effectiveMode === "dry-run";
  const disabled = !config.enabled;

  const envGrowth = resolveGrowthFromEnv();
  const pageId = (input.growth?.pageId ?? envGrowth.pageId ?? "").trim();
  const companyId = (input.growth?.companyId ?? envGrowth.companyId ?? "").trim();
  const userId = (
    input.growth?.userId ??
    envGrowth.userId ??
    input.actorUserId ??
    ""
  ).trim();
  const locale = (input.growth?.locale ?? "nb").trim() || "nb";

  const growthReady = pageId.length > 0 && companyId.length > 0 && userId.length > 0;

  const metricsBeforeGrowth: GrowthMetrics = {
    revenue: strategy.data.totalRevenue,
    conversion: strategy.data.funnel.clickToLead,
    errors: metricsBefore.errors,
  };

  let growthCtx: AutonomyExecuteGrowthContext | null = null;
  if (growthReady && !dryRun && !disabled) {
    growthCtx = {
      pageId,
      locale,
      aiCtx: { companyId, userId },
      metricsBefore: metricsBeforeGrowth,
      createdBy: input.actorUserId ?? null,
      postMetrics: input.growth?.postMetrics,
    };
  }

  let results: ExecutionResult[];

  if (disabled) {
    results = mapped.map((a) => ({
      ...a,
      status: "blocked" as const,
      detail: "kill_switch",
    }));
    opsLog("autonomy_kill_switch", { rid, strategyRid: strategy.data.rid });
  } else {
    results = await executeAutonomyActions(mapped, {
      rid,
      config,
      approved,
      dryRun,
      admin,
      growth: growthCtx,
    });
  }

  const payloadAfter = await buildGraphMetricsPayload({ windowHours: 6, activityLimit: 3000 });
  const metricsAfter = aggregateCurrentMetrics(payloadAfter);

  await logAutonomyRun(admin, {
    rid,
    mode: effectiveMode,
    enabled: config.enabled,
    actions: mapped,
    results,
    signals: {
      strategyRid: strategy.data.rid,
      totalRevenue: strategy.data.totalRevenue,
      metricsBefore,
      metricsAfter,
    },
    verification: { errorsDelta: metricsBefore.errors - metricsAfter.errors },
  });

  return {
    ok: true,
    rid,
    effectiveMode,
    configSource: config.source,
    roadmap,
    mapped,
    results,
    signals: {
      strategyRid: strategy.data.rid,
      totalRevenue: strategy.data.totalRevenue,
      metricsBefore,
      metricsAfter,
    },
    verification: { errorsDelta: metricsBefore.errors - metricsAfter.errors },
  };
}
