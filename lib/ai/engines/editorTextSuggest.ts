import "server-only";
import { suggestEditorText } from "@/lib/ai/provider";

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
 * Async: try real provider (clarity, tone, structure; preserve intent); on failure use sync fallback.
 * Returns editor-safe suggestion string.
 */
export async function editorTextSuggestAsync(
  input: EditorTextSuggestInput
): Promise<EditorTextSuggestOutput> {
  const locale = input.locale === "en" ? "en" : "nb";
  const result = await suggestEditorText({
    text: input.text.trim().slice(0, 2000) || "—",
    action: input.action,
    locale,
  });
  if (result.ok) return { suggestion: result.suggestion };
  return editorTextSuggest(input);
}
