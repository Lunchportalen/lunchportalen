/**
 * STEP 5 — Apply split: design → global DesignSettings patch; content → editor-only (never silent).
 * Execution stays explicit: this module only builds patches / instructions.
 */

import type { DesignSettingsDocument } from "@/lib/cms/design/designContract";

import type { RevenueAction } from "./decisionEngine";

export type DesignPatchPlan = {
  patch: DesignSettingsDocument;
  targets: string[];
};

export type ContentEditPlan = {
  blockId: string;
  intent: string;
  reason: string;
};

export type RevenueApplyPlan = {
  design: DesignPatchPlan | null;
  content: ContentEditPlan[];
  experimentNotes: string[];
};

/**
 * Merge design actions into one patch (last writer wins per branch).
 */
export function buildDesignPatchFromActions(actions: RevenueAction[]): DesignPatchPlan | null {
  const designActs = actions.filter((a) => a.type === "design");
  if (designActs.length === 0) return null;
  const patch: DesignSettingsDocument = {};
  const targets: string[] = [];
  for (const a of designActs) {
    targets.push(a.target);
    if (a.target === "spacing.section") {
      if (a.change === "wide") patch.spacing = { section: "wide" };
      else if (a.change === "normal") patch.spacing = { section: "normal" };
    } else if (a.target === "typography.heading" && a.change === "display") {
      patch.typography = { ...(patch.typography ?? {}), heading: "display" };
    } else if (a.target === "card.cta.hover" && a.change === "lift") {
      patch.card = { ...(patch.card ?? {}), cta: { hover: "lift" } };
    } else if (a.target === "layout.container") {
      if (a.change === "wide") patch.layout = { container: "wide" };
    }
  }
  if (
    patch.card == null &&
    patch.spacing == null &&
    patch.typography == null &&
    patch.layout == null
  ) {
    return null;
  }
  return { patch, targets };
}

export function buildContentPlansFromActions(actions: RevenueAction[]): ContentEditPlan[] {
  return actions
    .filter((a) => a.type === "content")
    .map((a) => ({
      blockId: typeof a.blockId === "string" && a.blockId ? a.blockId : a.target,
      intent: a.change,
      reason: a.reason,
    }));
}

export function buildRevenueApplyPlan(actions: RevenueAction[]): RevenueApplyPlan {
  const experimentNotes = actions
    .filter((a) => a.type === "experiment")
    .map((a) => `${a.target}: ${a.change} — ${a.reason}`);
  return {
    design: buildDesignPatchFromActions(actions),
    content: buildContentPlansFromActions(actions),
    experimentNotes,
  };
}
