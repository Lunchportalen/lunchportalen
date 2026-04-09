import type { BoardScenarios } from "@/lib/ai/boardroom/scenarioEngine";
import type { BoardState } from "@/lib/ai/boardroom/boardState";

export type BoardReport = {
  summary: string;
  state: BoardState;
  decisions: string[];
  scenarios: BoardScenarios;
  timestamp: number;
};

export function buildBoardReport(
  state: BoardState,
  decisions: string[],
  scenarios: BoardScenarios,
  nowMs: number = Date.now(),
): BoardReport {
  return {
    summary: "Board-level strategic output (recommendations only — no automatic execution).",
    state,
    decisions,
    scenarios,
    timestamp: nowMs,
  };
}
