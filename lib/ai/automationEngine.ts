import "server-only";

import { applyControlGate } from "@/lib/ai/control/controlGate";
import { explainControlDecision } from "@/lib/ai/control/explainEngine";
import type { DecisionResult } from "@/lib/ai/decisionEngine";
import { evaluateRisk } from "@/lib/ai/riskEngine";
import { isActionAllowed } from "@/lib/ai/policyEngine";
import type { OrgAction, OrgActionType } from "@/lib/ai/org/orgCoordinator";
import type { RoadmapStep } from "@/lib/ai/roadmapEngine";
import { generateVariant } from "@/lib/ai/generateVariant";
import type { SingularityActionWithScore } from "@/lib/ai/prioritizationEngine";
import { CMS_DRAFT_ENVIRONMENT, sanitizeBlockListForPersistence } from "@/lib/ai/buildHomeFromIntentBody";
import type { BlockList } from "@/lib/cms/model/blockTypes";
import { buildMarketingHomeBody } from "@/lib/cms/seed/marketingHomeBody";
import type { BudgetPlanAction } from "@/lib/ai/capital/actionGenerator";
import { recordRevenue } from "@/lib/ai/revenueEngine";
import { recordControlDecision } from "@/lib/ai/memory/recordControlDecision";
import { launchAdCampaign } from "@/lib/integrations/adsEngine";
import { sendEmailSequence } from "@/lib/integrations/emailEngine";
import { createHomeTrafficExperimentCore } from "@/lib/experiments/createHomeTrafficExperimentCore";
import { processLearning } from "@/lib/ai/learning/learningEngine";
import { storeLearning } from "@/lib/ai/learning/storeLearning";
import { opsLog } from "@/lib/ops/log";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { AutonomyExecutionRecord, AutonomyPolicyContext, MergedAutonomyDecision } from "./autonomy/types";
import { execute as runAutonomyControlledBatch } from "./autonomy/automationLayer";

export type AutomationMode = "preview" | "execute";

/**
 * Preview / gated execute for decision objects — no publishing, no spend, no destructive writes.
 */
export function runAutomation(
  decision: DecisionResult,
  opts: { mode: AutomationMode; approved?: boolean },
): { executed: boolean; actionPreview: string; explain: string } {
  const actionPreview = decision.recommendation;
  if (opts.mode === "preview") {
    return {
      executed: false,
      actionPreview,
      explain: decision.reason,
    };
  }
  if (!opts.approved) {
    return {
      executed: false,
      actionPreview,
      explain: "Utførelse krever eksplisitt godkjenning (approved: true).",
    };
  }
  opsLog("ai_automation_execute_ack", { decisionType: decision.decisionType, mode: opts.mode });
  return {
    executed: false,
    actionPreview,
    explain:
      "Godkjent — denne motoren utfører ingen automatisk skriveoperasjon; bruk CMS / godkjente flyter manuelt.",
  };
}

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}

