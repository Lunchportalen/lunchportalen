/**
 * Editor-side helpers for Page AI Contract (diagnostics/suggestions).
 * Delegates to lib/cms/model/pageAiContractHelpers for merge logic.
 */

import { mergeContractIntoMeta } from "@/lib/cms/model/pageAiContractHelpers";

function safeObj(v: unknown): Record<string, unknown> {
  if (!v || typeof v !== "object" || Array.isArray(v)) return {};
  return v as Record<string, unknown>;
}
function safeArrStr(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return (v as unknown[]).filter((t): t is string => typeof t === "string").map((t) => t.trim()).filter(Boolean);
}

const MAX_SUGGESTIONS = 20;

/** Append one suggestion to meta.diagnostics.suggestions (keeps last MAX_SUGGESTIONS). */
export function appendDiagnosticsSuggestion(
  meta: Record<string, unknown>,
  suggestion: string
): Record<string, unknown> {
  const trimmed = typeof suggestion === "string" ? suggestion.trim() : "";
  if (!trimmed) return meta;
  const prevDiag = safeObj(meta.diagnostics);
  const prev = safeArrStr(prevDiag.suggestions);
  return mergeContractIntoMeta(meta, {
    diagnostics: { suggestions: [...prev.slice(-(MAX_SUGGESTIONS - 1)), trimmed] },
  });
}
