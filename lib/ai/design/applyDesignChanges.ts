/**
 * STEP 3 — Apply engine: merge patch into global settings via mergeDesignSettingsIntoGlobalContentData only.
 * Server-only; does not touch blocks.
 */

import "server-only";

import { opsLog } from "@/lib/ops/log";
import type { DesignSettingsDocument } from "@/lib/cms/design/designContract";
import { mergeDesignSettingsIntoGlobalContentData } from "@/lib/cms/design/designContract";
import { loadGlobalSettingsDataForEditor } from "@/lib/cms/globalSettingsAdmin";
import { publishGlobal } from "@/lib/cms/publishGlobal";
import { saveGlobalDraft } from "@/lib/cms/writeGlobal";

import { extractDesignSettingsForStorage } from "./designSettingsOptimizer";

const KEY = "settings" as const;

function cloneDeep<T>(v: T): T {
  try {
    return JSON.parse(JSON.stringify(v)) as T;
  } catch {
    return v;
  }
}

export type ApplyDesignChangesResult =
  | {
      ok: true;
      action: "save" | "publish";
      nextData: Record<string, unknown>;
      revertDesignSettings: Record<string, unknown>;
      afterDesignSettings: Record<string, unknown>;
      draft?: { version: number; draft: Record<string, unknown> };
      published?: boolean;
      /** True when merged patch produces no net change vs current draft — no DB write. */
      idempotentSkip?: boolean;
    }
  | { ok: false; message: string };

/**
 * Loads current global settings (draft-first), merges DesignSettings patch, saves draft; optionally publishes.
 */
export async function applyDesignChanges(input: {
  patch: DesignSettingsDocument;
  action: "save" | "publish";
}): Promise<ApplyDesignChangesResult> {
  const loaded = await loadGlobalSettingsDataForEditor();
  if (loaded.ok === false) {
    return { ok: false, message: loaded.message };
  }

  const baseData = cloneDeep(loaded.data);
  const revertDesignSettings = extractDesignSettingsForStorage(baseData.designSettings);
  const nextData = mergeDesignSettingsIntoGlobalContentData(baseData, input.patch);
  const afterDesignSettings = extractDesignSettingsForStorage(nextData.designSettings);

  try {
    if (JSON.stringify(revertDesignSettings) === JSON.stringify(afterDesignSettings)) {
      opsLog("design.apply_idempotent_skip", { action: input.action });
      return {
        ok: true,
        action: input.action,
        nextData: baseData,
        revertDesignSettings,
        afterDesignSettings,
        idempotentSkip: true,
      };
    }
  } catch {
    /* deterministic compare only — on stringify failure, continue with save */
  }

  const saved = await saveGlobalDraft(KEY, nextData);
  if (saved.ok === false) {
    return { ok: false, message: saved.message };
  }

  if (input.action === "publish") {
    const published = await publishGlobal(KEY);
    if (published.ok === false) {
      return { ok: false, message: published.message };
    }
    return {
      ok: true,
      action: "publish",
      nextData,
      revertDesignSettings,
      afterDesignSettings,
      published: true,
    };
  }

  return {
    ok: true,
    action: "save",
    nextData,
    revertDesignSettings,
    afterDesignSettings,
    draft: { version: saved.version, draft: saved.draft },
  };
}
