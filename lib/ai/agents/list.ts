import "server-only";

import type { Agent } from "@/lib/ai/agents/base";

export const agents: Agent[] = [
  {
    name: "growth",
    run: async (input) => {
      console.log("[AGENT:GROWTH]", input);
      return { action: "optimize" };
    },
  },
  {
    name: "ops",
    run: async (input) => {
      console.log("[AGENT:OPS]", input);
      return { action: "stabilize" };
    },
  },
];
