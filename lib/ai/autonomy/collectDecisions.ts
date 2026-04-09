import "server-only";

import type { AgentDecision, MergedAutonomyDecision } from "@/lib/ai/autonomy/types";
import type { SystemContext } from "@/lib/ai/context/systemContext";
import { collectAgentDecisions } from "@/lib/ai/agents";

const MIN_CONFIDENCE = 0.6;
const MAX_DECISIONS = 5;

function decisionKey(d: AgentDecision): string {
  return `${d.agent}:${d.action.trim().toLowerCase()}`;
}

function mergeId(d: AgentDecision, index: number): string {
  return `m_${d.agent}_${index}_${Math.round(d.confidence * 100)}`;
}

/**
 * 1) Run all agents 2) merge 3) sort by priority 4) filter confidence 5) dedupe actions 6) cap 5.
 */
export function collectDecisions(context: SystemContext): MergedAutonomyDecision[] {
  const raw = collectAgentDecisions(context);
  const filtered = raw.filter((d) => d.confidence >= MIN_CONFIDENCE);
  filtered.sort((a, b) => b.priority - a.priority);

  const seen = new Set<string>();
  const out: MergedAutonomyDecision[] = [];
  for (const d of filtered) {
    const k = decisionKey(d);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push({ ...d, id: mergeId(d, out.length) });
    if (out.length >= MAX_DECISIONS) break;
  }
  return out;
}
