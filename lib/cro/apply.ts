/**
 * Safe CRO apply: only allowlisted suggestion types and targets.
 * - Apply updates only the intended target (one meta path or one block); never overwrites unrelated content.
 * - Malformed or ambiguous payload → applied: false, no mutation.
 * - Reject (dismiss) is handled in editorState; no content change.
 */

import type { CroSuggestionType } from "@/lib/cro/suggestions";
import type { CroRecommendation } from "@/lib/cro/editorState";

/** Only these suggestion types may be auto-applied. All others require "Gå til blokk" + manual edit. */
const APPLICABLE_CRO_TYPES: readonly CroSuggestionType[] = ["no_trust_signals"] as const;

/** Default trust signals when applying no_trust_signals to empty meta.cro.trustSignals. */
const DEFAULT_TRUST_SIGNALS = ["Sikkerhet", "Compliance", "ESG"] as const;

type BlockLike = { id: string; type: string; data?: Record<string, unknown> };

export type ValidateCroApplyResult = {
  valid: boolean;
  error?: string;
};

/**
 * Validate suggestion before apply. Fail closed on malformed or ambiguous payload.
 * - type must be in allowlist; recommendedChange non-empty.
 * - For block target: targetBlockId must be set and block must exist and be correct type.
 * - For page target: no block required.
 */
export function validateCroSuggestionForApply(
  rec: { type: string; target: string; targetBlockId?: string; recommendedChange?: string },
  meta: Record<string, unknown>,
  blocks: BlockLike[] = []
): ValidateCroApplyResult {
  const type = rec.type as CroSuggestionType;
  if (!APPLICABLE_CRO_TYPES.includes(type)) {
    return { valid: false, error: "Type not applicable for apply" };
  }
  const recommendedChange = typeof rec.recommendedChange === "string" ? rec.recommendedChange.trim() : "";
  if (!recommendedChange) {
    return { valid: false, error: "Empty recommendedChange" };
  }
  if (rec.target === "block") {
    const blockId = typeof rec.targetBlockId === "string" ? rec.targetBlockId.trim() : "";
    if (!blockId) {
      return { valid: false, error: "Block target missing targetBlockId" };
    }
    const block = blocks.find((b) => b.id === blockId);
    if (!block) {
      return { valid: false, error: "Target block not found" };
    }
    if (type === "weak_cta" && block.type !== "cta") {
      return { valid: false, error: "Target block is not a CTA block" };
    }
  }
  if (!meta || typeof meta !== "object" || Array.isArray(meta)) {
    return { valid: false, error: "Invalid meta" };
  }
  return { valid: true };
}

function safeArrStr(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return (v as unknown[])
    .filter((t): t is string => typeof t === "string")
    .map((t) => t.trim())
    .filter(Boolean);
}

export type ApplyCroSuggestionResult = {
  applied: boolean;
  nextMeta: Record<string, unknown>;
  nextBlocks: BlockLike[];
  error?: string;
};

/**
 * Apply a single CRO suggestion to content. Updates only the allowlisted target; never touches unrelated fields.
 * - no_trust_signals: set meta.cro.trustSignals to default only when current is empty (no overwrite).
 * - Invalid or inapplicable suggestion → applied: false, nextMeta/nextBlocks unchanged.
 * - On success, marks the recommendation as "applied" in meta.croRecommendations.
 */
export function applyCroSuggestionToContent(
  meta: Record<string, unknown>,
  blocks: BlockLike[],
  rec: CroRecommendation
): ApplyCroSuggestionResult {
  const validation = validateCroSuggestionForApply(rec, meta, blocks);
  if (!validation.valid) {
    return {
      applied: false,
      nextMeta: { ...meta },
      nextBlocks: [...blocks],
      error: validation.error,
    };
  }

  const type = rec.type as CroSuggestionType;

  if (type === "no_trust_signals") {
    const cro = meta.cro != null && typeof meta.cro === "object" && !Array.isArray(meta.cro)
      ? (meta.cro as Record<string, unknown>)
      : {};
    const existing = safeArrStr(cro.trustSignals);
    if (existing.length > 0) {
      return {
        applied: false,
        nextMeta: { ...meta },
        nextBlocks: [...blocks],
        error: "Trust signals already set; not overwriting",
      };
    }
    const nextMeta = { ...meta };
    const nextCro = { ...cro, trustSignals: [...DEFAULT_TRUST_SIGNALS] };
    nextMeta.cro = nextCro;

    const recState = nextMeta.croRecommendations as { suggestions?: CroRecommendation[] } | undefined;
    if (recState != null && typeof recState === "object" && Array.isArray(recState.suggestions)) {
      nextMeta.croRecommendations = {
        ...recState,
        suggestions: recState.suggestions.map((s) =>
          s.id === rec.id ? { ...s, status: "applied" as const } : s
        ),
      };
    }
    return { applied: true, nextMeta, nextBlocks: [...blocks] };
  }

  return {
    applied: false,
    nextMeta: { ...meta },
    nextBlocks: [...blocks],
    error: "Type not applicable for apply",
  };
}

/** True if this suggestion type is eligible for apply (show "Bruk" in UI). */
export function isCroSuggestionApplicable(type: CroSuggestionType): boolean {
  return (APPLICABLE_CRO_TYPES as readonly string[]).includes(type);
}
