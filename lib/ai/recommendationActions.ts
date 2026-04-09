import "server-only";

import type { AiDashboardRecommendation } from "@/lib/ai/dashboardEngine";
import {
  type AiRecommendationApplyAction,
  captureRelevantState,
  computeInverse,
  type GovernanceSnapshotV1,
  requiresConfirmationForAction,
  restoreSnapshot,
  type InverseSpec,
} from "@/lib/ai/governanceApplySafety";
import { scheduleAuditEvent } from "@/lib/security/audit";
import { supabaseAdmin } from "@/lib/supabase/admin";

import {
  activePlatformThrottleForTool,
  loadCompanyRunnerGovernance,
  loadPlatformRunnerGovernance,
  type CompanyRunnerGovernance,
  type PlatformRunnerGovernance,
} from "@/lib/ai/runnerGovernance";

export type { AiRecommendationApplyAction } from "@/lib/ai/governanceApplySafety";

export type AiRecommendationApplyRequest = {
  action: AiRecommendationApplyAction | "rollback_governance_apply";
  payload: Record<string, unknown>;
  recommendation_id?: string | null;
  dry_run?: boolean;
  confirmed?: boolean;
  idempotency_key?: string | null;
};

/** Apply request excluding rollback (internal governance mutations only). */
export type AiGovernanceMutationRequest = Omit<AiRecommendationApplyRequest, "action"> & {
  action: AiRecommendationApplyAction;
};

export type AiRecommendationApplyOption = {
  option_id: string;
  label: string;
  action: AiRecommendationApplyAction;
  payload: Record<string, unknown>;
  requires_confirmation: boolean;
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuid(v: string): boolean {
  return UUID_RE.test(v.trim());
}

function normTool(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  if (t.length < 1 || t.length > 220) return null;
  if (!/^[\w.-]+$/.test(t)) return null;
  return t;
}

function normNote(v: unknown, max = 4000): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  if (!s) return null;
  return s.slice(0, max);
}

const APPLY_ACTIONS: AiRecommendationApplyAction[] = [
  "downgrade_company_model_tier",
  "restore_company_model_tier",
  "block_tool",
  "unblock_tool",
  "throttle_tool_platform",
  "unthrottle_tool_platform",
  "set_company_billing_flag",
  "clear_company_billing_flag",
  "set_company_policy_note",
  "set_platform_policy_note",
];

function normIdempotencyKey(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  if (s.length < 8 || s.length > 160) return null;
  if (!/^[\w.:-]+$/.test(s)) return null;
  return s;
}

function emptyPlatform(): PlatformRunnerGovernance {
  return { blocked_tools: [], policy_notes: null, throttled_tools: [] };
}

function normThrottleHours(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) {
    return Math.min(168, Math.max(1, Math.floor(v)));
  }
  if (typeof v === "string" && v.trim()) {
    const n = Number(v);
    if (Number.isFinite(n)) return Math.min(168, Math.max(1, Math.floor(n)));
  }
  return 24;
}

export function parseAiRecommendationApplyRequest(body: unknown): AiRecommendationApplyRequest | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const o = body as Record<string, unknown>;
  const action = o.action;
  const payload = o.payload;
  if (typeof action !== "string" || !payload || typeof payload !== "object" || Array.isArray(payload)) {
    return null;
  }
  if (action === "rollback_governance_apply") {
    const recId = o.recommendation_id;
    return {
      action: "rollback_governance_apply",
      payload: payload as Record<string, unknown>,
      recommendation_id: typeof recId === "string" ? recId : null,
      dry_run: o.dry_run === true,
      confirmed: o.confirmed === true,
      idempotency_key: normIdempotencyKey(o.idempotency_key),
    };
  }
  if (!APPLY_ACTIONS.includes(action as AiRecommendationApplyAction)) return null;
  const recId = o.recommendation_id;
  return {
    action: action as AiRecommendationApplyAction,
    payload: payload as Record<string, unknown>,
    recommendation_id: typeof recId === "string" ? recId : null,
    dry_run: o.dry_run === true,
    confirmed: o.confirmed === true,
    idempotency_key: normIdempotencyKey(o.idempotency_key),
  };
}

function mergeCompanyGov(prev: CompanyRunnerGovernance, next: Partial<CompanyRunnerGovernance>): CompanyRunnerGovernance {
  return {
    model_tier: next.model_tier ?? prev.model_tier,
    blocked_tools: next.blocked_tools ?? prev.blocked_tools,
    policy_notes: next.policy_notes !== undefined ? next.policy_notes : prev.policy_notes,
  };
}

