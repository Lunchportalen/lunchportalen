import "server-only";
import { AiRunnerError, AI_RUNNER_TOOL, runAi } from "@/lib/ai/runner";

/**
 * Editor AI service boundary: single text suggestion for the editor workflow.
 * - No DB reads/writes. No content mutation. Suggestion only.
 * - Caller (route) is responsible for auth, validation, and length limits.
 * - Input must be pre-validated (e.g. text length-clamped, action allowlisted).
 */

export const EDITOR_TEXT_ACTION = ["improve", "shorten"] as const;
export type EditorTextAction = (typeof EDITOR_TEXT_ACTION)[number];

export type EditorTextSuggestInput = {
  /** Pre-validated text (caller must clamp length). */
  text: string;
  action: EditorTextAction;
  /** Optional locale for provider; defaults to "nb". */
  locale?: "nb" | "en";
};

export type EditorTextSuggestOutput = {
  suggestion: string;
};

/** Required for provider-backed editor inference (entitlements + ai_activity_log). */
export type EditorTextRunContext = {
  companyId: string;
  userId: string;
};

/**
 * Sync fallback: normalize/trim; shorten truncates. Used when provider fails or is disabled.
 */
export function editorTextSuggest(input: EditorTextSuggestInput): EditorTextSuggestOutput {
  const { text, action } = input;
  const normalized = text.trim().slice(0, 2000) || "—";
  if (action === "shorten") {
    const max = 120;
    if (normalized.length <= max) return { suggestion: normalized };
    return { suggestion: normalized.slice(0, max).trim() + "…" };
  }
  return { suggestion: normalized };
}

/**
 * Async: unified AI runner (policy, plan, logging); on soft provider failure use sync fallback.
 * Re-throws AiRunnerError for tenant/plan/policy failures (fail-closed).
 */
export async function editorTextSuggestAsync(
  input: EditorTextSuggestInput,
  ctx: EditorTextRunContext,
): Promise<EditorTextSuggestOutput> {
  const locale = input.locale === "en" ? "en" : "nb";
  try {
    const { result } = await runAi({
      companyId: ctx.companyId,
      userId: ctx.userId,
      tool: AI_RUNNER_TOOL.EDITOR_TEXT,
      input: { text: input.text.trim().slice(0, 2000) || "—", action: input.action },
      metadata: { locale },
    });
    if (typeof result === "string" && result.trim()) {
      return { suggestion: result.trim() };
    }
  } catch (e) {
    if (
      e instanceof AiRunnerError &&
      [
        "PLAN_NOT_ALLOWED",
        "POLICY_DENIED",
        "MISSING_COMPANY_ID",
        "MISSING_USER_ID",
        "ENTITLEMENTS_FAILED",
        "USAGE_LIMIT_EXCEEDED",
        "PROFITABILITY_BLOCK",
        "PROFITABILITY_CONTEXT_FAILED",
      ].includes(e.code)
    ) {
      throw e;
    }
  }
  return editorTextSuggest(input);
}
