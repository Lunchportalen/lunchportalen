import "server-only";

import { getPlanListMrrUsd } from "@/lib/ai/billing";
import { getCompanySaasPlanForAi } from "@/lib/ai/entitlements";
import {
  aggregateCompanyAiRunnerUsage,
  getAiUsageLimitsForPlan,
  resolveUtcMonthBounds,
} from "@/lib/ai/usage";
import {
  estimateMaxUsdChatCompletion,
  estimateMaxUsdDalle3Standard1024,
  estimateMaxUsdOpenAiImagesPassthrough,
  FALLBACK_CHAT_MODEL_ID,
  isGpt4oClassDowngradable,
} from "@/lib/ai/pricing";
import { getToolPolicy } from "@/lib/ai/tools/registry";

function trimEnv(k: string): string {
  return String(process.env[k] ?? "").trim();
}

/**
 * When true (default): before each runAi call, projected max $ vs remaining plan margin + included budget;
 * may downgrade gpt-4o* → gpt-4o-mini or block with PROFITABILITY_BLOCK.
 */
export function profitabilityGateEnabled(): boolean {
  const v = trimEnv("AI_PROFITABILITY_ENABLED").toLowerCase();
  if (v === "false" || v === "0" || v === "off") return false;
  return true;
}

export type RunProfitabilityContext = {
  company_id: string;
  plan: string;
  mtd_cost_usd: number;
  list_mrr_usd: number | null;
  included_budget_usd: number | null;
  /** Additional spend allowed this month before crossing the tighter of budget / MRR margin; null = no numeric cap */
  allowed_additional_usd: number | null;
};

export async function loadRunProfitabilityContext(companyId: string): Promise<RunProfitabilityContext> {
  const id = typeof companyId === "string" ? companyId.trim() : "";
  if (!id) throw new Error("MISSING_COMPANY_ID");

  const period = resolveUtcMonthBounds(null);
  const aggregate = await aggregateCompanyAiRunnerUsage(id, period);
  const plan = await getCompanySaasPlanForAi(id);
  const limits = getAiUsageLimitsForPlan(plan);
  const listMrr = getPlanListMrrUsd(plan);
  const mtd = aggregate.cost_estimate_usd;
  const included = limits.maxCostUsdPerMonth;

  const rooms: number[] = [];
  if (included != null && Number.isFinite(included)) {
    rooms.push(Math.max(0, included - mtd));
  }
  if (listMrr != null && Number.isFinite(listMrr)) {
    rooms.push(Math.max(0, listMrr - mtd));
  }
  const allowed = rooms.length === 0 ? null : Math.min(...rooms);

  return {
    company_id: id,
    plan,
    mtd_cost_usd: mtd,
    list_mrr_usd: listMrr,
    included_budget_usd: included,
    allowed_additional_usd: allowed,
  };
}

/** Mirror lib/ai/runner.ts (avoid circular import). */
const RUNNER_TOOL = {
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
  CMS_STRUCTURED_JSON: "cms.ai.structured_json",
} as const;

const SUGGEST_JSON_SYSTEM_CHARS = 520;
const EDITOR_SYSTEM_CHARS = 380;
const CTA_SYSTEM_CHARS = 420;

/**
 * Upper-bound USD for a single runner call (worst-case completion to max_tokens).
 */