function mergePlatformData(prev: PlatformRunnerGovernance, next: Partial<PlatformRunnerGovernance>): PlatformRunnerGovernance {
  return {
    blocked_tools: next.blocked_tools ?? prev.blocked_tools,
    policy_notes: next.policy_notes !== undefined ? next.policy_notes : prev.policy_notes,
    throttled_tools: next.throttled_tools ?? prev.throttled_tools,
    auto_execution_state:
      next.auto_execution_state !== undefined ? next.auto_execution_state : prev.auto_execution_state,
    auto_execution_last_summary:
      next.auto_execution_last_summary !== undefined
        ? next.auto_execution_last_summary
        : prev.auto_execution_last_summary,
    auto_adaptive_learning:
      next.auto_adaptive_learning !== undefined ? next.auto_adaptive_learning : prev.auto_adaptive_learning,
    business_engine: next.business_engine !== undefined ? next.business_engine : prev.business_engine,
  };
}

async function writeCompanyGov(companyId: string, gov: CompanyRunnerGovernance): Promise<void> {
  const { error } = await supabaseAdmin()
    .from("companies")
    .update({ ai_runner_governance: gov as unknown as Record<string, unknown> })
    .eq("id", companyId);
  if (error) throw new Error(`COMPANY_GOV_WRITE_FAILED: ${error.message}`);
}

async function writePlatformData(data: PlatformRunnerGovernance): Promise<void> {
  const { error } = await supabaseAdmin()
    .from("ai_platform_governance")
    .upsert(
      { id: 1, data: data as unknown as Record<string, unknown>, updated_at: new Date().toISOString() },
      { onConflict: "id" },
    );
  if (error) throw new Error(`PLATFORM_GOV_WRITE_FAILED: ${error.message}`);
}

function cloneSnap(s: GovernanceSnapshotV1): GovernanceSnapshotV1 {
  return JSON.parse(JSON.stringify(s)) as GovernanceSnapshotV1;
}

/** Simulated post-state for dry-run (in-memory). */
export function simulateAfterSnapshot(
  before: GovernanceSnapshotV1,
  action: AiRecommendationApplyAction,
  payload: Record<string, unknown>,
): GovernanceSnapshotV1 {
  const after = cloneSnap(before);
  if (!after.companies) after.companies = {};
  const companyId = typeof payload.company_id === "string" ? payload.company_id.trim() : "";

  switch (action) {
    case "downgrade_company_model_tier":
      if (companyId && after.companies[companyId]) {
        after.companies[companyId] = {
          ...after.companies[companyId],
          ai_runner_governance: mergeCompanyGov(after.companies[companyId].ai_runner_governance, {
            model_tier: "economy",
          }),
        };
      }
      break;
    case "restore_company_model_tier":
      if (companyId && after.companies[companyId]) {
        after.companies[companyId] = {
          ...after.companies[companyId],
          ai_runner_governance: mergeCompanyGov(after.companies[companyId].ai_runner_governance, {
            model_tier: "default",
          }),
        };
      }
      break;
    case "block_tool": {
      const tool = normTool(payload.tool);
      if (!tool) break;
      if (payload.scope === "company" && companyId && after.companies[companyId]) {
        const g = after.companies[companyId].ai_runner_governance;
        if (!g.blocked_tools.includes(tool)) {
          after.companies[companyId] = {
            ...after.companies[companyId],
            ai_runner_governance: mergeCompanyGov(g, { blocked_tools: [...g.blocked_tools, tool] }),
          };
        }
      } else {
        if (!after.platform) after.platform = emptyPlatform();
        if (!after.platform.blocked_tools.includes(tool)) {
          after.platform = mergePlatformData(after.platform, { blocked_tools: [...after.platform.blocked_tools, tool] });
        }
      }
      break;
    }
    case "unblock_tool": {
      const tool = normTool(payload.tool);
      if (!tool) break;
      if (payload.scope === "company" && companyId && after.companies[companyId]) {
        const g = after.companies[companyId].ai_runner_governance;
        after.companies[companyId] = {
          ...after.companies[companyId],
          ai_runner_governance: mergeCompanyGov(g, {
            blocked_tools: g.blocked_tools.filter((x) => x !== tool),
          }),
        };
      } else {
        if (!after.platform) after.platform = emptyPlatform();
        after.platform = mergePlatformData(after.platform, {
          blocked_tools: after.platform.blocked_tools.filter((x) => x !== tool),
        });
      }
      break;
    }
    case "throttle_tool_platform": {
      const tool = normTool(payload.tool);
      if (!tool) break;
      const hours = normThrottleHours(payload.duration_hours);
      const until = new Date(Date.now() + hours * 3_600_000).toISOString();
      if (!after.platform) after.platform = emptyPlatform();
      const rest = after.platform.throttled_tools.filter((e) => e.tool !== tool);
      after.platform = mergePlatformData(after.platform, { throttled_tools: [...rest, { tool, until }] });
      break;
    }
    case "unthrottle_tool_platform": {
      const tool = normTool(payload.tool);
      if (!tool) break;
      if (!after.platform) after.platform = emptyPlatform();
      after.platform = mergePlatformData(after.platform, {
        throttled_tools: after.platform.throttled_tools.filter((e) => e.tool !== tool),
      });
      break;
    }
    case "set_company_billing_flag":
      if (companyId && after.companies[companyId]) {
        const reason =
          (typeof payload.reason === "string" ? payload.reason.trim().slice(0, 500) : "") || "MANUAL_FLAG_BY_OPERATOR";
        after.companies[companyId] = {
          ...after.companies[companyId],
          ai_billing_flagged: true,
          ai_billing_flag_reason: reason,
        };
      }
      break;
    case "clear_company_billing_flag":
      if (companyId && after.companies[companyId]) {
        after.companies[companyId] = {
          ...after.companies[companyId],
          ai_billing_flagged: false,
          ai_billing_flag_reason: null,
        };
      }
      break;
    case "set_company_policy_note":
      if (companyId && after.companies[companyId]) {
        const raw = typeof payload.note === "string" ? payload.note : "";
        const note = raw.trim() === "" ? null : normNote(payload.note);
        after.companies[companyId] = {
          ...after.companies[companyId],
          ai_runner_governance: mergeCompanyGov(after.companies[companyId].ai_runner_governance, {
            policy_notes: note,
          }),
        };
      }
      break;
    case "set_platform_policy_note":
      if (!after.platform) after.platform = emptyPlatform();
      {
        const raw = typeof payload.note === "string" ? payload.note : "";
        const note = raw.trim() === "" ? null : normNote(payload.note);
        after.platform = mergePlatformData(after.platform, { policy_notes: note });
      }
      break;
    default:
      break;
  }
  if (after.companies && Object.keys(after.companies).length === 0) delete after.companies;
  return after;
}

