import "server-only";

import type { SystemContext } from "@/lib/ai/context/systemContext";
import type { AgentDecision } from "@/lib/ai/autonomy/types";
import { runCeoAgent } from "@/lib/ai/agents/ceoAgent";
import { runCmoAgent } from "@/lib/ai/agents/cmoAgent";
import { runCtoAgent } from "@/lib/ai/agents/ctoAgent";
import { runCooAgent } from "@/lib/ai/agents/cooAgent";

export function collectAgentDecisions(ctx: SystemContext): AgentDecision[] {
  return [...runCeoAgent(ctx), ...runCmoAgent(ctx), ...runCtoAgent(ctx), ...runCooAgent(ctx)];
}

export { runCeoAgent, runCmoAgent, runCtoAgent, runCooAgent };
