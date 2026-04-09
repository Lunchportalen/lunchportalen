import "server-only";

import { randomUUID } from "crypto";
import type { DecisionResult } from "@/lib/ai/decisionEngine";
import {
  isWithinAiDecisionEntrypoint,
  warnAiDecisionEntryBypass,
  withAiDecisionEntrypoint,
} from "@/lib/ai/aiEntrypointContext";
import { recordRunAiInvocation, recordRunAiStrictRejection } from "@/lib/system/controlPlaneMetrics";
import { isStrictAi } from "@/lib/system/controlStrict";
import { estimateUsdForTokens, FALLBACK_CHAT_MODEL_ID, resolveConfiguredOpenAiChatModelId } from "@/lib/ai/pricing";
import {
  loadRunProfitabilityContext,
  pickModelForProfitability,
  profitabilityGateEnabled,
  type ProfitabilityModelPick,
  type RunProfitabilityContext,
} from "@/lib/ai/profitability";
import { assertCompanyAiEligibleForRun } from "@/lib/ai/usage";
import { evaluatePolicy } from "@/lib/ai/policyEngine";
import _internal from "./_internalProvider";
import { getToolPolicy } from "@/lib/ai/tools/registry";
import { isoNow } from "@/lib/http/rid";
import {
  activePlatformThrottleForTool,
  loadMergedGovernanceForRun,
  isToolBlockedByGovernance,
} from "@/lib/ai/runnerGovernance";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { logEvent } from "@/lib/observability/eventLogger";

export class AiRunnerError extends Error {
  readonly code: string;
  readonly rid: string;

  constructor(code: string, message: string, rid: string) {
    super(message);
    this.name = "AiRunnerError";
    this.code = code;
    this.rid = rid;
  }
}

/** Canonical tool ids for non-registry inference (runner dispatch only). */
export const AI_RUNNER_TOOL = {
  EDITOR_TEXT: "backoffice.editor.text_improve",
  EDITOR_CTA: "backoffice.editor.cta_improve",
  BLOCK_COPY: "ai.block.copy",
  LAYOUT_CMS: "ai.layout.cms_blocks",
  PAGE_CMS: "ai.page.cms_draft",
  GEN_SECTION: "ai.generator.section",
  GEN_FULL_PAGE: "ai.generator.full_page",
  IMAGE_DALLE_PREVIEW: "ai.image.dalle_preview",
  OPENAI_IMAGES: "ai.openai.images_generations",
  VARIANTS_PROPOSE: "ai.variants.propose",
  /** Structured JSON for CMS menu / week templates — editor-only; no auto-apply. */
  CMS_STRUCTURED_JSON: "cms.ai.structured_json",
} as const;

const STATIC_RUNNER_TOOLS = new Set<string>(Object.values(AI_RUNNER_TOOL));

function assertToolPolicyGate(tool: string): void {
  if (getToolPolicy(tool)) return;
  if (STATIC_RUNNER_TOOLS.has(tool)) return;
  throw new Error(`POLICY_TOOL_DENIED: ${tool}`);
}

function coercePolicyDecision(v: unknown): DecisionResult | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Partial<DecisionResult>;
  if (typeof o.decisionType !== "string") return null;
  return o as DecisionResult;
}

async function insertRunnerLog(params: {
  rid: string;
  tool: string;
  companyId: string;
  userId: string;
  status: "success" | "error";
  durationMs: number;
  errorCode?: string;
  toolMeta?: Record<string, unknown>;
}): Promise<void> {
  const { error } = await supabaseAdmin()
    .from("ai_activity_log")
    .insert({
      action: "batch",
      entity_type: "system",
      entity_id: params.companyId,
      page_id: null,
      variant_id: null,
      actor_user_id: params.userId,
      rid: params.rid,
      status: params.status,
      duration_ms: params.durationMs,
      metadata: {
        tool: params.tool,
        company_id: params.companyId,
        user_id: params.userId,
        timestamp: isoNow(),
        ...(params.errorCode ? { error_code: params.errorCode } : {}),
        ...(params.toolMeta && typeof params.toolMeta === "object" ? params.toolMeta : {}),
      },
    } as Record<string, unknown>);

  if (error) {
    throw new AiRunnerError("AI_ACTIVITY_LOG_FAILED", error.message, params.rid);
  }
}