type MutationResult = { summary: string; detail: Record<string, unknown> };

async function performMutation(
  action: AiRecommendationApplyAction,
  payload: Record<string, unknown>,
  dryRun: boolean,
): Promise<MutationResult> {
  switch (action) {
    case "downgrade_company_model_tier": {
      const companyId = typeof payload.company_id === "string" ? payload.company_id.trim() : "";
      if (!isUuid(companyId)) throw new Error("INVALID_COMPANY_ID");
      const prev = await loadCompanyRunnerGovernance(companyId);
      if (prev.model_tier === "economy") {
        return {
          summary: "Selskapet bruker allerede economy-modell.",
          detail: { company_id: companyId, model_tier: "economy" },
        };
      }
      const next = mergeCompanyGov(prev, { model_tier: "economy" });
      if (!dryRun) await writeCompanyGov(companyId, next);
      return {
        summary: "Modellnivå satt til economy for selskapet.",
        detail: { company_id: companyId, model_tier: "economy" },
      };
    }
    case "restore_company_model_tier": {
      const companyId = typeof payload.company_id === "string" ? payload.company_id.trim() : "";
      if (!isUuid(companyId)) throw new Error("INVALID_COMPANY_ID");
      const prev = await loadCompanyRunnerGovernance(companyId);
      const next = mergeCompanyGov(prev, { model_tier: "default" });
      if (!dryRun) await writeCompanyGov(companyId, next);
      return { summary: "Modellnivå tilbake til standard.", detail: { company_id: companyId, model_tier: "default" } };
    }
    case "block_tool": {
      const tool = normTool(payload.tool);
      if (!tool) throw new Error("INVALID_TOOL");
      const scope = payload.scope === "company" ? "company" : "platform";
      if (scope === "platform") {
        const prev = await loadPlatformRunnerGovernance();
        if (prev.blocked_tools.includes(tool)) {
          return { summary: "Verktøyet var allerede blokkert (plattform).", detail: { scope: "platform", tool } };
        }
        const next = mergePlatformData(prev, { blocked_tools: [...prev.blocked_tools, tool] });
        if (!dryRun) await writePlatformData(next);
        return { summary: `Verktøy blokkert på plattform: ${tool}`, detail: { scope: "platform", tool } };
      }
      const companyId = typeof payload.company_id === "string" ? payload.company_id.trim() : "";
      if (!isUuid(companyId)) throw new Error("INVALID_COMPANY_ID");
      const prev = await loadCompanyRunnerGovernance(companyId);
      if (prev.blocked_tools.includes(tool)) {
        return {
          summary: "Verktøyet var allerede blokkert for selskapet.",
          detail: { scope: "company", company_id: companyId, tool },
        };
      }
      const next = mergeCompanyGov(prev, { blocked_tools: [...prev.blocked_tools, tool] });
      if (!dryRun) await writeCompanyGov(companyId, next);
      return { summary: `Verktøy blokkert for selskap: ${tool}`, detail: { scope: "company", company_id: companyId, tool } };
    }
    case "unblock_tool": {
      const tool = normTool(payload.tool);
      if (!tool) throw new Error("INVALID_TOOL");
      const scope = payload.scope === "company" ? "company" : "platform";
      if (scope === "platform") {
        const prev = await loadPlatformRunnerGovernance();
        const next = mergePlatformData(prev, { blocked_tools: prev.blocked_tools.filter((x) => x !== tool) });
        if (!dryRun) await writePlatformData(next);
        return { summary: `Verktøy fjernet fra plattformblokkering: ${tool}`, detail: { scope: "platform", tool } };
      }
      const companyId = typeof payload.company_id === "string" ? payload.company_id.trim() : "";
      if (!isUuid(companyId)) throw new Error("INVALID_COMPANY_ID");
      const prev = await loadCompanyRunnerGovernance(companyId);
      const next = mergeCompanyGov(prev, { blocked_tools: prev.blocked_tools.filter((x) => x !== tool) });
      if (!dryRun) await writeCompanyGov(companyId, next);
      return { summary: `Verktøy fjernet fra selskapsblokkering: ${tool}`, detail: { scope: "company", company_id: companyId, tool } };
    }
    case "set_company_billing_flag": {
      const companyId = typeof payload.company_id === "string" ? payload.company_id.trim() : "";
      if (!isUuid(companyId)) throw new Error("INVALID_COMPANY_ID");
      const reasonRaw = typeof payload.reason === "string" ? payload.reason.trim() : "";
      const reason = reasonRaw.slice(0, 500) || "MANUAL_FLAG_BY_OPERATOR";
      if (!dryRun) {
        const { error } = await supabaseAdmin()
          .from("companies")
          .update({
            ai_billing_flagged: true,
            ai_billing_flag_reason: reason,
            ai_billing_evaluated_at: new Date().toISOString(),
          })
          .eq("id", companyId);
        if (error) throw new Error(`COMPANY_FLAG_WRITE_FAILED: ${error.message}`);
      }
      return { summary: "Selskap markert for AI-fakturering.", detail: { company_id: companyId, ai_billing_flag_reason: reason } };
    }
    case "clear_company_billing_flag": {
      const companyId = typeof payload.company_id === "string" ? payload.company_id.trim() : "";
      if (!isUuid(companyId)) throw new Error("INVALID_COMPANY_ID");
      if (!dryRun) {
        const { error } = await supabaseAdmin()
          .from("companies")
          .update({
            ai_billing_flagged: false,
            ai_billing_flag_reason: null,
            ai_billing_evaluated_at: new Date().toISOString(),
          })
          .eq("id", companyId);
        if (error) throw new Error(`COMPANY_FLAG_CLEAR_FAILED: ${error.message}`);
      }
      return { summary: "AI-faktureringsflagg fjernet.", detail: { company_id: companyId } };
    }
    case "set_company_policy_note": {
      const companyId = typeof payload.company_id === "string" ? payload.company_id.trim() : "";
      if (!isUuid(companyId)) throw new Error("INVALID_COMPANY_ID");
      const raw = typeof payload.note === "string" ? payload.note : "";
      const noteVal = raw.trim() === "" ? null : normNote(payload.note);
      if (raw.trim() !== "" && !noteVal) throw new Error("INVALID_NOTE");
      const prev = await loadCompanyRunnerGovernance(companyId);
      const next = mergeCompanyGov(prev, { policy_notes: noteVal });
      if (!dryRun) await writeCompanyGov(companyId, next);
      return { summary: "Policy-notat lagret på selskap.", detail: { company_id: companyId } };
    }
    case "set_platform_policy_note": {
      const raw = typeof payload.note === "string" ? payload.note : "";
      const noteVal = raw.trim() === "" ? null : normNote(payload.note);
      if (raw.trim() !== "" && !noteVal) throw new Error("INVALID_NOTE");
      const prev = await loadPlatformRunnerGovernance();
      const next = mergePlatformData(prev, { policy_notes: noteVal });
      if (!dryRun) await writePlatformData(next);
      return { summary: "Plattform policy-notat lagret.", detail: {} };
    }
    case "throttle_tool_platform": {
      const tool = normTool(payload.tool);
      if (!tool) throw new Error("INVALID_TOOL");
      const hours = normThrottleHours(payload.duration_hours);
      const until = new Date(Date.now() + hours * 3_600_000).toISOString();
      const prev = await loadPlatformRunnerGovernance();
      if (activePlatformThrottleForTool(prev.throttled_tools, tool)) {
        return {
          summary: "Verktøyet er allerede strupet på plattform (aktiv tidsbegrensning).",
          detail: { tool, scope: "platform" },
        };
      }
      const rest = prev.throttled_tools.filter((e) => e.tool !== tool);
      const next = mergePlatformData(prev, { throttled_tools: [...rest, { tool, until }] });
      if (!dryRun) await writePlatformData(next);
      return {
        summary: `Verktøy midlertidig strupet på plattform (${hours} t): ${tool}`,
        detail: { scope: "platform", tool, duration_hours: hours, until },
      };
    }
    case "unthrottle_tool_platform": {
      const tool = normTool(payload.tool);
      if (!tool) throw new Error("INVALID_TOOL");
      const prev = await loadPlatformRunnerGovernance();
      const had = prev.throttled_tools.some((e) => e.tool === tool);
      if (!had) {
        return {
          summary: "Verktøyet hadde ingen plattform-struping å fjerne.",
          detail: { scope: "platform", tool },
        };
      }
      const next = mergePlatformData(prev, {
        throttled_tools: prev.throttled_tools.filter((e) => e.tool !== tool),
      });
      if (!dryRun) await writePlatformData(next);
      return { summary: `Plattform-struping fjernet for verktøy: ${tool}`, detail: { scope: "platform", tool } };
    }
    default:
      throw new Error(`UNSUPPORTED_ACTION:${String(action)}`);
  }
}

