/**
 * Pilot: paths that match `vercel.json` → `crons[].path`.
 * Keep in sync when Vercel cron schedule changes (single source for docs + ops checks).
 */
export const PILOT_VERCEL_CRON_PATHS = [
  "/api/cron/week-scheduler",
  "/api/cron/forecast",
  "/api/cron/preprod",
  "/api/cron/outbox",
  "/api/cron/cleanup-invites",
] as const;

export type PilotVercelCronPath = (typeof PILOT_VERCEL_CRON_PATHS)[number];
