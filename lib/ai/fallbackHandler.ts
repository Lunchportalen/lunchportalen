/**
 * AI fallback handler: deterministic fallback when AI fails.
 * Returns safe, schema-consistent data so callers can respond without leaking errors or leaving UI broken.
 * No external calls; no LLM.
 */

import { AI_TOOL_IDS, type ToolId } from "./tools/registry";

export type AiFallbackResult = {
  ok: true;
  data: Record<string, unknown>;
  fallback: true;
  message: string;
};

/** Empty AIPatchV1 shape for tools that return patch. */
const EMPTY_PATCH = { version: 1 as const, ops: [] };

/**
 * Returns a deterministic fallback result for the given tool when AI fails.
 * Use after suggestJSON (or equivalent) returns ok: false — return this as 200 with fallback: true so client gets valid data.
 * Returns null for unknown tools (caller should return error response).
 */
export function getAiFallback(
  tool: string,
  _input?: Record<string, unknown>
): AiFallbackResult | null {
  const t = tool.trim();
  const locale = typeof _input?.locale === "string" && _input.locale === "en" ? "en" : "nb";
  const summary =
    locale === "en"
      ? "AI is temporarily unavailable. No changes applied."
      : "AI er midlertidig utilgjengelig. Ingen endringer brukt.";
  const message =
    locale === "en"
      ? "Deterministic fallback (AI failed)."
      : "Deterministisk fallback (AI feilet).";

  if (!AI_TOOL_IDS.includes(t as ToolId)) {
    return null;
  }

  switch (t as ToolId) {
    case "landing.generate.sections":
      return {
        ok: true,
        data: { summary, patch: EMPTY_PATCH },
        fallback: true,
        message,
      };
    case "i18n.translate.blocks":
      return {
        ok: true,
        data: { summary, patch: EMPTY_PATCH, stats: { translated: 0, skipped: 0 } },
        fallback: true,
        message,
      };
    case "seo.optimize.page":
      return {
        ok: true,
        data: { summary, patch: EMPTY_PATCH, metaSuggestion: {} },
        fallback: true,
        message,
      };
    case "content.maintain.page":
      return {
        ok: true,
        data: { summary, patch: EMPTY_PATCH, metaSuggestion: {}, issues: [] },
        fallback: true,
        message,
      };
    case "experiment.generate.variants":
      return {
        ok: true,
        data: { summary, patch: EMPTY_PATCH, variants: [] },
        fallback: true,
        message,
      };
    case "image.generate.brand_safe":
      return {
        ok: true,
        data: { summary, prompts: [] },
        fallback: true,
        message,
      };
    case "image.improve.metadata":
      return {
        ok: true,
        data: { summary },
        fallback: true,
        message,
      };
    default:
      return null;
  }
}

/**
 * Wraps an async AI call: on failure, returns deterministic fallback when available.
 * Use when you want "try AI, else fallback" in one place.
 *
 * @param tool - Tool ID (must be in AI_TOOL_IDS for fallback to apply).
 * @param input - Optional input for context.
 * @param run - Async function that returns the same shape as suggest (ok: true with data, or ok: false with error).
 * @returns Either the successful result, or { ok: true, data, fallback: true, message } when run failed and fallback exists.
 */
export async function withAiFallback<T extends { ok: true; data: Record<string, unknown> } | { ok: false; error: string }>(
  tool: string,
  input: Record<string, unknown> | undefined,
  run: () => Promise<T>
): Promise<T | AiFallbackResult> {
  const result = await run();
  if (result.ok) return result;
  const fallback = getAiFallback(tool, input);
  if (fallback) return fallback;
  return result;
}