function stablePayloadKey(payload: Record<string, unknown>): string {
  return JSON.stringify(payload, Object.keys(payload).sort());
}

async function fetchIdempotentResult(
  key: string,
  action: string,
  payload: Record<string, unknown>,
): Promise<Record<string, unknown> | null> {
  const { data, error } = await supabaseAdmin()
    .from("ai_governance_apply_log")
    .select("result, action, payload")
    .eq("idempotency_key", key)
    .eq("dry_run", false)
    .maybeSingle();
  if (error || !data?.result || typeof data.result !== "object") return null;
  const prevAct = typeof data.action === "string" ? data.action : "";
  const prevPayload =
    data.payload && typeof data.payload === "object" && !Array.isArray(data.payload)
      ? (data.payload as Record<string, unknown>)
      : {};
  if (prevAct !== action || stablePayloadKey(prevPayload) !== stablePayloadKey(payload)) {
    throw new Error("IDEMPOTENCY_KEY_CONFLICT");
  }
  return data.result as Record<string, unknown>;
}

async function insertApplyLog(row: {
  idempotency_key: string | null;
  user_id: string | null;
  actor_email: string | null;
  rid: string;
  recommendation_id: string | null;
  action: string;
  payload: Record<string, unknown>;
  dry_run: boolean;
  snapshot_before: GovernanceSnapshotV1;
  snapshot_after: GovernanceSnapshotV1 | null;
  inverse_action: string | null;
  inverse_payload: Record<string, unknown> | null;
  result: Record<string, unknown>;
  rollback_of_id: string | null;
}): Promise<{ id: string }> {
  const { data, error } = await supabaseAdmin()
    .from("ai_governance_apply_log")
    .insert({
      idempotency_key: row.idempotency_key,
      user_id: row.user_id,
      actor_email: row.actor_email,
      rid: row.rid,
      recommendation_id: row.recommendation_id,
      action: row.action,
      payload: row.payload,
      dry_run: row.dry_run,
      snapshot_before: row.snapshot_before as unknown as Record<string, unknown>,
      snapshot_after: row.snapshot_after ? (row.snapshot_after as unknown as Record<string, unknown>) : null,
      inverse_action: row.inverse_action,
      inverse_payload: row.inverse_payload,
      result: row.result,
      rollback_of_id: row.rollback_of_id,
    })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505" && row.idempotency_key) {
      throw new Error("IDEMPOTENCY_RACE");
    }
    throw new Error(`APPLY_LOG_INSERT_FAILED: ${error.message}`);
  }
  return { id: String(data?.id ?? "") };
}

