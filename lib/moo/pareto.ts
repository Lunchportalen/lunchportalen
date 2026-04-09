import type { MooNormalized } from "@/lib/moo/types";

/**
 * True iff `after` is not worse on any axis (within eps) and strictly better on at least one.
 */
export function isParetoBetter(before: MooNormalized, after: MooNormalized, eps = 0.001): boolean {
  const noRegression =
    after.revenue >= before.revenue - eps &&
    after.retention >= before.retention - eps &&
    after.dwell >= before.dwell - eps;

  const strictlyBetter =
    after.revenue > before.revenue + eps ||
    after.retention > before.retention + eps ||
    after.dwell > before.dwell + eps;

  return noRegression && strictlyBetter;
}