export function estimateProjectedMaxUsdForRunnerTool(params: {
  tool: string;
  input: Record<string, unknown>;
  modelId: string;
}): number {
  const { tool, input, modelId } = params;

  if (getToolPolicy(tool)) {
    const userChars =
      SUGGEST_JSON_SYSTEM_CHARS +
      80 +
      String(tool).length +
      JSON.stringify(input ?? {}).length;
    return estimateMaxUsdChatCompletion({
      modelId,
      promptChars: userChars,
      maxCompletionTokens: 4096,
    });
  }

  if (tool === RUNNER_TOOL.EDITOR_TEXT) {
    const text = typeof input.text === "string" ? input.text : "";
    const userChars = EDITOR_SYSTEM_CHARS + Math.min(text.length, 2000) + 40;
    return estimateMaxUsdChatCompletion({
      modelId,
      promptChars: userChars,
      maxCompletionTokens: 1024,
    });
  }

  if (tool === RUNNER_TOOL.EDITOR_CTA) {
    const t = typeof input.title === "string" ? input.title : "";
    const b = typeof input.body === "string" ? input.body : "";
    const userChars = CTA_SYSTEM_CHARS + t.length + b.length + 400;
    return estimateMaxUsdChatCompletion({
      modelId,
      promptChars: userChars,
      maxCompletionTokens: 1024,
    });
  }

  if (tool === RUNNER_TOOL.BLOCK_COPY) {
    const system = typeof input.system === "string" ? input.system : "";
    const user = typeof input.user === "string" ? input.user : "";
    const maxTok = typeof input.max_tokens === "number" ? input.max_tokens : 2048;
    return estimateMaxUsdChatCompletion({
      modelId,
      promptChars: system.length + user.length + 24,
      maxCompletionTokens: maxTok,
    });
  }

  const chatJsonTools = new Set<string>([
    RUNNER_TOOL.LAYOUT_CMS,
    RUNNER_TOOL.PAGE_CMS,
    RUNNER_TOOL.GEN_SECTION,
    RUNNER_TOOL.GEN_FULL_PAGE,
    RUNNER_TOOL.VARIANTS_PROPOSE,
    RUNNER_TOOL.CMS_STRUCTURED_JSON,
  ]);

  if (chatJsonTools.has(tool)) {
    const system = typeof input.system === "string" ? input.system : "";
    const user = typeof input.user === "string" ? input.user : "";
    const maxTok = typeof input.max_tokens === "number" ? input.max_tokens : 4096;
    return estimateMaxUsdChatCompletion({
      modelId,
      promptChars: system.length + Math.min(user.length, 14_000) + 16,
      maxCompletionTokens: maxTok,
    });
  }

  if (tool === RUNNER_TOOL.IMAGE_DALLE_PREVIEW) {
    return estimateMaxUsdDalle3Standard1024();
  }

  if (tool === RUNNER_TOOL.OPENAI_IMAGES) {
    return estimateMaxUsdOpenAiImagesPassthrough();
  }

  return estimateMaxUsdChatCompletion({
    modelId,
    promptChars: 2000,
    maxCompletionTokens: 2048,
  });
}

export type ProfitabilityModelPick =
  | {
      ok: true;
      model_id: string;
      model_downgraded: boolean;
      projected_max_primary_usd: number;
      projected_max_effective_usd: number;
      allowed_additional_usd: number | null;
    }
  | {
      ok: false;
      projected_max_primary_usd: number;
      projected_max_fallback_usd: number | null;
      allowed_additional_usd: number | null;
      message: string;
    };

/**
 * Choose chat model: stay on configured model, or downgrade gpt-4o → gpt-4o-mini, or block if both exceed cap.
 * Non-chat tools (images) cannot downgrade — block when over cap.
 */
export function pickModelForProfitability(params: {
  tool: string;
  input: Record<string, unknown>;
  configuredModelId: string;
  allowedAdditionalUsd: number | null;
}): ProfitabilityModelPick {
  const { tool, input, configuredModelId, allowedAdditionalUsd } = params;
  const primary = configuredModelId;

  const projPrimary = estimateProjectedMaxUsdForRunnerTool({
    tool,
    input,
    modelId: primary,
  });

  if (allowedAdditionalUsd == null) {
    return {
      ok: true,
      model_id: primary,
      model_downgraded: false,
      projected_max_primary_usd: projPrimary,
      projected_max_effective_usd: projPrimary,
      allowed_additional_usd: null,
    };
  }

  if (projPrimary <= allowedAdditionalUsd) {
    return {
      ok: true,
      model_id: primary,
      model_downgraded: false,
      projected_max_primary_usd: projPrimary,
      projected_max_effective_usd: projPrimary,
      allowed_additional_usd: allowedAdditionalUsd,
    };
  }

  if (isGpt4oClassDowngradable(primary)) {
    const projMini = estimateProjectedMaxUsdForRunnerTool({
      tool,
      input,
      modelId: FALLBACK_CHAT_MODEL_ID,
    });
    if (projMini <= allowedAdditionalUsd) {
      return {
        ok: true,
        model_id: FALLBACK_CHAT_MODEL_ID,
        model_downgraded: true,
        projected_max_primary_usd: projPrimary,
        projected_max_effective_usd: projMini,
        allowed_additional_usd: allowedAdditionalUsd,
      };
    }
    return {
      ok: false,
      projected_max_primary_usd: projPrimary,
      projected_max_fallback_usd: projMini,
      allowed_additional_usd: allowedAdditionalUsd,
      message: "PROFITABILITY_BLOCK: projected cost exceeds plan margin and company budget even with model fallback",
    };
  }

  return {
    ok: false,
    projected_max_primary_usd: projPrimary,
    projected_max_fallback_usd: null,
    allowed_additional_usd: allowedAdditionalUsd,
    message: "PROFITABILITY_BLOCK: projected cost exceeds plan margin and company budget (no chat fallback)",
  };
}
