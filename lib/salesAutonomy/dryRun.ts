import type { AutonomyPreparedAction, AutonomyResultItem } from "@/lib/salesAutonomy/types";

export function simulateExecution(actions: AutonomyPreparedAction[]): AutonomyResultItem[] {
  const list = Array.isArray(actions) ? actions : [];
  return list.map((a) => {
    if (a.type === "observe") {
      return {
        id: a.id,
        type: a.type,
        status: "simulated",
        simulated: true,
        result: "observe_skip",
        reason: "observe",
      };
    }
    return {
      id: a.id,
      type: a.type,
      status: "simulated",
      simulated: true,
      result: "would_execute",
    };
  });
}
