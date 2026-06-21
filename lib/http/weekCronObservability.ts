import "server-only";

import { captureServerMessage } from "@/lib/sentry/capture";

/**
 * Scope-lock: week-chain cron paths allowed to emit observability alerts.
 * Fail-closed — unknown paths must not report.
 */
export const WEEK_CRON_OBSERVABILITY_ALLOWLIST = [
  "/api/cron/week-scheduler",
  "/api/cron/menu-week-opening-notify",
  "/api/cron/week-visibility",
] as const;

export type WeekCronObservabilityPath = (typeof WEEK_CRON_OBSERVABILITY_ALLOWLIST)[number];

export type WeekSchedulerSubCallResult = {
  action: string;
  ok: boolean;
  status: number;
  text?: string;
};

export type WeekSchedulerSubCallFailure = {
  trigger: string;
  action: string;
  status: number;
  scheduleWindow: string;
};

export type WeekSchedulerEvaluation = {
  allOk: boolean;
  failures: WeekSchedulerSubCallFailure[];
};

const TRIGGER_SCHEDULE_WINDOW: Record<string, string> = {
  thursday_08_open_next: "Thursday 08:00–08:09 Europe/Oslo",
  thursday_14_week_opening_notify: "Thursday 14:00–14:09 Europe/Oslo",
  friday_14_hide_week1: "Friday 14:00–14:09 Europe/Oslo",
};

const TRIGGER_ACTION: Record<string, string> = {
  thursday_08_open_next: "week-visibility",
  thursday_14_week_opening_notify: "menu-week-opening-notify",
  friday_14_hide_week1: "week-visibility",
};

export function isWeekCronObservabilityPath(path: string): path is WeekCronObservabilityPath {
  return (WEEK_CRON_OBSERVABILITY_ALLOWLIST as readonly string[]).includes(path);
}

/**
 * Pure: evaluate sub-call HTTP results against triggered windows.
 */
export function evaluateWeekSchedulerSubCalls(
  triggered: readonly string[],
  results: readonly WeekSchedulerSubCallResult[],
): WeekSchedulerEvaluation {
  const failures: WeekSchedulerSubCallFailure[] = [];

  for (let i = 0; i < triggered.length; i += 1) {
    const trigger = triggered[i] ?? "";
    const result = results[i];
    if (!result || result.ok) continue;

    failures.push({
      trigger,
      action: result.action || TRIGGER_ACTION[trigger] || trigger,
      status: result.status,
      scheduleWindow: TRIGGER_SCHEDULE_WINDOW[trigger] ?? trigger,
    });
  }

  return { allOk: failures.length === 0, failures };
}

export function reportWeekSchedulerSubCallFailures(
  cronPath: WeekCronObservabilityPath,
  rid: string,
  oslo: { weekday: string; hour: number; minute: number; isoDate: string },
  failures: readonly WeekSchedulerSubCallFailure[],
): void {
  if (!isWeekCronObservabilityPath(cronPath) || failures.length === 0) return;

  for (const failure of failures) {
    captureServerMessage("week-scheduler sub-call failed", "error", {
      cron: cronPath,
      rid,
      trigger: failure.trigger,
      action: failure.action,
      httpStatus: failure.status,
      scheduleWindow: failure.scheduleWindow,
      osloWeekday: oslo.weekday,
      osloHour: oslo.hour,
      osloMinute: oslo.minute,
      osloDate: oslo.isoDate,
    });
  }
}

export type MenuWeekOpeningNotifyMetrics = {
  sent: number;
  failed: number;
  eligible: number;
  attempted: number;
  skippedOptOut: number;
  skippedAlready: number;
  eventKey: string;
  weekMonday: string;
};

export type MenuWeekOpeningNotifyAnomalyKind =
  | "send_failures"
  | "zero_send_with_pending"
  | "zero_eligible_on_opening_day";

export type MenuWeekOpeningNotifyAnomaly = {
  kind: MenuWeekOpeningNotifyAnomalyKind;
};

/**
 * Pure: detect silent-failure classes on an opening-day notify run.
 * Happy-path re-runs (all already sent / all opt-out) produce no anomalies.
 */
export function detectMenuWeekOpeningNotifyAnomalies(
  metrics: MenuWeekOpeningNotifyMetrics,
  opts: { onOpeningDay: boolean },
): MenuWeekOpeningNotifyAnomaly[] {
  if (!opts.onOpeningDay) return [];

  const anomalies: MenuWeekOpeningNotifyAnomaly[] = [];

  if (metrics.failed > 0) {
    anomalies.push({ kind: "send_failures" });
  }

  if (metrics.eligible === 0) {
    anomalies.push({ kind: "zero_eligible_on_opening_day" });
  }

  if (metrics.sent === 0 && metrics.attempted > 0) {
    anomalies.push({ kind: "zero_send_with_pending" });
  }

  return anomalies;
}

export function reportMenuWeekOpeningNotifyAnomalies(
  cronPath: WeekCronObservabilityPath,
  rid: string,
  metrics: MenuWeekOpeningNotifyMetrics,
  anomalies: readonly MenuWeekOpeningNotifyAnomaly[],
): void {
  if (!isWeekCronObservabilityPath(cronPath) || anomalies.length === 0) return;

  captureServerMessage("menu-week-opening-notify anomaly", "error", {
    cron: cronPath,
    rid,
    eventKey: metrics.eventKey,
    weekMonday: metrics.weekMonday,
    sent: metrics.sent,
    failed: metrics.failed,
    eligible: metrics.eligible,
    attempted: metrics.attempted,
    skippedOptOut: metrics.skippedOptOut,
    skippedAlready: metrics.skippedAlready,
    anomalyKinds: anomalies.map((a) => a.kind).join(","),
  });
}
