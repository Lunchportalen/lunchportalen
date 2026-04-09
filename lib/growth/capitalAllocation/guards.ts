import type { MarketSnapshot } from "@/lib/growth/capitalAllocation/types";

const MAX_REV_DROP = 0.1;
const MAX_RET_DROP = 0.05;
const MAX_DWELL_DROP = 0.1;

/**
 * Rollback if any primary guard metric worsens beyond threshold vs last window snapshot.
 */
export function shouldRollback(current: MarketSnapshot, last: MarketSnapshot | null): boolean {
  if (!last) return false;
  if (last.revenue > 0 && current.revenue < last.revenue * (1 - MAX_REV_DROP)) return true;
  if (last.retention > 0 && current.retention < last.retention * (1 - MAX_RET_DROP)) return true;
  if (last.dwell > 0 && current.dwell < last.dwell * (1 - MAX_DWELL_DROP)) return true;
  return false;
}