async function executeProvider(
  tool: string,
  input: Record<string, unknown>,
  metadata: Record<string, unknown> | undefined,
  modelOverride?: string,
): Promise<{ result: unknown; usage?: { promptTokens: number; completionTokens: number }; model?: string }> {
  const locale = metadata?.locale === "en" ? "en" : "nb";

  if (getToolPolicy(tool)) {
    const out = await _internal.suggestJSON({
      tool,
      locale,
      input,
      ...(modelOverride ? { model: modelOverride } : {}),
    });
    if (!out.ok) throw new Error(out.error);
    return { result: out.data, usage: out.usage, model: out.model };
  }

  if (tool === AI_RUNNER_TOOL.EDITOR_TEXT) {
    const text = typeof input.text === "string" ? input.text : "";
    const action = input.action === "shorten" ? ("shorten" as const) : ("improve" as const);
    const out = await _internal.suggestEditorText({
      text,
      action,
      locale,
      ...(modelOverride ? { model: modelOverride } : {}),
    });
    if (out.ok !== true) throw new Error("error" in out ? out.error : "PROVIDER_ERROR");
    return { result: out.suggestion };
  }

  if (tool === AI_RUNNER_TOOL.EDITOR_CTA) {
    const out = await _internal.suggestCtaImprove({
      title: typeof input.title === "string" ? input.title : "",
      body: typeof input.body === "string" ? input.body : undefined,
      buttonLabel: typeof input.buttonLabel === "string" ? input.buttonLabel : undefined,
      buttonHref: typeof input.buttonHref === "string" ? input.buttonHref : undefined,
      action: typeof input.action === "string" ? input.action : "improve",
      locale,
    });
    if (out.ok !== true) throw new Error("error" in out ? out.error : "PROVIDER_ERROR");
    return { result: out.suggestion };
  }

  if (tool === AI_RUNNER_TOOL.BLOCK_COPY) {
    const system = typeof input.system === "string" ? input.system : "";
    const user = typeof input.user === "string" ? input.user : "";
    if (!system || !user) throw new Error("INVALID_INPUT");
    const raw = await _internal.providerOpenAiChatRaw({
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      responseFormat: "text",
      temperature: typeof input.temperature === "number" ? input.temperature : 0.7,
      max_tokens: typeof input.max_tokens === "number" ? input.max_tokens : 2048,
      ...(modelOverride ? { model: modelOverride } : {}),
    });
    return { result: raw.text, usage: raw.usage, model: raw.model };
  }

  const chatJsonTools = new Set<string>([
    AI_RUNNER_TOOL.LAYOUT_CMS,
    AI_RUNNER_TOOL.PAGE_CMS,
    AI_RUNNER_TOOL.GEN_SECTION,
    AI_RUNNER_TOOL.GEN_FULL_PAGE,
    AI_RUNNER_TOOL.VARIANTS_PROPOSE,
    AI_RUNNER_TOOL.CMS_STRUCTURED_JSON,
  ]);

  if (chatJsonTools.has(tool)) {
    const system = typeof input.system === "string" ? input.system : "";
    const user = typeof input.user === "string" ? input.user : "";
    if (!system || !user) throw new Error("INVALID_INPUT");
    const defaultTemp =
      tool === AI_RUNNER_TOOL.CMS_STRUCTURED_JSON
        ? 0.25
        : tool === AI_RUNNER_TOOL.LAYOUT_CMS || tool === AI_RUNNER_TOOL.PAGE_CMS
          ? 0.55
          : tool === AI_RUNNER_TOOL.VARIANTS_PROPOSE
            ? 0.75
            : 0.65;
    const raw = await _internal.providerOpenAiChatRaw({
      messages: [
        { role: "system", content: system },
        { role: "user", content: user.slice(0, 14_000) },
      ],
      responseFormat: "json_object",
      temperature: typeof input.temperature === "number" ? input.temperature : defaultTemp,
      max_tokens: typeof input.max_tokens === "number" ? input.max_tokens : 4096,
      ...(modelOverride ? { model: modelOverride } : {}),
    });
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw.text) as unknown;
    } catch {
      throw new Error("INVALID_JSON");
    }
    return { result: parsed, usage: raw.usage, model: raw.model };
  }

  if (tool === AI_RUNNER_TOOL.IMAGE_DALLE_PREVIEW) {
    const prompt = typeof input.prompt === "string" ? input.prompt.trim() : "";
    if (!prompt) throw new Error("INVALID_INPUT");
    const img = await _internal.providerOpenAiImagesGenerations({
      model: "dall-e-3",
      prompt: prompt.slice(0, 4000),
      n: 1,
      size: "1024x1024",
      quality: "standard",
      response_format: "url",
    });
    return { result: img };
  }

  if (tool === AI_RUNNER_TOOL.OPENAI_IMAGES) {
    const openaiBody = input.openaiBody;
    if (!openaiBody || typeof openaiBody !== "object" || Array.isArray(openaiBody)) throw new Error("INVALID_INPUT");
    const img = await _internal.providerOpenAiImagesGenerations(openaiBody as Record<string, unknown>);
    return { result: img };
  }

  throw new Error(`UNSUPPORTED_TOOL: ${tool}`);
}

