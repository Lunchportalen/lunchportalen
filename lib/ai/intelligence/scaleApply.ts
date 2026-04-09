/**
 * STEP 4 / 8 / 9 — Apply engine: system-level only (DesignSettings + global `aiScalePreferences`).
 * No CMS block mutation. All applies must be preceded by policy + explicit tower approval (except optional auto-design).
 */

import "server-only";

import { applyDesignChanges } from "@/lib/ai/design/applyDesignChanges";
import { extractDesignSettingsForStorage, mergeDesignOptimizerPatches } from "@/lib/ai/design/designSettingsOptimizer";
import { storeLearning } from "@/lib/ai/learning";
import type { DesignSettingsDocument } from "@/lib/cms/design/designContract";
import { loadGlobalSettingsDataForEditor } from "@/lib/cms/globalSettingsAdmin";
import { saveGlobalDraft } from "@/lib/cms/writeGlobal";

import { opsLog } from "@/lib/ops/log";

import { logEvent } from "./store";
import type { ScaleAction } from "./scaleDecision";

const SETTINGS_KEY = "settings" as const;

function cloneRecord(data: Record<string, unknown>): Record<string, unknown> {
  try {
    return JSON.parse(JSON.stringify(data)) as Record<string, unknown>;
  } catch {
    return { ...data };
  }
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return Boolean(v && typeof v === "object" && !Array.isArray(v));
}

/**
 * Map scale actions to a single merged DesignSettings patch (spacing / CTA hover only).
 */
export function buildDesignPatchFromScaleActions(actions: readonly ScaleAction[]): DesignSettingsDocument | null {
  const designOnes = actions.filter((a) => a.type === "design");
  if (designOnes.length === 0) return null;
  const patches: DesignSettingsDocument[] = [];
  for (const a of designOnes) {
    if (a.target === "spacing.section") {
      const v = a.value;
      if (v === "wide" || v === "normal" || v === "tight") {
        patches.push({ spacing: { section: v } });
      }
    }
  }
  if (patches.length === 0) return null;
  return mergeDesignOptimizerPatches(patches);
}

export type AiScalePreferences = {
  gtm?: Record<string, string>;
  content?: Record<string, string>;
  updatedAt?: string;
  sourceRid?: string | null;
};

/**
 * Non-design actions → merged preference object (written under `data.aiScalePreferences`).
 */
export function buildAiScalePreferencesFromActions(
  actions: readonly ScaleAction[],
  sourceRid?: string | null,
): AiScalePreferences {
  const gtm: Record<string, string> = {};
  const content: Record<string, string> = {};
  for (const a of actions) {
    if (a.type === "gtm") gtm[a.target] = a.value;
    if (a.type === "content") content[a.target] = a.value;
  }
  return {
    ...(Object.keys(gtm).length ? { gtm } : {}),
    ...(Object.keys(content).length ? { content } : {}),
    updatedAt: new Date().toISOString(),
    sourceRid: sourceRid ?? null,
  };
}

export type ExecuteScaleActionsResult =
  | {
      ok: true;
      designApplied: boolean;
      preferencesApplied: boolean;
      revertDesignSettings?: Record<string, unknown>;
      message: string;
    }
  | { ok: false; message: string };

/**
 * Execute approved scale actions (draft global settings only).
 */