export type AiRecommendationApplyResult = {
  ok: true;
  action: string;
  summary: string;
  detail: Record<string, unknown>;
  dry_run?: boolean;
  snapshot_before?: GovernanceSnapshotV1;
  snapshot_after?: GovernanceSnapshotV1 | null;
  inverse?: InverseSpec | null;
  history_id?: string;
  idempotent_replay?: boolean;
  confirmation_required?: boolean;
  /** Set on every successful apply path for audit / historikk. */
  execution_source?: "auto" | "manual";
  /** Present when execution_source === "auto" (trusted cron / motor only). */
  auto_rule?: string | null;
};

async function executeRollback(params: {
  historyId: string;
  dryRun: boolean;
  confirmed: boolean;
  actorUserId: string | null;
  actorEmail: string | null;
  rid: string;
  recommendation_id: string | null;
  idempotency_key: string | null;
}): Promise<AiRecommendationApplyResult> {
  if (!isUuid(params.historyId)) throw new Error("INVALID_HISTORY_ID");
  if (requiresConfirmationForAction("rollback_governance_apply") && !params.confirmed && !params.dryRun) {
    return {
      ok: true,
      action: "rollback_governance_apply",
      summary: "Bekreftelse kreves for rollback.",
      detail: { history_id: params.historyId },
      dry_run: false,
      confirmation_required: true,
    };
  }

  const { data: row, error } = await supabaseAdmin()
    .from("ai_governance_apply_log")
    .select("id, dry_run, rolled_back_at, snapshot_before, action, payload")
    .eq("id", params.historyId)
    .maybeSingle();

  if (error || !row) throw new Error("HISTORY_NOT_FOUND");
  if (row.dry_run) throw new Error("ROLLBACK_NOT_ALLOWED_FOR_DRY_RUN");
  if (row.rolled_back_at) throw new Error("ALREADY_ROLLED_BACK");

  const snap = row.snapshot_before as GovernanceSnapshotV1;
  if (!snap || typeof snap !== "object") throw new Error("INVALID_SNAPSHOT");

  if (params.dryRun) {
    const result: AiRecommendationApplyResult = {
      ok: true,
      action: "rollback_governance_apply",
      summary: "Simulering: tilstand ville blitt gjenopprettet fra snapshot_before.",
      detail: { history_id: params.historyId, parent_action: row.action },
      dry_run: true,
      snapshot_before: snap,
    };
    await insertApplyLog({
      idempotency_key: null,
      user_id: params.actorUserId,
      actor_email: params.actorEmail,
      rid: params.rid,
      recommendation_id: params.recommendation_id,
      action: "rollback_governance_apply",
      payload: { history_id: params.historyId },
      dry_run: true,
      snapshot_before: snap,
      snapshot_after: null,
      inverse_action: null,
      inverse_payload: null,
      result: result as unknown as Record<string, unknown>,
      rollback_of_id: params.historyId,
    });
    scheduleAuditEvent({
      companyId: null,
      userId: params.actorUserId,
      action: "ai_recommendation_apply",
      resource: "ai_recommendation",
      metadata: {
        ok: true,
        dry_run: true,
        rollback_of: params.historyId,
        rid: params.rid,
      },
    });
    return result;
  }

  await restoreSnapshot(snap);

  const { error: upErr } = await supabaseAdmin()
    .from("ai_governance_apply_log")
    .update({ rolled_back_at: new Date().toISOString() })
    .eq("id", params.historyId);
  if (upErr) throw new Error(`ROLLBACK_MARK_FAILED: ${upErr.message}`);

  const out: AiRecommendationApplyResult = {
    ok: true,
    action: "rollback_governance_apply",
    summary: "Rollback utført: snapshot_before gjenopprettet.",
    detail: { history_id: params.historyId, parent_action: row.action },
  };

  await insertApplyLog({
    idempotency_key: params.idempotency_key,
    user_id: params.actorUserId,
    actor_email: params.actorEmail,
    rid: params.rid,
    recommendation_id: params.recommendation_id,
    action: "rollback_governance_apply",
    payload: { history_id: params.historyId },
    dry_run: false,
    snapshot_before: snap,
    snapshot_after: cloneSnap(snap),
    inverse_action: null,
    inverse_payload: null,
    result: out as unknown as Record<string, unknown>,
    rollback_of_id: params.historyId,
  });

  scheduleAuditEvent({
    companyId: null,
    userId: params.actorUserId,
    action: "ai_recommendation_apply",
    resource: "ai_recommendation",
    metadata: {
      ok: true,
      rollback_of: params.historyId,
      rid: params.rid,
      summary: out.summary,
    },
  });

  return out;
}