async function triggerAiOptimizeCron(rid: string): Promise<{ ok: boolean; detail: string }> {
  const secret = safeStr(process.env.SYSTEM_MOTOR_SECRET);
  const site = safeStr(process.env.NEXT_PUBLIC_SITE_URL).replace(/\/$/, "");
  const vercel = safeStr(process.env.VERCEL_URL).replace(/^https?:\/\//, "");
  const base = site || (vercel ? `https://${vercel}` : "");
  if (!secret || !base) {
    return { ok: false, detail: "missing_secret_or_base_url" };
  }
  try {
    const res = await fetch(`${base}/api/cron/ai-optimize`, {
      method: "POST",
      headers: { Authorization: `Bearer ${secret}` },
    });
    return { ok: res.ok, detail: `http_${res.status}` };
  } catch (e) {
    return { ok: false, detail: e instanceof Error ? e.message : String(e) };
  }
}

export type CeoExecuteResult = {
  action: string;
  status: "executed" | "blocked" | "skipped" | "failed";
  detail?: string;
};

/**
 * AI CEO allowlisted automation (cron-only caller expected). No deletes / no schema changes.
 */
export async function executeActions(actions: string[], ctx: { rid: string }): Promise<CeoExecuteResult[]> {
  const gate = applyControlGate(actions);
  await recordControlDecision({ rid: ctx.rid, lane: "executeActions", received: actions, gate });
  const allowedSet = new Set(gate.allowed);
  const results: CeoExecuteResult[] = [];
  for (const action of actions) {
    if (!allowedSet.has(action)) {
      const br = gate.blocked.find((b) => b.action === action);
      opsLog("ai_action_control_blocked", { rid: ctx.rid, action, reasons: br?.reasons });
      results.push({
        action,
        status: "blocked",
        detail: br?.reasons?.length ? br.reasons.join(",") : "control_gate",
      });
      continue;
    }
    opsLog("ai_action_decision", {
      rid: ctx.rid,
      action,
      explanation: explainControlDecision(action, ctx),
    });
    if (!isActionAllowed(action)) {
      opsLog("ai_blocked_action", { action, rid: ctx.rid, reason: "not_in_safe_list" });
      results.push({ action, status: "blocked", detail: "policy" });
      continue;
    }

    if (action === "OPTIMIZE_PAGE") {
      const r = await triggerAiOptimizeCron(ctx.rid);
      opsLog("ai_ceo_execute", { rid: ctx.rid, action, ok: r.ok, detail: r.detail });
      results.push({ action, status: r.ok ? "executed" : "failed", detail: r.detail });
      continue;
    }

    if (action === "RUN_EXPERIMENT") {
      const out = await createHomeTrafficExperimentCore({ rid: ctx.rid, source: "ai_ceo_automation" });
      const ok = out.ok === true;
      opsLog("ai_ceo_execute", {
        rid: ctx.rid,
        action,
        ok,
        code: out.ok === false ? out.code : undefined,
      });
      results.push({
        action,
        status: ok ? "executed" : out.ok === false && out.code === "EXPERIMENT_RUNNING" ? "skipped" : "failed",
        detail: out.ok === false ? out.message : "created",
      });
      continue;
    }

    if (action === "REFRESH_CONTENT") {
      opsLog("ai_ceo_execute", {
        rid: ctx.rid,
        action,
        ok: true,
        detail: "deferred_recommendation_only",
      });
      results.push({ action, status: "skipped", detail: "recommendation_only" });
      continue;
    }
  }
  return results;
}

/**
 * Blackbox path: risk engine first, then same allowlisted execution as {@link executeActions}.
 */
export async function executeBlackboxActions(actions: string[], ctx: { rid: string }): Promise<CeoExecuteResult[]> {
  const results: CeoExecuteResult[] = [];
  for (const action of actions) {
    if (evaluateRisk(action) === "BLOCK") {
      opsLog("blackbox_execute_stopped", { rid: ctx.rid, action, reason: "risk_block" });
      results.push({ action, status: "blocked", detail: "risk_engine" });
      continue;
    }
    const part = await executeActions([action], ctx);
    for (const r of part) {
      opsLog("blackbox_execute_step", { rid: ctx.rid, action: r.action, status: r.status, detail: r.detail });
    }
    results.push(...part);
  }
  return results;
}

export type SingularityExecuteResult = {
  type: "variant" | "optimize" | "experiment";
  status: "executed" | "skipped" | "failed";
  detail?: string;
};

const SINGULARITY_EXEC_ORDER: Record<SingularityExecuteResult["type"], number> = {
  variant: 0,
  optimize: 1,
  experiment: 2,
};

/**
 * Blocks any pricing-shaped action from reaching execution (defense in depth; suggestions stay out of this path).
 */
export function validateBusinessAction(action: { type?: unknown }): boolean {
  const t = String(action?.type ?? "").trim();
  if (t === "INCREASE_PRICE" || t === "DECREASE_PRICE") {
    opsLog("business_action_blocked", { type: t, reason: "pricing_never_auto_executed" });
    return false;
  }
  return true;
}

/**
 * Blocks omniscient MARKET_MOVE from any automation execution path (pricing / market sim must never auto-apply).
 */
export function validateOmniscientAction(action: { type?: unknown }): boolean {
  const t = String(action?.type ?? "").trim();
  if (t === "MARKET_MOVE") {
    opsLog("omniscient_action_blocked", { type: t, reason: "market_simulation_never_auto_executed" });
    return false;
  }
  return true;
}

/**
 * Blocks revenue-mode pricing experiment plans and raw price deltas from execution (simulation / audit only).
 */
export function validateRevenueAction(action: { type?: unknown }): boolean {
  const t = String(action?.type ?? "").trim();
  if (t === "RUN_PRICING_EXPERIMENT" || t === "INCREASE_PRICE" || t === "DECREASE_PRICE") {
    opsLog("revenue_action_blocked", { type: t, reason: "pricing_never_auto_executed" });
    return false;
  }
  return true;
}

/** Autonomous loop guard — pricing deltas never auto-executed (defense in depth). */
export function validateAutonomousAction(action: { type?: unknown }): boolean {
  const t = String(action?.type ?? "").trim();
  if (t === "INCREASE_PRICE" || t === "DECREASE_PRICE") {
    opsLog("autonomous_action_blocked", { type: t, reason: "pricing_never_auto_executed" });
    return false;
  }
  return true;
}

/**
 * Scaling plan guard — advisory only; does not authorize spend.
 * Recognized intents: scale | suppress (internal growth loops only downstream).
 */
export function validateScalingAction(action: { type?: unknown; action?: unknown }): boolean {
  const t = String(action?.type ?? "").trim();
  if (t === "scale") {
    opsLog("scaling_action_guard", { allowed: true, kind: t, targetAction: action.action });
    return true;
  }
  if (t === "suppress") {
    opsLog("scaling_action_guard", { allowed: true, kind: t, targetAction: action.action });
    return true;
  }
  opsLog("scaling_action_guard", { allowed: true, kind: t || "unknown", note: "pass_through" });
  return true;
}

export type SingularityExecuteContext = { rid: string; experimentSource?: string };

/**
 * Singularity growth executor (cron-only). Max actions enforced by caller (slice).
 * Order: draft variant → optimize cron → experiment (draft must exist for experiment core).
 * No unauthenticated fetch to backoffice; service role + same primitives as allowlisted CEO path.
 */
export async function executeSingularityActions(
  actions: SingularityActionWithScore[],
  ctx: SingularityExecuteContext,
): Promise<SingularityExecuteResult[]> {
  const safe = actions
    .filter(validateBusinessAction)
    .filter((a) => validateOmniscientAction(a))
    .filter((a) => validateRevenueAction(a))
    .filter((a) => validateAutonomousAction(a));
  const sorted = [...safe].sort(
    (a, b) => SINGULARITY_EXEC_ORDER[a.type] - SINGULARITY_EXEC_ORDER[b.type],
  );
  const results: SingularityExecuteResult[] = [];

  async function persistSingularityLearning(row: SingularityExecuteResult) {
    const learning = processLearning({
      actionType: row.type,
      context: {
        rid: ctx.rid,
        lane: "executeSingularityActions",
        experimentSource: ctx.experimentSource ?? "singularity_cron",
        detail: row.detail ?? null,
        status: row.status,
      },
      result: {
        success: row.status === "executed",
      },
    });
    await storeLearning(learning, ctx.rid);
  }

  for (const a of sorted) {
    opsLog("ai_action_decision", {
      rid: ctx.rid,
      action: a,
      explanation: explainControlDecision(a, ctx),
    });
    if (a.type === "experiment") {
      const out = await createHomeTrafficExperimentCore({
        rid: ctx.rid,
        source: ctx.experimentSource ?? "singularity_cron",
      });
      const ok = out.ok === true;
      opsLog("singularity_execute", {
        rid: ctx.rid,
        step: "experiment",
        ok,
        code: out.ok === false ? out.code : undefined,
      });
      results.push({
        type: "experiment",
        status: ok ? "executed" : out.ok === false && out.code === "EXPERIMENT_RUNNING" ? "skipped" : "failed",
        detail: out.ok === false ? out.message : "created",
      });
      await persistSingularityLearning(results[results.length - 1]!);
      continue;
    }

    if (a.type === "optimize") {
      const r = await triggerAiOptimizeCron(ctx.rid);
      opsLog("singularity_execute", { rid: ctx.rid, step: "optimize", ok: r.ok, detail: r.detail });
      results.push({
        type: "optimize",
        status: r.ok ? "executed" : "failed",
        detail: r.detail,
      });
      await persistSingularityLearning(results[results.length - 1]!);
      continue;
    }

    if (a.type === "variant") {
      const r = await upsertSingularityDraftHome(a.data, ctx.rid);
      opsLog("singularity_execute", { rid: ctx.rid, step: "variant_draft", ok: r.ok, detail: r.detail });
      results.push({
        type: "variant",
        status: r.ok ? "executed" : "failed",
        detail: r.detail,
      });
      await persistSingularityLearning(results[results.length - 1]!);
    }
  }

  return results;
}

async function upsertSingularityDraftHome(body: BlockList, rid: string): Promise<{ ok: boolean; detail: string }> {
  const bodyDoc = sanitizeBlockListForPersistence(body);
  const supabase = supabaseAdmin();

  const { data: page, error: pageErr } = await supabase.from("content_pages").select("id").eq("slug", "home").maybeSingle();
  if (pageErr) {
    opsLog("singularity_draft_home_error", { rid, message: pageErr.message });
    return { ok: false, detail: pageErr.message };
  }
  if (!page?.id) {
    return { ok: false, detail: "home_page_not_found" };
  }

  const now = new Date().toISOString();
  const { error } = await supabase.from("content_page_variants").upsert(
    {
      page_id: page.id,
      locale: "nb",
      environment: CMS_DRAFT_ENVIRONMENT,
      body: bodyDoc,
      updated_at: now,
    },
    { onConflict: "page_id,locale,environment" },
  );
  if (error) {
    opsLog("singularity_draft_home_error", { rid, message: error.message });
    return { ok: false, detail: error.message };
  }

  const { error: pageTsErr } = await supabase.from("content_pages").update({ updated_at: now }).eq("id", page.id);
  if (pageTsErr) {
    opsLog("singularity_draft_home_error", { rid, message: pageTsErr.message });
    return { ok: false, detail: pageTsErr.message };
  }

  try {
    const { recordPageContentVersion } = await import("@/lib/backoffice/content/pageVersionsRepo");
    await recordPageContentVersion(supabase as any, {
      pageId: page.id,
      locale: "nb",
      environment: CMS_DRAFT_ENVIRONMENT,
      createdBy: null,
      label: "AI genererte innhold",
      action: "ai",
    });
  } catch (e) {
    opsLog("singularity_draft_home_version_error", {
      rid,
      message: e instanceof Error ? e.message : String(e),
    });
    return { ok: false, detail: "draft_version_snapshot_failed" };
  }

  return { ok: true, detail: "draft_upserted" };
}

export type StrategicPlanExecutionRow = {
  step: RoadmapStep;
  status: "executed" | "skipped" | "failed";
  detail?: string;
};

/**
 * Runs at most two roadmap steps (cron-only). No unauthenticated backoffice HTTP; draft/experiment/optimize only.
 * `pricing_review` is never auto-applied (skipped with audit log).
 */
export async function executeStrategicPlan(
  plan: RoadmapStep[],
  ctx: { rid: string },
): Promise<StrategicPlanExecutionRow[]> {
  const prioritized = [...plan].sort((a, b) => {
    if (a.week !== b.week) return a.week - b.week;
    const ORDER: Record<string, number> = { experiment: 0, optimize: 1, create_variant: 2, pricing_review: 3 };
    return (ORDER[a.action] ?? 99) - (ORDER[b.action] ?? 99);
  });
  const slice = prioritized.slice(0, 2);
  const results: StrategicPlanExecutionRow[] = [];

  for (const step of slice) {
    opsLog("strategic_plan_step", { rid: ctx.rid, step });

    if (step.action === "pricing_review") {
      opsLog("strategic_pricing_review_manual_only", { rid: ctx.rid, focus: step.focus });
      results.push({ step, status: "skipped", detail: "pricing_never_auto_applied" });
      continue;
    }

    if (step.action === "experiment") {
      const out = await createHomeTrafficExperimentCore({ rid: ctx.rid, source: "strategy_cron" });
      const ok = out.ok === true;
      opsLog("strategic_execute", {
        rid: ctx.rid,
        action: step.action,
        ok,
        code: out.ok === false ? out.code : undefined,
      });
      results.push({
        step,
        status: ok ? "executed" : out.ok === false && out.code === "EXPERIMENT_RUNNING" ? "skipped" : "failed",
        detail: out.ok === false ? out.message : "created",
      });
      continue;
    }

    if (step.action === "optimize") {
      const r = await triggerAiOptimizeCron(ctx.rid);
      opsLog("strategic_execute", { rid: ctx.rid, action: step.action, ok: r.ok, detail: r.detail });
      results.push({ step, status: r.ok ? "executed" : "failed", detail: r.detail });
      continue;
    }

    if (step.action === "create_variant") {
      const body = generateVariant(buildMarketingHomeBody());
      const r = await upsertSingularityDraftHome(body, ctx.rid);
      opsLog("strategic_execute", { rid: ctx.rid, action: step.action, ok: r.ok, detail: r.detail });
      results.push({ step, status: r.ok ? "executed" : "failed", detail: r.detail });
      continue;
    }

    results.push({ step, status: "skipped", detail: "unknown_action" });
  }

  return results;
}

export type OrgExecutionRow = {
  action: OrgAction;
  status: "executed" | "skipped" | "failed";
  detail?: string;
};

/**
 * Multi-agent org executor (cron-only). Max two actions; no pricing; no unauthenticated backoffice HTTP.
 * `stability_check` is audit-only (ops log, no writes) — reversible.
 */
export type MarketActionCandidate =
  | OrgAction
  | { type: "INCREASE_PRICE"; delta?: number }
  | { type: "DECREASE_PRICE"; delta?: number };

/** Blocks pricing-shaped actions from reaching any executor (defense in depth). */
export function validateMarketAction(action: MarketActionCandidate): boolean {
  const t = action.type;
  if (t === "INCREASE_PRICE" || t === "DECREASE_PRICE") return false;
  return true;
}

const ORG_EXECUTABLE_TYPES: OrgActionType[] = ["experiment", "variant", "optimize", "stability_check"];

function isOrgExecutableAction(a: MarketActionCandidate): a is OrgAction {
  return ORG_EXECUTABLE_TYPES.includes(a.type as OrgActionType);
}

/**
 * Filters out pricing simulations and unknown types, then runs {@link executeOrgActions} (max 2).
 */
export async function executeMarketActions(
  actions: MarketActionCandidate[],
  ctx: { rid: string; experimentSource?: string },
): Promise<OrgExecutionRow[]> {
  const afterPriceFilter = actions.filter(validateMarketAction);
  const orgOnly = afterPriceFilter.filter(isOrgExecutableAction);
  opsLog("market_execute_filtered", {
    rid: ctx.rid,
    inCount: actions.length,
    afterPriceBlock: afterPriceFilter.length,
    orgExecutable: orgOnly.length,
  });
  return executeOrgActions(orgOnly.slice(0, 2), ctx);
}

export async function executeOrgActions(
  actions: OrgAction[],
  ctx: { rid: string; experimentSource?: string },
): Promise<OrgExecutionRow[]> {
  const gate = applyControlGate(actions);
  await recordControlDecision({ rid: ctx.rid, lane: "executeOrgActions", received: actions, gate });
  const safeActions = (gate.allowed as OrgAction[]).slice(0, 2);
  const results: OrgExecutionRow[] = [];

  for (const action of safeActions) {
    opsLog("ai_action_decision", {
      rid: ctx.rid,
      action,
      explanation: explainControlDecision(action, ctx),
    });
    opsLog("org_execute_step", { rid: ctx.rid, type: action.type });

    if (action.type === "experiment") {
      const out = await createHomeTrafficExperimentCore({
        rid: ctx.rid,
        source: ctx.experimentSource ?? "org_cron",
      });
      const ok = out.ok === true;
      opsLog("org_execute", {
        rid: ctx.rid,
        type: action.type,
        ok,
        code: out.ok === false ? out.code : undefined,
      });
      results.push({
        action,
        status: ok ? "executed" : out.ok === false && out.code === "EXPERIMENT_RUNNING" ? "skipped" : "failed",
        detail: out.ok === false ? out.message : "created",
      });
      continue;
    }

    if (action.type === "variant") {
      const body = generateVariant(buildMarketingHomeBody());
      const r = await upsertSingularityDraftHome(body, ctx.rid);
      opsLog("org_execute", { rid: ctx.rid, type: action.type, ok: r.ok, detail: r.detail });
      results.push({ action, status: r.ok ? "executed" : "failed", detail: r.detail });
      continue;
    }

    if (action.type === "optimize") {
      const r = await triggerAiOptimizeCron(ctx.rid);
      opsLog("org_execute", { rid: ctx.rid, type: action.type, ok: r.ok, detail: r.detail });
      results.push({ action, status: r.ok ? "executed" : "failed", detail: r.detail });
      continue;
    }

    if (action.type === "stability_check") {
      opsLog("org_stability_audit", { rid: ctx.rid, detail: "audit_only_reversible" });
      results.push({ action, status: "executed", detail: "audit_only_no_writes" });
      continue;
    }

    results.push({ action, status: "skipped", detail: "unknown_org_action" });
  }

  return results;
}

export type BudgetExecutionRow = {
  type: string;
  status: "executed" | "skipped" | "failed" | "audit_only";
  detail?: string;
};

/**
 * Budget / capital plan → safe internal steps only (max 3). No ad spend, no external APIs, no backoffice HTTP.
 * RUN_AB_TEST / OPTIMIZE_CTA / CREATE_LANDING_PAGE / FEATURE_IMPROVEMENT use existing service-role primitives.
 */
export async function executeBudgetPlanActions(
  actions: BudgetPlanAction[],
  ctx: { rid: string },
): Promise<BudgetExecutionRow[]> {
  const slice = actions.slice(0, 3);
  const results: BudgetExecutionRow[] = [];

  for (const action of slice) {
    const t = String(action?.type ?? "").trim();
    opsLog("budget_execution_step", { rid: ctx.rid, type: t });

    switch (t) {
      case "LAUNCH_AD_CAMPAIGN": {
        const ad = await launchAdCampaign(action, { rid: ctx.rid });
        opsLog("execution_plan_ad_campaign", { rid: ctx.rid, action: t, ad });
        results.push({
          type: t,
          status: ad.ok ? "executed" : "audit_only",
          detail: ad.ok ? ad.campaignId ?? ad.detail : ad.detail ?? "ads_disabled",
        });
        break;
      }
      case "TEST_NEW_CHANNEL":
        opsLog("execution_plan_test_channel", { rid: ctx.rid, action: t, note: "audit_only" });
        results.push({ type: t, status: "audit_only", detail: "planning_only" });
        break;
      case "RUN_AB_TEST": {
        const out = await createHomeTrafficExperimentCore({
          rid: ctx.rid,
          source: "budget_execution_cron",
        });
        const ok = out.ok === true;
        opsLog("execution_plan_experiment", {
          rid: ctx.rid,
          ok,
          code: out.ok === false ? out.code : undefined,
        });
        results.push({
          type: t,
          status: ok ? "executed" : out.ok === false && out.code === "EXPERIMENT_RUNNING" ? "skipped" : "failed",
          detail: out.ok === false ? out.message : "created",
        });
        break;
      }
      case "OPTIMIZE_CTA":
      case "FEATURE_IMPROVEMENT": {
        const r = await triggerAiOptimizeCron(ctx.rid);
        opsLog("execution_plan_optimize", { rid: ctx.rid, type: t, ok: r.ok, detail: r.detail });
        results.push({ type: t, status: r.ok ? "executed" : "failed", detail: r.detail });
        break;
      }
      case "CREATE_LANDING_PAGE": {
        const body = generateVariant(buildMarketingHomeBody());
        const r = await upsertSingularityDraftHome(body, ctx.rid);
        opsLog("execution_plan_landing_draft", { rid: ctx.rid, ok: r.ok, detail: r.detail });
        results.push({ type: t, status: r.ok ? "executed" : "failed", detail: r.detail });
        break;
      }
      case "EMAIL_SEQUENCE": {
        const mail = await sendEmailSequence(action, { rid: ctx.rid });
        opsLog("execution_plan_email", { rid: ctx.rid, action: t, mail });
        results.push({
          type: t,
          status: mail.ok ? "executed" : "audit_only",
          detail: mail.ok ? mail.detail ?? "safe_mode" : mail.detail ?? "email_disabled",
        });
        break;
      }
      case "REVENUE_EVENT": {
        const rev = await recordRevenue(action, { rid: ctx.rid });
        opsLog("execution_plan_revenue", { rid: ctx.rid, action: t, rev });
        results.push({
          type: t,
          status: rev.ok ? "executed" : rev.skipped ? "skipped" : "failed",
          detail: rev.invoiceId ?? rev.reason ?? "revenue",
        });
        break;
      }
      case "LOYALTY_FLOW":
        opsLog("execution_plan_loyalty", { rid: ctx.rid, action: t, note: "audit_only" });
        results.push({ type: t, status: "audit_only", detail: "planning_only" });
        break;
      case "SEO_ARTICLE":
        opsLog("execution_plan_seo_article", { rid: ctx.rid, action: t, note: "audit_only" });
        results.push({ type: t, status: "audit_only", detail: "content_plan_only" });
        break;
      default:
        opsLog("execution_plan_unknown_action", { rid: ctx.rid, type: t });
        results.push({ type: t || "unknown", status: "skipped", detail: "unknown_budget_action" });
    }
  }

  return results;
}

/**
 * Self-driving SaaS batch: policy gate + max 2 safe log rows (no publish / no code / no destructive writes).
 */
export async function execute(
  decisions: MergedAutonomyDecision[],
  ctx: AutonomyPolicyContext & { rid: string },
): Promise<AutonomyExecutionRecord[]> {
  return runAutonomyControlledBatch({ rid: ctx.rid, merged: decisions, ctx });
}
