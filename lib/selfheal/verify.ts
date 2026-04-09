import type { MonitoringCurrent } from "@/lib/monitoring/types";

export type VerificationResult = {
  resolved: boolean;
  improvement: number;
  beforeErrors: number;
  afterErrors: number;
};

export function verifyResolution(before: Pick<MonitoringCurrent, "errors">, after: Pick<MonitoringCurrent, "errors">): VerificationResult {
  const improvement = before.errors - after.errors;
  return {
    resolved: after.errors < before.errors,
    improvement,
    beforeErrors: before.errors,
    afterErrors: after.errors,
  };
}
