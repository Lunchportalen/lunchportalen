/**
 * Utfører kun godkjente handlinger: utkast i meta — aldri auto-send.
 */
import "server-only";

import type { PipelineActionRow } from "@/lib/pipeline/generateActions";
import { generateFollowUpMessage } from "@/lib/sales/followupGenerator";
import { saveDraftMessage } from "@/lib/sales/saveDraftMessage";
import { logSalesLoopDraftSaved } from "@/lib/sales/salesLoopLog";

const EXECUTABLE = new Set(["follow_up_now", "revive"]);

export type SalesLoopExecuteRow = PipelineActionRow & {
  status: "draft_created" | "skipped" | "failed" | "skipped_dry" | "skipped_unapproved" | "skipped_type";
};

export type ExecuteSalesLoopResult = {
  ok: boolean;
  results: SalesLoopExecuteRow[];
};

export async function executeSalesLoop(
  actions: PipelineActionRow[],
  opts: { rid: string },
): Promise<ExecuteSalesLoopResult> {
  const dry = process.env.SALES_LOOP_MODE === "dry";
  const results: SalesLoopExecuteRow[] = [];

  for (const action of actions) {
    if (!action.approved) {
      results.push({ ...action, status: "skipped_unapproved" });
      continue;
    }

    if (!EXECUTABLE.has(action.action.type)) {
      results.push({ ...action, status: "skipped_type" });
      continue;
    }

    if (dry) {
      results.push({ ...action, status: "skipped_dry" });
      continue;
    }

    try {
      const message = generateFollowUpMessage(action);
      const saved = await saveDraftMessage({ leadId: action.leadId, message, rid: opts.rid });

      if (!saved.saved) {
        results.push({ ...action, status: "failed" });
        continue;
      }

      await logSalesLoopDraftSaved(opts.rid, action.leadId, message);
      results.push({ ...action, status: "draft_created" });
    } catch (err) {
      console.error("[LOOP_ERROR]", err);
      results.push({ ...action, status: "failed" });
    }
  }

  const ok = results.every((r) => r.status !== "failed");
  return { ok, results };
}
