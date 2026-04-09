import "server-only";

import { makeRid } from "@/lib/http/respond";
import { buildGraphMetricsPayload } from "@/lib/observability/graphMetrics";
import { aggregateCurrentMetrics } from "@/lib/monitoring/metrics";
import type { MonitoringAlert, MonitoringCurrent } from "@/lib/monitoring/types";
import { opsLog } from "@/lib/ops/log";
import { hasSupabaseAdminConfig, supabaseAdmin } from "@/lib/supabase/admin";

import { logSelfHealAudit } from "./audit";
import { classifyAlert } from "./classify";
import { getSelfHealConfig } from "./config";
import { isSelfHealCooldownActive } from "./cooldown";
import { simulate } from "./dryRun";
import { executeRemediation, type RemediationResult } from "./execute";
import { getRemediation, type RemediationActionType, type RemediationPlanItem } from "./playbook";
import { rollbackAction } from "./rollback";
import { verifyResolution } from "./verify";

export type SelfHealRunResult = {
  ok: true;
  rid: string;
  skipped?: boolean;
  reason?: string;
  dryRun?: boolean;
  simulated?: ReturnType<typeof simulate>;
  planned?: RemediationPlanItem[];
  executed?: RemediationResult[];
  verification?: ReturnType<typeof verifyResolution>;
  after?: MonitoringCurrent;
  rollback?: { action: RemediationActionType; result: Awaited<ReturnType<typeof rollbackAction>> }[];
};

export type SelfHealRunError = { ok: false; reason: string };

function dedupeActions(actions: RemediationPlanItem[]): RemediationPlanItem[] {
  const seen = new Set<RemediationActionType>();
  const out: RemediationPlanItem[] = [];
  for (const a of actions) {
    if (seen.has(a.type)) continue;
    seen.add(a.type);
    out.push(a);
  }
  return out;
}

/**
 * Policy-gated remediation: dry-run by default; execute only allow-listed server actions.
 */
export async function runSelfHealing(
  alerts: MonitoringAlert[],
  ctx: { monitoringRid: string; before: MonitoringCurrent }
): Promise<SelfHealRunResult | SelfHealRunError> {
  const rid = makeRid("selfheal");
  const config = getSelfHealConfig();

  if (!hasSupabaseAdminConfig()) {
    opsLog("self_heal_skip", { rid, reason: "no_supabase_admin" });
    return { ok: false, reason: "no_supabase_admin" };
  }

  const admin = supabaseAdmin();

  const auditConfig = {
    enabled: config.enabled,
    mode: config.mode,
    maxActionsPerRun: config.maxActionsPerRun,
    cooldownMinutes: config.cooldownMinutes,
  };

  if (!config.enabled) {
    opsLog("self_heal_kill_switch", { rid, monitoringRid: ctx.monitoringRid });
    await logSelfHealAudit(admin, {
      rid,
      monitoringRid: ctx.monitoringRid,
      config: auditConfig,
      alerts,
      planned: [],
      results: [],
      note: "kill_switch",
      hadExecution: false,
    });
    return { ok: true, rid, skipped: true, reason: "disabled" };
  }

  if (!alerts.length) {
    await logSelfHealAudit(admin, {
      rid,
      monitoringRid: ctx.monitoringRid,
      config: auditConfig,
      alerts,
      planned: [],
      results: [],
      note: "no_alerts",
      hadExecution: false,
    });
    return { ok: true, rid, skipped: true, reason: "no_alerts" };
  }

  const planned: RemediationPlanItem[] = [];
  for (const alert of alerts) {
    const issue = classifyAlert(alert);
    if (issue === "unknown") continue;
    planned.push(...getRemediation(issue));
  }

  const sliced = dedupeActions(planned).slice(0, config.maxActionsPerRun);

  if (!sliced.length) {
    await logSelfHealAudit(admin, {
      rid,
      monitoringRid: ctx.monitoringRid,
      config: auditConfig,
      alerts,
      planned: [],
      results: [],
      note: "no_remediation_actions",
      hadExecution: false,
    });
    return { ok: true, rid, skipped: true, reason: "no_remediation_actions" };
  }

  if (config.mode === "dry-run") {
    const simulated = simulate(sliced);
    await logSelfHealAudit(admin, {
      rid,
      monitoringRid: ctx.monitoringRid,
      config: auditConfig,
      alerts,
      planned: sliced,
      results: simulated,
      note: "dry_run",
      hadExecution: false,
    });
    opsLog("self_heal_dry_run", { rid, monitoringRid: ctx.monitoringRid, count: simulated.length });
    return { ok: true, rid, dryRun: true, simulated, planned: sliced };
  }

  const cooldown = await isSelfHealCooldownActive(admin, config.cooldownMinutes);
  if (cooldown) {
    opsLog("self_heal_cooldown_active", { rid, minutes: config.cooldownMinutes });
    await logSelfHealAudit(admin, {
      rid,
      monitoringRid: ctx.monitoringRid,
      config: auditConfig,
      alerts,
      planned: sliced,
      results: [],
      note: "cooldown",
      hadExecution: false,
      cooldownSkipped: true,
    });
    return { ok: true, rid, skipped: true, reason: "cooldown" };
  }

  const executed = await executeRemediation(sliced, { rid, config });

  const payloadAfter = await buildGraphMetricsPayload({ windowHours: 6, activityLimit: 3000 });
  const after = aggregateCurrentMetrics(payloadAfter);
  const verification = verifyResolution(ctx.before, after);

  const rollbackResults: { action: RemediationActionType; result: Awaited<ReturnType<typeof rollbackAction>> }[] =
    [];

  const hadLatencyAlert = alerts.some((a) => a.type === "latency");
  if (!verification.resolved && config.mode === "auto" && hadLatencyAlert) {
    const cacheOk = executed.find((e) => e.action === "rebuild_cache" && e.status === "executed");
    if (cacheOk) {
      const rb = await rollbackAction("rebuild_cache", { rid });
      rollbackResults.push({ action: "rebuild_cache", result: rb });
      opsLog("self_heal_auto_rollback", { rid, verification });
    }
  } else if (!verification.resolved && config.mode === "semi") {
    opsLog("self_heal_verify_not_resolved_semi", { rid, verification });
  }

  await logSelfHealAudit(admin, {
    rid,
    monitoringRid: ctx.monitoringRid,
    config: auditConfig,
    alerts,
    planned: sliced,
    results: executed,
    verification,
    rollback: rollbackResults.length ? rollbackResults : undefined,
    hadExecution: true,
  });

  return {
    ok: true,
    rid,
    planned: sliced,
    executed,
    verification,
    after,
    rollback: rollbackResults.length ? rollbackResults : undefined,
  };
}