export async function executeScaleActions(input: {
  actions: readonly ScaleAction[];
  source_rid?: string | null;
  company_id?: string | null;
}): Promise<ExecuteScaleActionsResult> {
  const actions = input.actions;
  if (actions.length === 0) {
    return { ok: false, message: "Ingen handlinger å utføre." };
  }

  const designPatch = buildDesignPatchFromScaleActions(actions);
  const prefActions = actions.filter((a) => a.type === "gtm" || a.type === "content");
  const prefs = buildAiScalePreferencesFromActions(prefActions, input.source_rid ?? null);

  let designApplied = false;
  let revertDesignSettings: Record<string, unknown> | undefined;

  if (designPatch && Object.keys(designPatch).length > 0) {
    const beforeLoaded = await loadGlobalSettingsDataForEditor();
    const beforeDesign =
      beforeLoaded.ok === true ? extractDesignSettingsForStorage(beforeLoaded.data.designSettings) : {};

    const res = await applyDesignChanges({ patch: designPatch, action: "save" });
    if (res.ok === false) {
      return { ok: false, message: res.message };
    }
    designApplied = true;
    revertDesignSettings = res.revertDesignSettings;

    const designLog = await logEvent({
      type: "analytics",
      source: "controlled_scale_apply",
      payload: {
        kind: "scale_action",
        action: { type: "design", patch: designPatch },
        before: { designSettings: beforeDesign },
        after: { designSettings: res.afterDesignSettings },
      },
      company_id: input.company_id,
      source_rid: input.source_rid ?? null,
    });
    if (designLog.ok === false) {
      opsLog("ai_intelligence.scale_apply_log_failed", { phase: "design", error: designLog.error });
    }
  }

  let preferencesApplied = false;
  if (Object.keys(prefs.gtm ?? {}).length > 0 || Object.keys(prefs.content ?? {}).length > 0) {
    const loaded = await loadGlobalSettingsDataForEditor();
    if (loaded.ok === false) {
      if (designApplied) {
        return {
          ok: true,
          designApplied,
          preferencesApplied: false,
          revertDesignSettings,
          message: "Design lagret; kunne ikke oppdatere aiScalePreferences (innstillinger utilgjengelige).",
        };
      }
      return { ok: false, message: loaded.message };
    }

    const base = cloneRecord(loaded.data);
    const prevPref = isPlainObject(base.aiScalePreferences) ? base.aiScalePreferences : {};
    const prevGtm = isPlainObject(prevPref.gtm) ? (prevPref.gtm as Record<string, unknown>) : {};
    const prevContent = isPlainObject(prevPref.content) ? (prevPref.content as Record<string, unknown>) : {};

    const beforePrefs = { gtm: { ...prevGtm }, content: { ...prevContent } };

    const nextGtm = { ...prevGtm, ...(prefs.gtm ?? {}) };
    const nextContent = { ...prevContent, ...(prefs.content ?? {}) };

    base.aiScalePreferences = {
      gtm: nextGtm,
      content: nextContent,
      updatedAt: prefs.updatedAt,
      sourceRid: prefs.sourceRid,
    };

    const saved = await saveGlobalDraft(SETTINGS_KEY, base);
    if (saved.ok === false) {
      if (designApplied) {
        return {
          ok: true,
          designApplied,
          preferencesApplied: false,
          revertDesignSettings,
          message: `Design lagret; mal-preferanser feilet: ${saved.message}`,
        };
      }
      return { ok: false, message: saved.message };
    }
    preferencesApplied = true;

    const prefLog = await logEvent({
      type: "analytics",
      source: "controlled_scale_apply",
      payload: {
        kind: "scale_action",
        action: { type: "preferences", targets: prefs },
        before: { aiScalePreferences: beforePrefs },
        after: { aiScalePreferences: { gtm: nextGtm, content: nextContent } },
      },
      company_id: input.company_id,
      source_rid: input.source_rid ?? null,
    });
    if (prefLog.ok === false) {
      opsLog("ai_intelligence.scale_apply_log_failed", { phase: "preferences", error: prefLog.error });
    }
  }

  try {
    await storeLearning({
      winningPatterns: actions.map((a) => ({
        patternKey: `scale_${a.patternType}_${a.target}`.slice(0, 120),
        direction: "positive" as const,
        confidence: a.confidence,
        reason: `controlled_scale_apply:${a.id}`,
        basedOn: ["cro_rules"],
      })),
      losingPatterns: [],
      metricsSummary: {
        winnerVariantId: null,
        variantCount: 0,
        totalViews: 0,
        bestConversionRate: 0,
        conversionSpread: null,
      },
    });
  } catch {
    /* best-effort */
  }

  const message = [
    designApplied ? "DesignSettings (utkast) oppdatert." : null,
    preferencesApplied ? "aiScalePreferences (utkast) oppdatert." : null,
  ]
    .filter(Boolean)
    .join(" ");

  return {
    ok: true,
    designApplied,
    preferencesApplied,
    revertDesignSettings,
    message: message || "Ingen systemendringer (kun logging).",
  };
}

/**
 * STEP 9 — Revert design draft to snapshot (from prior apply result metadata).
 */
export async function rollbackScaleDesign(input: {
  revertDesignSettings: Record<string, unknown>;
  source_rid?: string | null;
  company_id?: string | null;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const patch = input.revertDesignSettings as DesignSettingsDocument;
  const res = await applyDesignChanges({ patch, action: "save" });
  if (res.ok === false) return { ok: false, message: res.message };
  const rbLog = await logEvent({
    type: "analytics",
    source: "controlled_scale_rollback",
    payload: {
      kind: "scale_rollback",
      scope: "designSettings_draft",
      restored: input.revertDesignSettings,
    },
    company_id: input.company_id,
    source_rid: input.source_rid ?? null,
  });
  if (rbLog.ok === false) {
    opsLog("ai_intelligence.scale_rollback_log_failed", { error: rbLog.error });
  }
  return { ok: true };
}
