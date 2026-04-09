export type RepairIssue = {
  type: string;
  [key: string]: unknown;
};

export type RepairAction =
  | { action: "retry_fetch" }
  | { action: "safe_fallback" }
  | { action: "log_only" };

/**
 * Proposes a reversible action — executor must not apply side effects without explicit gates.
 */
export function attemptRepair(issue: RepairIssue): RepairAction {
  if (issue.type === "missing_data") {
    return { action: "retry_fetch" };
  }
  if (issue.type === "null_pointer") {
    return { action: "safe_fallback" };
  }
  return { action: "log_only" };
}
