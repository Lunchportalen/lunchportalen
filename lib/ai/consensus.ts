import "server-only";

import type { SwarmResultRow } from "@/lib/ai/swarm";
import { vote } from "@/lib/ai/swarmVote";

export async function runConsensus(results: SwarmResultRow[]): Promise<string | null> {
  const decision = vote(results);
  console.log("[CONSENSUS]", decision);
  return decision;
}
