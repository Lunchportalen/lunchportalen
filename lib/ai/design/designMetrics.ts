/**
 * STEP 5 — Metrics payloads for logging (before/after, keys, timestamps).
 * Callers persist via ai_activity_log / ops; this module stays pure.
 */

import type { DesignSettingsDocument } from "@/lib/cms/design/designContract";

export type DesignOptimizerMetricAction = "analyze" | "apply" | "revert" | "auto_apply";

export type DesignMetricsPayload = {
  action: DesignOptimizerMetricAction;
  timestamp: string;
  suggestionKeys: string[];
  issueCodes?: string[];
  beforeDesignSettings: Record<string, unknown>;
  afterDesignSettings?: Record<string, unknown>;
  appliedPatch?: DesignSettingsDocument;
  autoApply?: boolean;
  policy?: {
    maxChanges: number;
    rapidToggleOk: boolean;
  };
};

export function nowIso(): string {
  return new Date().toISOString();
}

export function buildAnalyzeMetrics(input: {
  issueCodes: string[];
  suggestionKeys: string[];
  beforeDesignSettings: Record<string, unknown>;
  autoApply?: boolean;
}): DesignMetricsPayload {
  return {
    action: "analyze",
    timestamp: nowIso(),
    suggestionKeys: input.suggestionKeys,
    issueCodes: input.issueCodes,
    beforeDesignSettings: input.beforeDesignSettings,
    autoApply: input.autoApply,
  };
}

export function buildApplyMetrics(input: {
  suggestionKeys: string[];
  beforeDesignSettings: Record<string, unknown>;
  afterDesignSettings: Record<string, unknown>;
  appliedPatch: DesignSettingsDocument;
  autoApply?: boolean;
}): DesignMetricsPayload {
  return {
    action: input.autoApply ? "auto_apply" : "apply",
    timestamp: nowIso(),
    suggestionKeys: input.suggestionKeys,
    beforeDesignSettings: input.beforeDesignSettings,
    afterDesignSettings: input.afterDesignSettings,
    appliedPatch: input.appliedPatch,
    autoApply: input.autoApply,
  };
}

export function buildRevertMetrics(input: {
  beforeDesignSettings: Record<string, unknown>;
  restoredDesignSettings: Record<string, unknown>;
}): DesignMetricsPayload {
  return {
    action: "revert",
    timestamp: nowIso(),
    suggestionKeys: [],
    beforeDesignSettings: input.beforeDesignSettings,
    afterDesignSettings: input.restoredDesignSettings,
  };
}
