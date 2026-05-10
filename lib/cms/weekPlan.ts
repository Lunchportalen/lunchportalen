// STATUS: KEEP

/**
 * Sanity `weekPlan`-dokument (redaksjonelt / Studio / cron).
 * @deprecated since 2026-05-10 — owner: CMS/Ops.
 * Fjernes i neste RC når `app/api/weekplan/route.ts` er migrert til canonical week API.
 * For employee runtime: bruk GET /api/week + menuContent — ikke disse som operativ sannhet.
 * Implementation: lib/sanity/weekplan.ts
 */
import "server-only";

export type { WeekPlanDay, WeekPlanDoc, WeekPlanStatus } from "@/lib/sanity/weekplan";

export {
  fetchCurrentWeekPlan,
  fetchNextOpenWeekPlan,
  fetchNextPublishedWeekPlan,
} from "@/lib/sanity/weekplan";