export type RunAiArgs = {
  companyId: string;
  userId: string;
  tool: string;
  input: Record<string, unknown>;
  metadata?: Record<string, unknown>;
};

export type RunAiSuccess = {
  rid: string;
  result: unknown;
  usage?: { promptTokens: number; completionTokens: number };
  model?: string;
};

export async function runAi(args: RunAiArgs): Promise<RunAiSuccess> {
  const toolForEntry = typeof args.tool === "string" ? args.tool.trim() : "";
  const hadEntry = isWithinAiDecisionEntrypoint();

  if (!hadEntry && isStrictAi()) {
    const ridEarly = randomUUID();
    recordRunAiStrictRejection(toolForEntry || "unknown");
    throw new AiRunnerError(
      "AI_CONTROL_PLANE_BYPASS",
      "runAi må kjøre under withApiAiEntrypoint / withAiDecisionEntrypoint når STRICT_MODE, LP_STRICT_AI eller LP_STRICT_CONTROL er aktivert.",
      ridEarly,
    );
  }

  async function runAiImpl(): Promise<RunAiSuccess> {
  const rid = randomUUID();
  const t0 = Date.now();
  const tool = typeof args.tool === "string" ? args.tool.trim() : "";
  const companyId = typeof args.companyId === "string" ? args.companyId.trim() : "";
  const userId = typeof args.userId === "string" ? args.userId.trim() : "";

  const logError = async (code: string, message: string): Promise<void> => {
    const durationMs = Date.now() - t0;
    logEvent({
      type: "ai.runner",
      source: "lib/ai/runner.runAi",
      userId: userId || null,
      companyId: companyId || null,
      rid,
      status: "failure",
      durationMs,
      metadata: { tool: tool || "unknown", code, phase: "run" },
    });
    try {
      await insertRunnerLog({
        rid,
        tool: tool || "unknown",
        companyId: companyId || "unknown",
        userId: userId || "unknown",
        status: "error",
        durationMs,
        errorCode: code,
        toolMeta: { message: message.slice(0, 500) },
      });
    } catch {
      // secondary: do not mask primary error
    }
  };

  if (!companyId) {
    await logError("MISSING_COMPANY_ID", "companyId is required");
    throw new AiRunnerError("MISSING_COMPANY_ID", "companyId is required", rid);
  }
  if (!userId) {
    await logError("MISSING_USER_ID", "userId is required");
    throw new AiRunnerError("MISSING_USER_ID", "userId is required", rid);
  }
  if (!tool) {
    await logError("MISSING_TOOL", "tool is required");
    throw new AiRunnerError("MISSING_TOOL", "tool is required", rid);
  }

  logEvent({
    type: "ai.runner",
    source: "lib/ai/runner.runAi",
    userId,
    companyId,
    rid,
    status: "start",
    durationMs: 0,
    metadata: { tool, phase: "run" },
  });

  try {
    await assertCompanyAiEligibleForRun(companyId);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === "MISSING_COMPANY_ID" || msg.startsWith("MISSING_COMPANY_ID")) {
      await logError("MISSING_COMPANY_ID", msg);
      throw new AiRunnerError("MISSING_COMPANY_ID", msg, rid);
    }
    if (msg.includes("PLAN_NOT_ALLOWED")) {
      await logError("PLAN_NOT_ALLOWED", msg);
      throw new AiRunnerError("PLAN_NOT_ALLOWED", msg, rid);
    }
    if (msg.startsWith("USAGE_LIMIT_EXCEEDED")) {
      await logError("USAGE_LIMIT_EXCEEDED", msg);
      throw new AiRunnerError("USAGE_LIMIT_EXCEEDED", msg, rid);
    }
    await logError("ENTITLEMENTS_FAILED", msg);
    throw new AiRunnerError("ENTITLEMENTS_FAILED", msg, rid);
  }

  const decision = coercePolicyDecision(args.metadata?.policyDecision);
  if (decision) {
    const p = evaluatePolicy(decision);
    if (!p.allowed) {
      await logError("POLICY_DENIED", p.explain);
      throw new AiRunnerError("POLICY_DENIED", p.explain, rid);
    }
  }

  try {
    assertToolPolicyGate(tool);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await logError("POLICY_DENIED", msg);
    throw new AiRunnerError("POLICY_DENIED", msg, rid);
  }

  let mergedGovernance: Awaited<ReturnType<typeof loadMergedGovernanceForRun>>;
  try {
    mergedGovernance = await loadMergedGovernanceForRun(companyId);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await logError("GOVERNANCE_LOAD_FAILED", msg);
    throw new AiRunnerError("GOVERNANCE_LOAD_FAILED", msg, rid);
  }
  const govBlock = isToolBlockedByGovernance(mergedGovernance, tool);
  if (govBlock.blocked) {
    const explain = `Verktøy blokkert av governance (${govBlock.scope ?? "unknown"})`;
    await logError("GOVERNANCE_TOOL_BLOCKED", explain);
    throw new AiRunnerError("GOVERNANCE_TOOL_BLOCKED", explain, rid);
  }

  const th = activePlatformThrottleForTool(mergedGovernance.platform_throttled_tools, tool);
  if (th) {
    const explain = `Verktøy midlertidig strupet på plattform til ${th.until}`;
    await logError("GOVERNANCE_TOOL_THROTTLED", explain);
    throw new AiRunnerError("GOVERNANCE_TOOL_THROTTLED", explain, rid);
  }

  if (!_internal.isAIEnabled()) {
    await logError("AI_DISABLED", "AI provider is not configured");
    throw new AiRunnerError("AI_DISABLED", "AI provider is not configured", rid);
  }

  let profCtx: RunProfitabilityContext | null = null;
  let modelOverride: string | undefined;
  let profitabilityOk: Extract<ProfitabilityModelPick, { ok: true }> | null = null;

  if (profitabilityGateEnabled()) {
    try {
      profCtx = await loadRunProfitabilityContext(companyId);
      const cfg = _internal.getAiProviderConfig();
      let configured = resolveConfiguredOpenAiChatModelId(cfg.model);
      if (mergedGovernance.company.model_tier === "economy") {
        configured = FALLBACK_CHAT_MODEL_ID;
      }
      const pick = pickModelForProfitability({
        tool,
        input: args.input,
        configuredModelId: configured,
        allowedAdditionalUsd: profCtx.allowed_additional_usd,
      });
      if (pick.ok === false) {
        await logError("PROFITABILITY_BLOCK", pick.message);
        throw new AiRunnerError("PROFITABILITY_BLOCK", pick.message, rid);
      }
      profitabilityOk = pick;
      modelOverride = pick.model_downgraded ? pick.model_id : undefined;
    } catch (e) {
      if (e instanceof AiRunnerError) throw e;
      const msg = e instanceof Error ? e.message : String(e);
      await logError("PROFITABILITY_CONTEXT_FAILED", msg);
      throw new AiRunnerError("PROFITABILITY_CONTEXT_FAILED", msg, rid);
    }
  }

  if (mergedGovernance.company.model_tier === "economy") {
    modelOverride = modelOverride ?? FALLBACK_CHAT_MODEL_ID;
  }

  let execution: { result: unknown; usage?: { promptTokens: number; completionTokens: number }; model?: string };
  try {
    execution = await executeProvider(tool, args.input, args.metadata, modelOverride);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const code =
      msg === "AI_DISABLED"
        ? "AI_DISABLED"
        : msg.includes("INVALID")
          ? "INVALID_INPUT"
          : "PROVIDER_ERROR";
    await logError(code, msg);
    throw new AiRunnerError(code, msg, rid);
  }

  const durationMs = Date.now() - t0;

  const cfgExec = _internal.getAiProviderConfig();
  const configuredModel = resolveConfiguredOpenAiChatModelId(cfgExec.model);
  const effectiveModel =
    (typeof execution.model === "string" && execution.model.trim()) || modelOverride || configuredModel;
  const runCostUsd =
    execution.usage &&
    typeof execution.usage.promptTokens === "number" &&
    typeof execution.usage.completionTokens === "number"
      ? estimateUsdForTokens(
          execution.usage.promptTokens,
          execution.usage.completionTokens,
          effectiveModel,
        )
      : null;

  const profitabilityMeta: Record<string, unknown> = {};
  if (profCtx) {
    profitabilityMeta.mtd_cost_before_usd = Number(profCtx.mtd_cost_usd.toFixed(6));
    profitabilityMeta.list_mrr_usd = profCtx.list_mrr_usd;
    profitabilityMeta.included_budget_usd = profCtx.included_budget_usd;
  }
  if (profitabilityOk) {
    profitabilityMeta.projected_max_usd = Number(profitabilityOk.projected_max_effective_usd.toFixed(6));
    profitabilityMeta.allowed_additional_usd_before =
      profitabilityOk.allowed_additional_usd == null
        ? null
        : Number(profitabilityOk.allowed_additional_usd.toFixed(6));
    profitabilityMeta.model_downgraded = profitabilityOk.model_downgraded;
    profitabilityMeta.effective_model_id = effectiveModel;
  }
  if (runCostUsd != null) {
    profitabilityMeta.run_cost_usd_estimate = Number(runCostUsd.toFixed(6));
    if (profCtx?.list_mrr_usd != null && Number.isFinite(profCtx.list_mrr_usd)) {
      profitabilityMeta.margin_after_run_usd = Number(
        (profCtx.list_mrr_usd - profCtx.mtd_cost_usd - runCostUsd).toFixed(6),
      );
    }
  }

  await insertRunnerLog({
    rid,
    tool,
    companyId,
    userId,
    status: "success",
    durationMs,
    toolMeta: {
      model: execution.model,
      prompt_tokens: execution.usage?.promptTokens,
      completion_tokens: execution.usage?.completionTokens,
      profitability: profitabilityMeta,
    },
  });

  logEvent({
    type: "ai.runner",
    source: "lib/ai/runner.runAi",
    userId,
    companyId,
    rid,
    status: "success",
    durationMs,
    metadata: { tool, phase: "run", model: effectiveModel },
  });

  try {
    const { notifyPosAiUsage } = await import("@/lib/ai/orchestration");
    notifyPosAiUsage(companyId, tool);
  } catch {
    /* POS er valgfri — skal aldri påvirke runner */
  }

  return { rid, result: execution.result, usage: execution.usage, model: execution.model };
  }

  if (!hadEntry) {
    warnAiDecisionEntryBypass("runAi", { tool: toolForEntry || "unknown" });
    recordRunAiInvocation(false, true);
    return withAiDecisionEntrypoint(
      { surface: "lib/ai/runner", operation: toolForEntry || "unknown" },
      runAiImpl,
    );
  }

  recordRunAiInvocation(true, false);
  return runAiImpl();
}

