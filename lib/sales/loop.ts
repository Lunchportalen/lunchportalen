/**
 * Lead → predict → prioritize → foreslåtte handlinger → (godkjent) utkast.
 * Ingen auto-send; cron kjører kun planlegging.
 */
import "server-only";

import { buildPipelineActionsList } from "@/lib/pipeline/buildPipelineActions";
import type { PipelineActionRow } from "@/lib/pipeline/generateActions";
import type { PrioritizedLead } from "@/lib/pipeline/prioritize";
import { tryCloseDeal } from "@/lib/sales/closeDeal";
import { logSalesLoopRun } from "@/lib/sales/salesLoopLog";

const AGENT_ACTION_TYPES = new Set(["follow_up_now", "revive"]);
const MAX_ACTIONS_PER_RUN = 10;
const COOLDOWN_MS = 24 * 60 * 60 * 1000;
const MAX_CLOSE_SCAN = 150;

export type SalesLoopRunResult = {
  ok: boolean;
  dryRun: boolean;
  /** Miljøflagg — «dry» betyr ingen skrivinger i loop-fasen. */
  salesLoopMode: string | undefined;
  prioritizedPreview: PrioritizedLead[];
  actions: PipelineActionRow[];
  readyToCloseCount: number;
  error?: string;
};

function leadCooldownActive(lead: PrioritizedLead): boolean {
  const m = lead.meta;
  if (!m || typeof m !== "object" || Array.isArray(m)) return false;
  const raw = (m as Record<string, unknown>).sales_loop_last_touch_at;
  if (typeof raw !== "string" || !raw.trim()) return false;
  const t = new Date(raw).getTime();
  if (!Number.isFinite(t)) return false;
  return Date.now() - t < COOLDOWN_MS;
}

/**
 * Velger opptil MAX_ACTIONS_PER_RUN handlinger med 24h cooldown per lead (kun forslag — ikke ved manuell godkjenning).
 */
export function selectLoopActions(
  prioritized: PrioritizedLead[],
  items: PipelineActionRow[],
): PipelineActionRow[] {
  const out: PipelineActionRow[] = [];
  for (let i = 0; i < prioritized.length; i++) {
    const lead = prioritized[i];
    const item = items[i];
    if (!lead || !item || item.leadId !== lead.id) continue;
    if (!AGENT_ACTION_TYPES.has(item.action.type)) continue;
    if (leadCooldownActive(lead)) continue;
    out.push(item);
    if (out.length >= MAX_ACTIONS_PER_RUN) break;
  }
  return out;
}

export async function runSalesLoop(rid: string): Promise<SalesLoopRunResult> {
  const dryRun = process.env.SALES_LOOP_MODE === "dry";

  const built = await buildPipelineActionsList(rid, { skipLog: true });
  if (!built.ok) {
    return {
      ok: false,
      dryRun,
      salesLoopMode: process.env.SALES_LOOP_MODE,
      prioritizedPreview: [],
      actions: [],
      readyToCloseCount: 0,
      error: built.error ?? "build_failed",
    };
  }

  const { prioritized, items } = built;
  const actions = selectLoopActions(prioritized, items);

  let readyToCloseCount = 0;
  if (!dryRun) {
    const scan = prioritized.slice(0, MAX_CLOSE_SCAN);
    for (const lead of scan) {
      const r = await tryCloseDeal(lead, rid);
      if (r.updated) readyToCloseCount += 1;
    }
  }

  await logSalesLoopRun(rid, actions.length, {
    dryRun,
    prioritizedTotal: prioritized.length,
    actionsCapped: actions.length,
    readyToCloseCount: dryRun ? 0 : readyToCloseCount,
  });

  const previewN = Math.min(20, prioritized.length);

  return {
    ok: true,
    dryRun,
    salesLoopMode: process.env.SALES_LOOP_MODE,
    prioritizedPreview: prioritized.slice(0, previewN),
    actions,
    readyToCloseCount: dryRun ? 0 : readyToCloseCount,
  };
}
