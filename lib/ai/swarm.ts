import "server-only";

import { agents } from "@/lib/ai/agents/list";

export type SwarmResultRow = {
  agent: string;
  result: unknown;
};

/**
 * Sekvensiell agent-kjøring (deterministisk rekkefølge).
 */
export async function runSwarm(input: unknown): Promise<SwarmResultRow[]> {
  const results: SwarmResultRow[] = [];

  for (const agent of agents) {
    const res = await agent.run(input);
    results.push({
      agent: agent.name,
      result: res,
    });
  }

  console.log("[SWARM]", results);
  return results;
}
