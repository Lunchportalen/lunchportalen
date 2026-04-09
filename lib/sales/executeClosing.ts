/**
 * Godkjente møteutkast — kun skriving til meta, ingen auto-e-post / oppringning.
 */
import "server-only";

import type { PipelineActionRow } from "@/lib/pipeline/generateActions";
import {
  companyNameFromLead,
  predictedProbFromLead,
} from "@/lib/pipeline/generateActions";
import type { PrioritizedLead } from "@/lib/pipeline/prioritize";
import { findReadyToClose } from "@/lib/sales/readyToClose";
import { buildClosingMessage } from "@/lib/sales/closingMessage";
import { logClosingSuggested } from "@/lib/sales/closingAudit";
import { saveDraftMessage } from "@/lib/sales/saveDraftMessage";

const MAX_CLOSING_PER_RUN = 5;
const CLOSING_COOLDOWN_MS = 48 * 60 * 60 * 1000;

export type ClosingExecuteResult = {
  leadId: string;
  status:
    | "meeting_proposed"
    | "skipped_cooldown"
    | "skipped_dry"
    | "failed"
    | "skipped_no_match"
    | "skipped_limit";
};

function closingCooldownActive(lead: PrioritizedLead): boolean {
  const m = lead.meta;
  if (!m || typeof m !== "object" || Array.isArray(m)) return false;
  const raw = (m as Record<string, unknown>).closing_last_touch_at;
  if (typeof raw !== "string" || !raw.trim()) return false;
  const t = new Date(raw).getTime();
  return Number.isFinite(t) && Date.now() - t < CLOSING_COOLDOWN_MS;
}

function syntheticBookMeeting(lead: PrioritizedLead): PipelineActionRow {
  const leadId = typeof lead.id === "string" ? lead.id : "";
  return {
    id: `${leadId}:book_meeting`,
    leadId,
    company: companyNameFromLead(lead),
    priority_score: lead.priority_score,
    predicted_probability: predictedProbFromLead(lead),
    action: {
      type: "book_meeting",
      message: "Book møte – klar til lukking (closing opportunities)",
      priority: 1,
    },
    approved: true,
    executed: false,
  };
}

export async function executeClosingProposals(
  leadIds: string[],
  opts: {
    rid: string;
    prioritized: PrioritizedLead[];
    items: PipelineActionRow[];
    mode: "pipeline" | "ready";
  },
): Promise<{ ok: boolean; results: ClosingExecuteResult[] }> {
  const uniq = [...new Set(leadIds.map((x) => String(x).trim()).filter(Boolean))];
  const prioritizedById = new Map(opts.prioritized.map((p) => [p.id, p]));
  const itemsByLead = new Map(opts.items.map((i) => [i.leadId, i]));

  const entries: Array<{ row: PipelineActionRow; lead: PrioritizedLead }> = [];

  if (opts.mode === "pipeline") {
    for (const id of uniq) {
      const item = itemsByLead.get(id);
      const lead = prioritizedById.get(id);
      if (!item || !lead || item.action.type !== "book_meeting") continue;
      entries.push({ row: { ...item, approved: true }, lead });
    }
  } else {
    const readySet = new Set(findReadyToClose(opts.prioritized).map((l) => l.id));
    for (const id of uniq) {
      if (!readySet.has(id)) continue;
      const lead = prioritizedById.get(id);
      if (!lead) continue;
      entries.push({ row: syntheticBookMeeting(lead), lead });
    }
  }

  entries.sort((a, b) => b.lead.priority_score - a.lead.priority_score);
  const capped = entries.slice(0, MAX_CLOSING_PER_RUN);
  const overflow = entries.slice(MAX_CLOSING_PER_RUN);

  const dry = process.env.SALES_LOOP_MODE === "dry";
  const results: ClosingExecuteResult[] = [];

  for (const { row, lead } of capped) {
    if (dry) {
      results.push({ leadId: row.leadId, status: "skipped_dry" });
      continue;
    }
    if (closingCooldownActive(lead)) {
      results.push({ leadId: row.leadId, status: "skipped_cooldown" });
      continue;
    }

    try {
      const message = buildClosingMessage(lead as unknown as { id: string; meta?: Record<string, unknown> | null });
      const saved = await saveDraftMessage({
        leadId: row.leadId,
        message,
        rid: opts.rid,
        kind: "closing",
      });
      if (!saved.saved) {
        results.push({ leadId: row.leadId, status: "failed" });
        continue;
      }
      if (saved.skipped) {
        results.push({ leadId: row.leadId, status: "meeting_proposed" });
        continue;
      }
      await logClosingSuggested(opts.rid, row.leadId, message);
      results.push({ leadId: row.leadId, status: "meeting_proposed" });
    } catch (e) {
      console.error("[executeClosing]", row.leadId, e);
      results.push({ leadId: row.leadId, status: "failed" });
    }
  }

  for (const { row } of overflow) {
    results.push({ leadId: row.leadId, status: "skipped_limit" });
  }

  for (const id of uniq) {
    if (!entries.some((e) => e.row.leadId === id)) {
      results.push({ leadId: id, status: "skipped_no_match" });
    }
  }

  const primary = results.filter((r) => capped.some((c) => c.row.leadId === r.leadId));
  const ok = primary.length === 0 ? true : primary.every((r) => r.status !== "failed");
  return { ok, results };
}

/** Alias for integrasjoner som forventer navnet «executeClosing». */
export const executeClosing = executeClosingProposals;
