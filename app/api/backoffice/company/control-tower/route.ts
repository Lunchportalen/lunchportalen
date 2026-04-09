import type { NextRequest } from "next/server";

import { applyDesignChanges } from "@/lib/ai/design/applyDesignChanges";
import { mergeDesignOptimizerPatches } from "@/lib/ai/design/designSettingsOptimizer";
import { runCompanyControlCycle, companyDecisionToSafeDesignPatch } from "@/lib/ai/company/automationEngine";
import { evaluateCompanyDecision } from "@/lib/ai/company/policyEngine";
import { buildCompanyMemoryPayload } from "@/lib/ai/company/memory";
import type { CompanyExecutionMode, CompanySnapshot } from "@/lib/ai/company/types";
import { loadSystemContext } from "@/lib/ai/context/systemContext";
import { parseDesignSettingsFromSettingsData } from "@/lib/cms/design/designContract";
import { loadGlobalSettingsDataForEditor } from "@/lib/cms/globalSettingsAdmin";
import { buildAiActivityLogRow } from "@/lib/ai/logging/aiActivityLogRow";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { scopeOr401, requireRoleOr403 } from "@/lib/http/routeGuard";
import { jsonOk, jsonErr, makeRid } from "@/lib/http/respond";
import { withApiAiEntrypoint } from "@/lib/http/withApiAiEntrypoint";
import {
  executeScaleActions,
  getEvents,
  getSystemIntelligence,
  logEvent,
  runControlledScaleEngine,
  scaleEngineToControlTowerMetadata,
} from "@/lib/ai/intelligence";
import { IntelligenceSchemaValidationError } from "@/lib/ai/schema/errors";
import { isAutoOptimizeEnabled, isScaleAutomationEnabled } from "@/lib/core/featureFlags";
import { MAX_POLICY_DECISION_LOG_PER_REQUEST } from "@/lib/core/limits";
import { opsLog } from "@/lib/ops/log";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return Boolean(v && typeof v === "object" && !Array.isArray(v));
}

function parseTargetCooldownLastAt(raw: unknown): Record<string, number> | null {
  if (!isPlainObject(raw)) return null;
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (typeof v === "number" && Number.isFinite(v)) out[k] = v;
  }
  return Object.keys(out).length > 0 ? out : null;
}

async function buildCompanySnapshot(rid: string, weakPointsCount: number): Promise<CompanySnapshot> {
  const ctx = await loadSystemContext(rid);
  const loaded = await loadGlobalSettingsDataForEditor();
  const spacing =
    loaded.ok === true ? parseDesignSettingsFromSettingsData(loaded.data).spacing.section : undefined;
  const pv = ctx.analytics.pageViews24h;
  const cta = ctx.analytics.ctaClicks24h;
  const healthStatus =
    ctx.health.status === "ok" ? "ok"
    : ctx.health.status === "degraded" ? "degraded"
    : "unknown";

  return {
    rid,
    collectedAt: ctx.collectedAt,
    revenue: {
      pageViews24h: pv,
      ctaClicks24h: cta,
      ctr: pv > 0 ? cta / pv : null,
    },
    design: {
      weakPointsCount,
      globalSpacingSection: spacing,
    },
    content: {
      draftPages: ctx.cms.draftPages,
      contentHealthHint: ctx.aiScores.contentHealthHint,
    },
    systemHealth: {
      status: healthStatus,
      errors24h: ctx.errors.recentCount24h,
      detail: ctx.health.detail,
    },
  };
}

export async function GET(req: NextRequest) {
  return withApiAiEntrypoint(req, "GET", async () => {
    const gate = await scopeOr401(req);
    if (gate.ok === false) return gate.res;
    const deny = requireRoleOr403(gate.ctx, ["superadmin"]);
    if (deny) return deny;
    const ctx = gate.ctx;
    const limitRaw = req.nextUrl.searchParams.get("limit");
    const limit = Math.min(50, Math.max(1, Number(limitRaw) || 20));
    const includeScaling = req.nextUrl.searchParams.get("scaling") === "1";

    try {
      const sb = supabaseAdmin();
      const { data, error } = await sb
        .from("ai_activity_log")
        .select("action,metadata,created_at,page_id")
        .contains("metadata", { tool: "company_control_tower" })
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error) {
        return jsonErr(ctx.rid, error.message, 500, "LOG_QUERY_FAILED");
      }

      let scaling: Awaited<ReturnType<typeof runControlledScaleEngine>> | null = null;
      if (includeScaling) {
        try {
          const [si, cooldownEvents] = await Promise.all([
            getSystemIntelligence({ limit: 800, recentEventLimit: 250 }),
            getEvents({ types: ["analytics"], limit: 400 }),
          ]);
          scaling = await runControlledScaleEngine({
            mode: "suggest",
            intelligence: si,
            cooldownEvents,
            source_rid: ctx.rid,
          });
        } catch {
          scaling = null;
        }
      }

      return jsonOk(ctx.rid, { entries: data ?? [], scaling }, 200);
    } catch (e) {
      return jsonErr(ctx.rid, e instanceof Error ? e.message : "Query failed", 500, "LOG_FAILED");
    }
  });
}