async function runGovernanceApply(params: {
  req: AiGovernanceMutationRequest;
  actorUserId: string | null;
  actorEmail: string | null;
  rid: string;
  trustAutoExecution: boolean;
  auto_rule: string | null;
}): Promise<AiRecommendationApplyResult> {
  const { req, actorUserId, actorEmail, rid, trustAutoExecution, auto_rule } = params;
  const { action, payload, recommendation_id, dry_run = false, confirmed = false, idempotency_key } = req;

  const auditBase = {
    recommendation_id: recommendation_id ?? null,
    action,
    payload,
    rid,
    actor_email: actorEmail,
    dry_run,
    execution_source: trustAutoExecution ? ("auto" as const) : ("manual" as const),
    auto_rule: trustAutoExecution ? auto_rule : null,
  };

  if (idempotency_key && !dry_run) {
    const existing = await fetchIdempotentResult(idempotency_key, action, payload);
    if (existing && existing.ok === true) {
      return {
        ...(existing as unknown as AiRecommendationApplyResult),
        idempotent_replay: true,
      };
    }
  }

  const autoBypass =
    trustAutoExecution &&
    (action === "downgrade_company_model_tier" || action === "throttle_tool_platform");

  if (requiresConfirmationForAction(action) && !confirmed && !dry_run && !autoBypass) {
    const snapshot_before = await captureRelevantState(action, payload);
    const inverse = computeInverse(action, payload, snapshot_before);
    const snapshot_after = simulateAfterSnapshot(snapshot_before, action, payload);
    return {
      ok: true,
      action,
      summary: "Bekreftelse kreves før denne endringen utføres.",
      detail: { action },
      confirmation_required: true,
      snapshot_before,
      snapshot_after,
      inverse,
      execution_source: "manual",
      auto_rule: null,
    };
  }

  const snapshot_before = await captureRelevantState(action, payload);
  const inverse = computeInverse(action, payload, snapshot_before);
  const snapshot_after_preview = simulateAfterSnapshot(snapshot_before, action, payload);

  const mutation = await performMutation(action, payload, dry_run);

  let snapshot_after: GovernanceSnapshotV1 | null = null;
  if (!dry_run) {
    snapshot_after = await captureRelevantState(action, payload);
  }

  const baseResult: AiRecommendationApplyResult = {
    ok: true,
    action,
    summary: mutation.summary,
    detail: mutation.detail,
    dry_run,
    snapshot_before,
    snapshot_after: dry_run ? snapshot_after_preview : snapshot_after,
    inverse,
    execution_source: trustAutoExecution ? "auto" : "manual",
    auto_rule: trustAutoExecution ? auto_rule : null,
  };

  const resultForStore = { ...baseResult } as unknown as Record<string, unknown>;

  try {
    const { id } = await insertApplyLog({
      idempotency_key: dry_run ? null : idempotency_key ?? null,
      user_id: actorUserId,
      actor_email: actorEmail,
      rid,
      recommendation_id: recommendation_id ?? null,
      action,
      payload,
      dry_run,
      snapshot_before,
      snapshot_after: dry_run ? null : snapshot_after,
      inverse_action: inverse?.action ?? null,
      inverse_payload: inverse?.payload ?? null,
      result: resultForStore,
      rollback_of_id: null,
    });
    baseResult.history_id = id;
  } catch (e) {
    if (e instanceof Error && e.message === "IDEMPOTENCY_RACE" && idempotency_key) {
      const existing = await fetchIdempotentResult(idempotency_key, action, payload);
      if (existing && existing.ok === true) {
        return { ...(existing as unknown as AiRecommendationApplyResult), idempotent_replay: true };
      }
    }
    throw e;
  }

  scheduleAuditEvent({
    companyId: (mutation.detail.company_id as string) || null,
    userId: actorUserId,
    action: "ai_recommendation_apply",
    resource: "ai_recommendation",
    metadata: {
      ...auditBase,
      ok: true,
      summary: mutation.summary,
      detail: mutation.detail,
      history_id: baseResult.history_id,
    },
  });

  return baseResult;
}