/**
 * Tekstbasert OpenAI-kall for konverterings-/SoMe-utkast (uten full runAi policy-løype).
 * Brukes kun fra server routes med egen tilgangskontroll (f.eks. superadmin).
 */
export async function runOpenAiConversionChat(options: {
  userPrompt: string;
  temperature?: number;
}): Promise<{ ok: true; text: string; model: string } | { ok: false; error: string }> {
  try {
    const r = await _internal.providerOpenAiChatRaw({
      messages: [
        {
          role: "system",
          content:
            "Du er en norsk B2B-markedsføringsspesialist. Svar kun med innleggsteksten som beskrevet. Ingen kodeblokker, ingen JSON, ingen forklaring utenom selve innlegget.",
        },
        { role: "user", content: options.userPrompt },
      ],
      responseFormat: "text",
      temperature: typeof options.temperature === "number" ? options.temperature : 0.7,
      max_tokens: 1200,
    });
    return { ok: true, text: r.text, model: r.model };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg.slice(0, 200) };
  }
}

/** Public surface for routes/tests — OpenAI implementation lives in _internalProvider (runner-only import). */
export const AI_PROVIDER_ERROR = _internal.AI_PROVIDER_ERROR;
export const getAiProviderConfig = _internal.getAiProviderConfig;
export const isAIEnabled = _internal.isAIEnabled;
export const normalizeProviderResult = _internal.normalizeProviderResult;

/** Controlled self-driving cycle (log-only; see `lib/ai/autonomy/runner.ts`). */
export { runAutonomousCycle } from "./autonomy/runner";
