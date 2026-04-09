import { opsLog } from "@/lib/ops/log";

/**
 * Structured metric line (stdout + observability queue). No PII in `name`/`value`.
 */
export function logMetric(name: string, value: number | string): void {
  opsLog("metric", { name, value });
}
