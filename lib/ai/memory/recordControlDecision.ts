/**
 * Persists a control-gate audit row (received vs allowed vs blocked + reasons).
 */

import "server-only";

import type { ControlGateRunResult } from "@/lib/ai/control/controlGate";
import { insertAiMemory } from "@/lib/ai/memory/aiMemory";
import { opsLog } from "@/lib/ops/log";
import { supabaseAdmin } from "@/lib/supabase/admin";

function serializeForAudit(a: unknown): unknown {
  try {
    return JSON.parse(JSON.stringify(a)) as unknown;
  } catch {
    return a;
  }
}

export async function recordControlDecision(opts: {
  rid: string;
  lane: string;
  received: unknown[];
  gate: ControlGateRunResult;
}): Promise<{ ok: boolean; message?: string }> {
  try {
    await insertAiMemory(supabaseAdmin(), {
      kind: "control_decision",
      source_rid: opts.rid,
      payload: {
        lane: opts.lane,
        actions_received: opts.received.map(serializeForAudit),
        actions_allowed: opts.gate.allowed.map(serializeForAudit),
        actions_blocked: opts.gate.blocked.map((b) => ({
          action: serializeForAudit(b.action),
          reasons: b.reasons,
        })),
        reasons: opts.gate.blocked.map((b) => ({ action: serializeForAudit(b.action), reasons: b.reasons })),
      },
    });
    return { ok: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    opsLog("record_control_decision_failed", { rid: opts.rid, lane: opts.lane, message });
    return { ok: false, message };
  }
}
