import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  detectMenuWeekOpeningNotifyAnomalies,
  evaluateWeekSchedulerSubCalls,
  isWeekCronObservabilityPath,
  reportMenuWeekOpeningNotifyAnomalies,
  reportWeekSchedulerSubCallFailures,
  WEEK_CRON_OBSERVABILITY_ALLOWLIST,
} from "@/lib/http/weekCronObservability";

const captureServerMessage = vi.fn();

vi.mock("@/lib/sentry/capture", () => ({
  captureServerMessage: (...args: unknown[]) => captureServerMessage(...args),
}));

describe("weekCronObservability allowlist", () => {
  it("fail-closed for unknown cron paths", () => {
    expect(isWeekCronObservabilityPath("/api/cron/week-scheduler")).toBe(true);
    expect(isWeekCronObservabilityPath("/api/cron/menu-week-opening-notify")).toBe(true);
    expect(isWeekCronObservabilityPath("/api/cron/outbox")).toBe(false);
    expect(WEEK_CRON_OBSERVABILITY_ALLOWLIST).toHaveLength(3);
  });
});

describe("evaluateWeekSchedulerSubCalls", () => {
  it("allOk when every sub-call is ok", () => {
    const evaluation = evaluateWeekSchedulerSubCalls(
      ["thursday_14_week_opening_notify"],
      [{ action: "menu-week-opening-notify", ok: true, status: 200 }],
    );
    expect(evaluation.allOk).toBe(true);
    expect(evaluation.failures).toEqual([]);
  });

  it("flags non-ok sub-call with schedule context", () => {
    const evaluation = evaluateWeekSchedulerSubCalls(
      ["thursday_08_open_next", "friday_14_hide_week1"],
      [
        { action: "week-visibility", ok: true, status: 200 },
        { action: "week-visibility", ok: false, status: 500 },
      ],
    );
    expect(evaluation.allOk).toBe(false);
    expect(evaluation.failures).toEqual([
      {
        trigger: "friday_14_hide_week1",
        action: "week-visibility",
        status: 500,
        scheduleWindow: "Friday 14:00–14:09 Europe/Oslo",
      },
    ]);
  });
});

describe("detectMenuWeekOpeningNotifyAnomalies", () => {
  const base = {
    sent: 1,
    failed: 0,
    eligible: 2,
    attempted: 1,
    skippedOptOut: 0,
    skippedAlready: 1,
    eventKey: "2026-04-06",
    weekMonday: "2026-04-06",
  };

  it("happy-path: no anomalies on successful send", () => {
    expect(detectMenuWeekOpeningNotifyAnomalies(base, { onOpeningDay: true })).toEqual([]);
  });

  it("happy-path: no anomalies when all eligible already sent (idempotent re-run)", () => {
    expect(
      detectMenuWeekOpeningNotifyAnomalies(
        {
          ...base,
          sent: 0,
          attempted: 0,
          eligible: 3,
          skippedAlready: 3,
        },
        { onOpeningDay: true },
      ),
    ).toEqual([]);
  });

  it("alerts on partial send failures", () => {
    expect(
      detectMenuWeekOpeningNotifyAnomalies(
        { ...base, sent: 1, failed: 2, attempted: 3 },
        { onOpeningDay: true },
      ),
    ).toEqual([{ kind: "send_failures" }]);
  });

  it("alerts on total send failure (sent=0, attempted>0)", () => {
    expect(
      detectMenuWeekOpeningNotifyAnomalies(
        { ...base, sent: 0, failed: 3, attempted: 3 },
        { onOpeningDay: true },
      ),
    ).toEqual([{ kind: "send_failures" }, { kind: "zero_send_with_pending" }]);
  });

  it("alerts on zero eligible on opening day", () => {
    expect(
      detectMenuWeekOpeningNotifyAnomalies(
        { ...base, sent: 0, failed: 0, eligible: 0, attempted: 0, skippedAlready: 0 },
        { onOpeningDay: true },
      ),
    ).toEqual([{ kind: "zero_eligible_on_opening_day" }]);
  });

  it("alerts on zero send with pending recipients", () => {
    expect(
      detectMenuWeekOpeningNotifyAnomalies(
        { ...base, sent: 0, failed: 0, attempted: 2 },
        { onOpeningDay: true },
      ),
    ).toEqual([{ kind: "zero_send_with_pending" }]);
  });

  it("no anomalies outside opening-day window", () => {
    expect(
      detectMenuWeekOpeningNotifyAnomalies(
        { ...base, sent: 0, failed: 0, eligible: 0, attempted: 0 },
        { onOpeningDay: false },
      ),
    ).toEqual([]);
  });
});

describe("reportWeekSchedulerSubCallFailures", () => {
  beforeEach(() => {
    captureServerMessage.mockClear();
  });

  it("reports each failed sub-call to Sentry", () => {
    reportWeekSchedulerSubCallFailures(
      "/api/cron/week-scheduler",
      "rid_test",
      { weekday: "Thursday", hour: 14, minute: 2, isoDate: "2026-03-26" },
      [
        {
          trigger: "thursday_14_week_opening_notify",
          action: "menu-week-opening-notify",
          status: 500,
          scheduleWindow: "Thursday 14:00–14:09 Europe/Oslo",
        },
      ],
    );

    expect(captureServerMessage).toHaveBeenCalledTimes(1);
    expect(captureServerMessage.mock.calls[0]?.[0]).toBe("week-scheduler sub-call failed");
    expect(captureServerMessage.mock.calls[0]?.[1]).toBe("error");
  });

  it("fail-closed: does not report for unknown cron path", () => {
    reportWeekSchedulerSubCallFailures(
      "/api/cron/outbox" as "/api/cron/week-scheduler",
      "rid_test",
      { weekday: "Thursday", hour: 14, minute: 2, isoDate: "2026-03-26" },
      [
        {
          trigger: "thursday_14_week_opening_notify",
          action: "menu-week-opening-notify",
          status: 500,
          scheduleWindow: "Thursday 14:00–14:09 Europe/Oslo",
        },
      ],
    );
    expect(captureServerMessage).not.toHaveBeenCalled();
  });
});

describe("reportMenuWeekOpeningNotifyAnomalies", () => {
  beforeEach(() => {
    captureServerMessage.mockClear();
  });

  it("reports aggregated notify anomalies", () => {
    reportMenuWeekOpeningNotifyAnomalies(
      "/api/cron/menu-week-opening-notify",
      "rid_mwo",
      {
        sent: 0,
        failed: 2,
        eligible: 5,
        attempted: 2,
        skippedOptOut: 0,
        skippedAlready: 3,
        eventKey: "2026-04-06",
        weekMonday: "2026-04-06",
      },
      [{ kind: "send_failures" }],
    );

    expect(captureServerMessage).toHaveBeenCalledTimes(1);
    expect(captureServerMessage.mock.calls[0]?.[0]).toBe("menu-week-opening-notify anomaly");
  });

  it("happy-path: no Sentry when anomalies list is empty", () => {
    reportMenuWeekOpeningNotifyAnomalies(
      "/api/cron/menu-week-opening-notify",
      "rid_mwo",
      {
        sent: 2,
        failed: 0,
        eligible: 2,
        attempted: 2,
        skippedOptOut: 0,
        skippedAlready: 0,
        eventKey: "2026-04-06",
        weekMonday: "2026-04-06",
      },
      [],
    );
    expect(captureServerMessage).not.toHaveBeenCalled();
  });
});
