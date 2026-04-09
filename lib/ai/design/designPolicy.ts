/**
 * STEP 4 — Safety: cap changes, resolve key conflicts, optional rapid-toggle guard.
 * Pure functions — no I/O.
 */

import type { DesignSettingsDocument } from "@/lib/cms/design/designContract";

import type { DesignImprovementSuggestion, SuggestionRisk } from "./types";

export const DESIGN_POLICY_MAX_CHANGES_PER_RUN = 3;

/** Minimum ms between applying overlapping keys (anti flip-flop). */
export const DESIGN_POLICY_TOGGLE_COOLDOWN_MS = 120_000;

const RISK_ORDER: Record<SuggestionRisk, number> = { high: 3, medium: 2, low: 1 };

export function designPatchAffectedKeys(patch: DesignSettingsDocument): string[] {
  const keys: string[] = [];
  if (patch.spacing?.section) keys.push("spacing.section");
  if (patch.surface?.section) keys.push("surface.section");
  if (patch.typography?.heading != null) keys.push("typography.heading");
  if (patch.typography?.body != null) keys.push("typography.body");
  if (patch.layout?.container) keys.push("layout.container");
  if (patch.card != null && typeof patch.card === "object" && !Array.isArray(patch.card)) {
    for (const [blockKey, v] of Object.entries(patch.card)) {
      if (!v || typeof v !== "object" || Array.isArray(v)) continue;
      const o = v as Record<string, unknown>;
      if (o.hover !== undefined) keys.push(`card.${blockKey}.hover`);
      if (o.variant !== undefined) keys.push(`card.${blockKey}.variant`);
    }
  }
  return keys;
}

/**
 * Same target key (e.g. spacing.section): keep the suggestion with higher risk rank (medium over low).
 */
export function dedupeSuggestionsByKey(suggestions: DesignImprovementSuggestion[]): DesignImprovementSuggestion[] {
  const best = new Map<string, DesignImprovementSuggestion>();
  for (const s of suggestions) {
    const prev = best.get(s.key);
    if (!prev || RISK_ORDER[s.risk] > RISK_ORDER[prev.risk]) {
      best.set(s.key, s);
    }
  }
  return suggestions.filter((s) => best.get(s.key) === s);
}

export function capSuggestions(suggestions: DesignImprovementSuggestion[], max: number): DesignImprovementSuggestion[] {
  if (max <= 0) return [];
  return suggestions.slice(0, max);
}

export function filterLowRiskOnly(suggestions: DesignImprovementSuggestion[]): DesignImprovementSuggestion[] {
  return suggestions.filter((s) => s.risk === "low");
}

export type LastDesignApplySnapshot = {
  at: number;
  keys: string[];
};

/**
 * Reject if any affected key was applied recently (same session guard — caller supplies last snapshot from DB or client).
 */
export function assertNoRapidToggle(
  affectedKeys: string[],
  last: LastDesignApplySnapshot | null | undefined,
  cooldownMs: number = DESIGN_POLICY_TOGGLE_COOLDOWN_MS,
): { ok: true } | { ok: false; message: string } {
  if (!last || last.keys.length === 0 || affectedKeys.length === 0) return { ok: true };
  const overlap = affectedKeys.some((k) => last.keys.includes(k));
  if (!overlap) return { ok: true };
  const elapsed = Date.now() - last.at;
  if (elapsed >= cooldownMs) return { ok: true };
  return {
    ok: false,
    message: `Rask veksling er blokkert (${Math.ceil((cooldownMs - elapsed) / 1000)}s igjen av vernevindu).`,
  };
}

export function assertMaxPatchKeys(
  patch: DesignSettingsDocument,
  max: number = DESIGN_POLICY_MAX_CHANGES_PER_RUN,
): { ok: true } | { ok: false; message: string } {
  const keys = designPatchAffectedKeys(patch);
  if (keys.length <= max) return { ok: true };
  return {
    ok: false,
    message: `For mange endringer (${keys.length}); maks ${max} per kjøring.`,
  };
}

export function sortSuggestionsByRisk(suggestions: DesignImprovementSuggestion[]): DesignImprovementSuggestion[] {
  return [...suggestions].sort((a, b) => RISK_ORDER[b.risk] - RISK_ORDER[a.risk]);
}

/** Pipeline for analyze response: dedupe, cap, optional auto (low risk only). */
export function applyAnalyzePolicy(input: {
  suggestions: DesignImprovementSuggestion[];
  maxReturned?: number;
  autoApplyMode?: boolean;
}): { suggestions: DesignImprovementSuggestion[]; droppedForAuto?: number } {
  const max = input.maxReturned ?? DESIGN_POLICY_MAX_CHANGES_PER_RUN;
  let list = dedupeSuggestionsByKey(input.suggestions);
  let droppedForAuto = 0;
  if (input.autoApplyMode) {
    const before = list.length;
    list = filterLowRiskOnly(list);
    droppedForAuto = before - list.length;
  }
  list = sortSuggestionsByRisk(list);
  list = capSuggestions(list, max);
  return { suggestions: list, droppedForAuto: input.autoApplyMode ? droppedForAuto : undefined };
}