export async function POST(req: NextRequest) {
  return withApiAiEntrypoint(req, "POST", async () => {
    const gate = await scopeOr401(req);
    if (gate.ok === false) return gate.res;
    const deny = requireRoleOr403(gate.ctx, ["superadmin"]);
    if (deny) return deny;
    const ctx = gate.ctx;

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return jsonErr(ctx.rid, "Invalid JSON.", 400, "BAD_REQUEST");
    }
    const o = body && typeof body === "object" && !Array.isArray(body) ? (body as Record<string, unknown>) : null;
    if (!o) return jsonErr(ctx.rid, "Body must be an object.", 400, "BAD_REQUEST");

    const mode: CompanyExecutionMode =
      o.mode === "assisted" ? "assisted"
      : o.mode === "auto" ? "auto"
      : "manual";

    const weakPointsCount = typeof o.weakPointsCount === "number" && o.weakPointsCount >= 0 ? o.weakPointsCount : 0;

    const lastBatch =
      isPlainObject(o.lastBatch) &&
      typeof o.lastBatch.at === "number" &&
      Array.isArray(o.lastBatch.decisionIds)
        ? { at: o.lastBatch.at as number, decisionIds: (o.lastBatch.decisionIds as unknown[]).filter((x): x is string => typeof x === "string") }
        : null;

    const analyzeOnly =
      o.analyzeOnly === true ? true
      : o.analyzeOnly === false ? false
      : mode !== "auto";

    const executeDecisionIds = Array.isArray(o.executeDecisionIds)
      ? o.executeDecisionIds.filter((x): x is string => typeof x === "string")
      : [];

    const rejectDecisionIds = Array.isArray(o.rejectDecisionIds)
      ? o.rejectDecisionIds.filter((x): x is string => typeof x === "string")
      : [];

    const includePatternScale = o.includePatternScale === true;

    const scalingApplyIds = Array.isArray(o.scalingApplyIds)
      ? o.scalingApplyIds.filter((x): x is string => typeof x === "string")
      : [];
    const scalingIgnoreIds = Array.isArray(o.scalingIgnoreIds)
      ? o.scalingIgnoreIds.filter((x): x is string => typeof x === "string")
      : [];

    const targetCooldownLastAt = parseTargetCooldownLastAt(o.targetCooldownLastAt);
    const negativeImpactFlag = o.negativeImpactObserved === true;
    const forceOverride = o.forceOverride === true;

    const rid = ctx.rid ?? makeRid("co");
    const snapshot = await buildCompanySnapshot(rid, weakPointsCount);
    const cycle = runCompanyControlCycle({
      snapshot,
      mode,
      lastBatch,
      targetCooldownLastAt,
      negativeImpactObserved: negativeImpactFlag,
    });

    const sb = supabaseAdmin();

    for (const entry of cycle.policyDecisionLog.slice(0, MAX_POLICY_DECISION_LOG_PER_REQUEST)) {
      try {
        const res = await logEvent({
          type: "analytics",
          source: "company_policy_engine",
          payload: {
            kind: "policy_decision",
            decisionId: entry.decisionId,
            allowedAction: entry.allowedAction ?? "none",
            allowed: entry.allowed,
            reason: entry.reason,
            riskLevel: entry.riskLevel,
            mode: entry.mode,
            override: entry.override === true,
          },
          source_rid: rid,
        });
        if (res.ok === false) {
          opsLog("company_policy.policy_log_insert_failed", {
            error: res.error,
            decisionId: entry.decisionId,
          });
        }
      } catch (e) {
        if (e instanceof IntelligenceSchemaValidationError) {
          opsLog("company_policy.policy_log_validation_failed", {
            message: e.message,
            decisionId: entry.decisionId,
          });
        } else {
          throw e;
        }
      }
    }
    try {
      await sb.from("ai_activity_log").insert(
        buildAiActivityLogRow({
          action: "company_control_tower_cycle",
          page_id: null,
          variant_id: null,
          actor_user_id: ctx.scope?.email ?? null,
          tool: "company_control_tower",
          environment: "preview",
          locale: "nb",
          metadata: {
            tool: "company_control_tower",
            phase: "analyze",
            ...buildCompanyMemoryPayload({ phase: "decision", mode }),
            cycle: {
              logSummary: cycle.logSummary,
              decisionIds: cycle.decisions.map((d) => d.id),
              safety: cycle.safety,
              anomalies: cycle.anomalies,
            },
          },
        }),
      );
    } catch {
      /* best-effort */
    }

    let patternScale: {
      logRid: string;
      suggestions: string[];
      autoSafePatchCount: number;
      patterns?: unknown;
      selectedActions?: unknown;
      proposedActions?: unknown;
      cooldown?: unknown;
      explain?: string[];
    } | null = null;
    let scaleEnginePatches: import("@/lib/cms/design/designContract").DesignSettingsDocument[] = [];
    let scalingApplyResult: Awaited<ReturnType<typeof executeScaleActions>> | null = null;

    if (includePatternScale && !isScaleAutomationEnabled()) {
      opsLog("stabilization.control_tower_scale_skipped", { rid, reason: "ENABLE_SCALE off" });
    }

    if (includePatternScale && isScaleAutomationEnabled()) {
      try {
        const [si, cooldownEvents] = await Promise.all([
          getSystemIntelligence({ limit: 800, recentEventLimit: 250 }),
          getEvents({ types: ["analytics"], limit: 400 }),
        ]);
        const scaleMode = mode === "auto" ? "auto" : "suggest";
        const scale = await runControlledScaleEngine({
          mode: scaleMode,
          intelligence: si,
          cooldownEvents,
          source_rid: rid,
          negativeImpactObserved: cycle.safety.alertLevel === "critical",
        });
        scaleEnginePatches = scale.autoSafeDesignPatches;
        patternScale = {
          logRid: scale.logRid,
          patterns: scale.patternDetection.patterns,
          selectedActions: scale.selectedActions,
          proposedActions: scale.proposedActions,
          cooldown: scale.cooldown,
          explain: scale.explain,
          suggestions: scale.selectedActions.map(
            (a) => `${a.type} · ${a.target}=${a.value} (${(a.confidence * 100).toFixed(0)} %)`,
          ),
          autoSafePatchCount: scale.autoSafeDesignPatches.length,
        };
        try {
          await sb.from("ai_activity_log").insert(
            buildAiActivityLogRow({
              action: "company_control_tower_pattern_scale",
              page_id: null,
              variant_id: null,
              actor_user_id: ctx.scope?.email ?? null,
              tool: "company_control_tower",
              environment: "preview",
              locale: "nb",
              metadata: scaleEngineToControlTowerMetadata(scale),
            }),
          );
        } catch {
          /* best-effort */
        }
      } catch {
        patternScale = null;
        scaleEnginePatches = [];
      }
    }

    if (scalingApplyIds.length > 0 && !isScaleAutomationEnabled()) {
      opsLog("stabilization.scaling_apply_skipped", { rid, reason: "ENABLE_SCALE off" });
    }

    if (scalingApplyIds.length > 0 && isScaleAutomationEnabled()) {
      try {
        const [si, cooldownEvents] = await Promise.all([
          getSystemIntelligence({ limit: 800, recentEventLimit: 250 }),
          getEvents({ types: ["analytics"], limit: 400 }),
        ]);
        const plan = await runControlledScaleEngine({
          mode: "assisted",
          intelligence: si,
          cooldownEvents,
          negativeImpactObserved: cycle.safety.alertLevel === "critical",
          source_rid: rid,
        });
        const allowedIds = new Set(plan.selectedActions.map((a) => a.id));
        const toRun = plan.selectedActions.filter((a) => scalingApplyIds.includes(a.id) && allowedIds.has(a.id));
        if (toRun.length > 0) {
          scalingApplyResult = await executeScaleActions({
            actions: toRun,
            source_rid: rid,
          });
        }
      } catch {
        scalingApplyResult = { ok: false, message: "Skalering feilet." };
      }
    }

    if (scalingIgnoreIds.length > 0) {
      try {
        await sb.from("ai_activity_log").insert(
          buildAiActivityLogRow({
            action: "company_control_tower_scale_ignore",
            page_id: null,
            variant_id: null,
            actor_user_id: ctx.scope?.email ?? null,
            tool: "company_control_tower",
            environment: "preview",
            locale: "nb",
            metadata: { tool: "company_control_tower", ignored: scalingIgnoreIds },
          }),
        );
      } catch {
        /* best-effort activity log */
      }
      const ignoreIntel = await logEvent({
        type: "analytics",
        source: "controlled_scale_engine",
        payload: { kind: "scale_ignore", ids: scalingIgnoreIds },
        source_rid: rid,
      });
      if (ignoreIntel.ok === false) {
        opsLog("ai_intelligence.control_tower_scale_ignore_log_failed", { error: ignoreIntel.error });
      }
    }

    let executed = false;
    let executeMessage: string | null = null;

    const tryApplyPatches = async (patches: import("@/lib/cms/design/designContract").DesignSettingsDocument[]) => {
      if (patches.length === 0) return;
      const merged = mergeDesignOptimizerPatches(patches);
      const res = await applyDesignChanges({ patch: merged, action: "save" });
      if (res.ok) {
        executed = true;
        executeMessage = "Trygge design-patches lagret som globalt utkast.";
        try {
          await sb.from("ai_activity_log").insert(
            buildAiActivityLogRow({
              action: "company_control_tower_execute",
              page_id: null,
              variant_id: null,
              actor_user_id: ctx.scope?.email ?? null,
              tool: "company_control_tower",
              environment: "preview",
              locale: "nb",
              metadata: {
                tool: "company_control_tower",
                phase: "execute",
                patch: merged,
                revertDesignSettings: res.revertDesignSettings,
                ...buildCompanyMemoryPayload({ phase: "execute", mode, result: executeMessage ?? undefined }),
              },
            }),
          );
        } catch {
          /* best-effort */
        }
      } else if (res.ok === false) {
        executeMessage = res.message;
      }
    };

    if (!analyzeOnly && mode === "auto" && !isAutoOptimizeEnabled()) {
      opsLog("stabilization.control_tower_auto_apply_skipped", { rid, reason: "ENABLE_AUTO_OPTIMIZE off" });
    }

    if (!analyzeOnly && mode === "auto" && isAutoOptimizeEnabled()) {
      const cyclePatches = cycle.autoExecutable.map((x) => x.designPatch!).filter(Boolean);
      const mergedAuto =
        includePatternScale && isScaleAutomationEnabled() && scaleEnginePatches.length > 0
          ? [...cyclePatches, ...scaleEnginePatches]
          : cyclePatches;
      if (mergedAuto.length > 0) await tryApplyPatches(mergedAuto);
    }

    if (executeDecisionIds.length > 0 && mode === "assisted") {
      const patches: import("@/lib/cms/design/designContract").DesignSettingsDocument[] = [];
      for (const id of executeDecisionIds) {
        const d = cycle.decisions.find((x) => x.id === id);
        if (!d) continue;
        const p = evaluateCompanyDecision(d, {
          mode: "assisted",
          explicitApproveIds: executeDecisionIds,
          forceOverride,
        });
        if (!p.allowed) continue;
        const patch = companyDecisionToSafeDesignPatch(d);
        if (patch) patches.push(patch);
      }
      await tryApplyPatches(patches);
    }

    if (rejectDecisionIds.length > 0) {
      try {
        await sb.from("ai_activity_log").insert(
          buildAiActivityLogRow({
            action: "company_control_tower_reject",
            page_id: null,
            variant_id: null,
            actor_user_id: ctx.scope?.email ?? null,
            tool: "company_control_tower",
            environment: "preview",
            locale: "nb",
            metadata: {
              tool: "company_control_tower",
              rejected: rejectDecisionIds,
            },
          }),
        );
      } catch {
        /* best-effort */
      }
    }

    return jsonOk(
      ctx.rid,
      {
        snapshot,
        cycle,
        analyzeOnly,
        executed,
        executeMessage,
        guidance:
          "Manuell modus: kun forslag. Assistert: godkjenn beslutnings-IDer med executeDecisionIds. Auto: trygge design-tokens lagres som utkast når policy og sikkerhet tillater.",
        patternScale,
        scalingApplyResult,
      },
      200,
    );
  });
}
