// lib/system/healthStatus.ts
export type CheckStatus = "OK" | "WARN" | "FAIL";
export type SystemStatus = "normal" | "degraded";
export type HealthCheckItem = { key: string; status: CheckStatus; message: string };

export function deriveSystemStatus(items: HealthCheckItem[]): SystemStatus {
  const hasIssues = items.some((c) => c.status === "FAIL" || c.status === "WARN");
  return hasIssues ? "degraded" : "normal";
}

export function deriveReasons(items: HealthCheckItem[]): string[] {
  return items.filter((c) => c.status !== "OK").map((c) => `${c.key}: ${c.message}`);
}