export async function executeAiRecommendationApply(params: {
  req: AiRecommendationApplyRequest;
  actorUserId: string | null;
  actorEmail: string | null;
  rid: string;
}): Promise<AiRecommendationApplyResult> {
  const { req, actorUserId, actorEmail, rid } = params;
  const { action, payload, recommendation_id, dry_run = false, confirmed = false, idempotency_key } = req;

  if (action === "rollback_governance_apply") {
    const hid = typeof payload.history_id === "string" ? payload.history_id.trim() : "";
    return executeRollback({
      historyId: hid,
      dryRun: dry_run,
      confirmed,
      actorUserId,
      actorEmail,
      rid,
      recommendation_id: recommendation_id ?? null,
      idempotency_key: idempotency_key ?? null,
    });
  }

  return runGovernanceApply({
    req: req as AiGovernanceMutationRequest,
    actorUserId,
    actorEmail,
    rid,
    trustAutoExecution: false,
    auto_rule: null,
  });
}

/**
 * Server-only trusted auto-execution (cron / internal motor). Never trust client claims of "auto".
 * Only low-impact actions: model downgrade + platform tool throttle.
 */
export async function executeAiRecommendationApplyTrustedAuto(params: {
  req: AiGovernanceMutationRequest;
  rid: string;
  auto_rule: string;
}): Promise<AiRecommendationApplyResult> {
  const act = params.req.action;
  if (act !== "downgrade_company_model_tier" && act !== "throttle_tool_platform") {
    throw new Error("TRUSTED_AUTO_ACTION_FORBIDDEN");
  }
  return runGovernanceApply({
    req: params.req,
    actorUserId: null,
    actorEmail: "auto-executor@system.internal",
    rid: params.rid,
    trustAutoExecution: true,
    auto_rule: params.auto_rule,
  });
}

