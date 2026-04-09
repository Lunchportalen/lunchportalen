import type { IssueClass } from "./classify";

export type RemediationActionType =
  | "restart_jobs"
  | "retry_outbox"
  | "clear_locks"
  | "rebuild_cache"
  | "scale_workers"
  | "db_migration"
  | "notify_human";

export type RemediationPlanItem = {
  type: RemediationActionType;
  safe: boolean;
};

export function getRemediation(issue: IssueClass): RemediationPlanItem[] {
  if (issue === "api_failure") {
    return [
      { type: "restart_jobs", safe: true },
      { type: "retry_outbox", safe: true },
    ];
  }

  if (issue === "performance_degradation") {
    return [{ type: "rebuild_cache", safe: true }];
  }

  if (issue === "business_anomaly") {
    return [{ type: "notify_human", safe: true }];
  }

  return [];
}
