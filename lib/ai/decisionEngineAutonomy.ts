/**
 * Server-only entry for multi-agent merged decisions.
 * Kept separate from `decisionEngine.ts` so client code can still import `DecisionResult` types.
 */
import "server-only";

export { collectDecisions } from "./autonomy/collectDecisions";
export type { AgentDecision, MergedAutonomyDecision } from "./autonomy/types";