export function listApplyOptionsForRecommendation(r: AiDashboardRecommendation): AiRecommendationApplyOption[] {
  const cid = r.refs?.company_id;
  const tool = r.refs?.tool;

  const flag = (a: AiRecommendationApplyAction): boolean => requiresConfirmationForAction(a);

  switch (r.kind) {
    case "downgrade_model":
      if (!cid || !isUuid(cid)) return [];
      return [
        {
          option_id: `${r.id}-economy`,
          label: "Tving economy-modell",
          action: "downgrade_company_model_tier",
          payload: { company_id: cid },
          requires_confirmation: flag("downgrade_company_model_tier"),
        },
        {
          option_id: `${r.id}-restore`,
          label: "Tilbakestill modellnivå",
          action: "restore_company_model_tier",
          payload: { company_id: cid },
          requires_confirmation: flag("restore_company_model_tier"),
        },
      ];
    case "block_tool":
      if (!tool) return [];
      if (cid && isUuid(cid)) {
        return [
          {
            option_id: `${r.id}-block-co`,
            label: "Blokker for selskap",
            action: "block_tool",
            payload: { tool, scope: "company", company_id: cid },
            requires_confirmation: flag("block_tool"),
          },
          {
            option_id: `${r.id}-unblock-co`,
            label: "Fjern selskapsblokkering",
            action: "unblock_tool",
            payload: { tool, scope: "company", company_id: cid },
            requires_confirmation: flag("unblock_tool"),
          },
          {
            option_id: `${r.id}-throttle-plat`,
            label: "Strup verktøy på plattform (midlertidig)",
            action: "throttle_tool_platform",
            payload: { tool, duration_hours: 24 },
            requires_confirmation: flag("throttle_tool_platform"),
          },
          {
            option_id: `${r.id}-unthrottle-plat`,
            label: "Fjern plattform-struping",
            action: "unthrottle_tool_platform",
            payload: { tool },
            requires_confirmation: flag("unthrottle_tool_platform"),
          },
        ];
      }
      return [
        {
          option_id: `${r.id}-block-plat`,
          label: "Blokker på plattform",
          action: "block_tool",
          payload: { tool, scope: "platform" },
          requires_confirmation: flag("block_tool"),
        },
        {
          option_id: `${r.id}-unblock-plat`,
          label: "Fjern plattformblokkering",
          action: "unblock_tool",
          payload: { tool, scope: "platform" },
          requires_confirmation: flag("unblock_tool"),
        },
        {
          option_id: `${r.id}-throttle-plat`,
          label: "Strup verktøy på plattform (midlertidig)",
          action: "throttle_tool_platform",
          payload: { tool, duration_hours: 24 },
          requires_confirmation: flag("throttle_tool_platform"),
        },
        {
          option_id: `${r.id}-unthrottle-plat`,
          label: "Fjern plattform-struping",
          action: "unthrottle_tool_platform",
          payload: { tool },
          requires_confirmation: flag("unthrottle_tool_platform"),
        },
      ];
    case "billing_flag_followup":
      if (!cid || !isUuid(cid)) return [];
      return [
        {
          option_id: `${r.id}-flag`,
          label: "Sett / oppdater flagg",
          action: "set_company_billing_flag",
          payload: { company_id: cid, reason: r.refs?.company_name ? `MANUAL:${r.refs.company_name}` : "MANUAL_REVIEW" },
          requires_confirmation: flag("set_company_billing_flag"),
        },
        {
          option_id: `${r.id}-unflag`,
          label: "Fjern flagg",
          action: "clear_company_billing_flag",
          payload: { company_id: cid },
          requires_confirmation: flag("clear_company_billing_flag"),
        },
      ];
    case "upsell_plan":
      if (!cid || !isUuid(cid)) return [];
      return [
        {
          option_id: `${r.id}-note`,
          label: "Logg oppsalg/notat",
          action: "set_company_policy_note",
          payload: { company_id: cid, note: `Oppsalg vurdert (${r.id})` },
          requires_confirmation: flag("set_company_policy_note"),
        },
      ];
    case "margin_risk":
      return [
        {
          option_id: `${r.id}-plat-note`,
          label: "Logg plattform-tiltak",
          action: "set_platform_policy_note",
          payload: { note: `Marginrisiko notert (${r.id}): ${r.title}` },
          requires_confirmation: flag("set_platform_policy_note"),
        },
      ];
    case "revenue_config":
      return [
        {
          option_id: `${r.id}-plat-note`,
          label: "Logg oppfølging MRR-oppsett",
          action: "set_platform_policy_note",
          payload: { note: `MRR-miljø må konfigureres (${r.id})` },
          requires_confirmation: flag("set_platform_policy_note"),
        },
      ];
    default:
      return [];
  }
}
