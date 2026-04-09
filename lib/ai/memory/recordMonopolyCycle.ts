/**
 * Audit row for the monopoly intelligence cron (category → demand/lock-in/effects/threats → strategy → safe execute ≤2).
 */

import "server-only";

import type { OrgExecutionRow } from "@/lib/ai/automationEngine";
import type { CategoryMode } from "@/lib/ai/monopoly/categoryEngine";
import type { MonopolyStrategyPillar } from "@/lib/ai/monopoly/strategyEngine";
import type { OrgAction } from "@/lib/ai/org/orgCoordinator";
import { insertAiMemory } from "@/lib/ai/memory/aiMemory";
import { opsLog } from "@/lib/ops/log";
import { supabaseAdmin } from "@/lib/supabase/admin";

export type RecordMonopolyCycleOpts = {
  rid: string;
  category: CategoryMode;
  demand: string[];
  lockIn: string[];
  effects: string[];
  threats: string[];
  strategy: MonopolyStrategyPillar[];
  actions: OrgAction[];
  executed: OrgExecutionRow[];
};

export async function recordMonopolyCycle(opts: RecordMonopolyCycleOpts): Promise<{ ok: boolean; message?: string }> {
  try {
    await insertAiMemory(supabaseAdmin(), {
      kind: "monopoly_cycle",
      source_rid: opts.rid,
      payload: {
        category: opts.category,
        demand: opts.demand,
        lockIn: opts.lockIn,
        effects: opts.effects,
        threats: opts.threats,
        strategy: opts.strategy,
        actions: opts.actions,
        results: opts.executed,
      },
    });
    return { ok: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    opsLog("record_monopoly_cycle_failed", { rid: opts.rid, message });
    return { ok: false, message };
  }
}
