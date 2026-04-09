import type { MonitoringAlert } from "@/lib/monitoring/types";

export type IssueClass = "api_failure" | "performance_degradation" | "business_anomaly" | "unknown";

export function classifyAlert(alert: Pick<MonitoringAlert, "type">): IssueClass {
  switch (alert.type) {
    case "error_spike":
      return "api_failure";
    case "latency":
      return "performance_degradation";
    case "revenue_drop":
      return "business_anomaly";
    default:
      return "unknown";
  }
}
