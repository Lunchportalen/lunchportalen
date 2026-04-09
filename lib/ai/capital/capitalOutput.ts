import type { CapitalAllocationRow } from "@/lib/ai/capital/allocationEngine";
import type { CapitalState } from "@/lib/ai/capital/capitalState";

export type CapitalReport = {
  summary: string;
  state: CapitalState;
  allocation: CapitalAllocationRow[];
  topPriority: InvestmentAreaOrNull;
  timestamp: number;
};

type InvestmentAreaOrNull = CapitalAllocationRow["area"] | null;

export function buildCapitalReport(
  state: CapitalState,
  allocation: CapitalAllocationRow[],
  nowMs: number = Date.now(),
): CapitalReport {
  return {
    summary: "Kapitalallokering (kun anbefaling — ingen automatisk investering eller overføring).",
    state,
    allocation,
    topPriority: allocation[0]?.area ?? null,
    timestamp: nowMs,
  };
}
