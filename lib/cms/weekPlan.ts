// STATUS: KEEP

/**
 * Sanity `weekPlan`-dokument (redaksjonelt / Studio / cron).
 * @deprecated For employee runtime: bruk GET /api/week + menuContent — ikke disse som operativ sannhet.
 * Implementation: lib/sanity/weekplan.ts
 */
import "server-only";

export type { WeekPlanDay, WeekPlanDoc, WeekPlanStatus } from "@/lib/sanity/weekplan";

export {
  fetchCurrentWeekPlan,
  fetchNextOpenWeekPlan,
  fetchNextPublishedWeekPlan,
} from "@/lib/sanity/weekplan";
