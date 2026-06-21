import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SanityClient } from "@sanity/client";
import type { SupabaseClient } from "@supabase/supabase-js";

import { GET as getWeekScheduler } from "@/app/api/cron/week-scheduler/route";
import { GET as getMenuWeekOpeningNotify } from "@/app/api/cron/menu-week-opening-notify/route";
import { MELHUS_PROVIDER_SANITY_ID } from "@/lib/cms/providerSanityConstants";
import {
  detectMenuWeekOpeningNotifyAnomalies,
  evaluateWeekSchedulerSubCalls,
} from "@/lib/http/weekCronObservability";
import type { Meal } from "@/lib/menu-publish/generateWeekMenu";
import { runMenuWeekRollout } from "@/lib/menu-publish/runMenuWeekRollout";
import {
  filterRecipientsForSend,
  shouldRunMenuWeekOpeningNotify,
  weekOpeningEventKey,
  weekOpeningThirdWeekMonday,
} from "@/lib/notifications/menuWeekOpeningCore";
import { getVisibleWindow } from "@/lib/week/availability";
import {
  osloWallInstant,
  rolloutTargetFromRolloutInstant,
  rolloutTargetFromRolloutThursday,
  thirdWeekMondayFromOpeningInstant,
  thirdWeekMondayFromOpeningThursday,
} from "./osloTestClock";

const captureServerMessage = vi.fn();

vi.mock("@/lib/sentry/capture", () => ({
  captureServerMessage: (...args: unknown[]) => captureServerMessage(...args),
}));

function mockSupabaseForTiers(tiers: Array<"BASIS" | "LUXUS" | "ENTERPRISE">): SupabaseClient {
  const admin = {
    from: (table: string) => {
      if (table === "agreements") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => Promise.resolve({ data: [{ id: "ag1" }], error: null }),
            }),
          }),
        };
      }
      if (table === "agreement_delivery_days") {
        return {
          select: () => ({
            in: () => Promise.resolve({ data: tiers.map((tier) => ({ tier })), error: null }),
          }),
        };
      }
      throw new Error(`unexpected table ${table}`);
    },
  };
  return admin as unknown as SupabaseClient;
}

function diverseMealsFixture(prefix: string): Meal[] {
  const n = { energyKcal: 100, proteinG: 10, carbohydratesG: 12, fatG: 6, saltG: 0.8 };
  const out: Meal[] = [];
  for (let i = 0; i < 80; i += 1) {
    out.push({
      _id: `${prefix}-std-${i}`,
      title: `Hovedrett ${prefix}-std-${i}`,
      description: `Besk ${i}`,
      tags: ["chicken"],
      costTier: "STANDARD",
      nutritionPer100g: { ...n },
      isActive: true,
      kitchenStyle: "nordic",
    });
  }
  for (let i = 0; i < 20; i += 1) {
    out.push({
      _id: `${prefix}-suppe-${i}`,
      title: `Suppe ${prefix}-${i}`,
      tags: ["suppe"],
      costTier: "STANDARD",
      nutritionPer100g: { ...n },
      isSoup: true,
      isActive: true,
    });
  }
  for (let i = 0; i < 20; i += 1) {
    out.push({
      _id: `${prefix}-fisk-${i}`,
      title: `Fisk ${prefix}-${i}`,
      tags: ["fisk"],
      costTier: "STANDARD",
      nutritionPer100g: { ...n },
      isFishDish: true,
      isActive: true,
    });
  }
  for (let i = 0; i < 20; i += 1) {
    out.push({
      _id: `${prefix}-fre-${i}`,
      title: `Fredagskos ${prefix} pizza-${i}`,
      tags: ["fredagskos"],
      costTier: "STANDARD",
      nutritionPer100g: { ...n },
      isActive: true,
    });
  }
  return out;
}

describe("weekMenuPublishChain — integration (rollout → visibility → notify)", () => {
  describe("chain calendar alignment (N+3 rollout → tor 14 third week)", () => {
    it("forrige torsdag rollout-target = tredje uke mandag på åpnings-torsdag", () => {
      const openingThu = "2026-03-26";
      const rolloutThu = "2026-03-19";
      expect(rolloutTargetFromRolloutThursday(rolloutThu)).toBe(thirdWeekMondayFromOpeningThursday(openingThu));
      expect(rolloutTargetFromRolloutThursday(rolloutThu)).toBe("2026-04-06");
    });

    it("rollout-instant (tor 12 UTC) og åpnings-instant (tor 14 Oslo) peker på samme uke", () => {
      const rolloutInstant = new Date("2026-03-19T12:00:00.000Z");
      const openingInstant = osloWallInstant("2026-03-26", 14, 5, "+01:00");
      expect(rolloutTargetFromRolloutInstant(rolloutInstant)).toBe(thirdWeekMondayFromOpeningInstant(openingInstant));
    });
  });

  describe("getVisibleWindow — 2 uker / 3 uker overlap / fre 14 skjul eldste", () => {
    const cases: Array<{ label: string; instant: Date; expected: ReturnType<typeof getVisibleWindow> }> = [
      {
        label: "man 09: current + next",
        instant: osloWallInstant("2026-03-23", 9, 0, "+01:00"),
        expected: { showCurrent: true, showNext: true, showThird: false },
      },
      {
        label: "tor 13:59: ikke third",
        instant: osloWallInstant("2026-03-26", 13, 59, "+01:00"),
        expected: { showCurrent: true, showNext: true, showThird: false },
      },
      {
        label: "tor 14:00: current + next + third",
        instant: osloWallInstant("2026-03-26", 14, 0, "+01:00"),
        expected: { showCurrent: true, showNext: true, showThird: true },
      },
      {
        label: "fre 13:59: fortsatt 3 uker",
        instant: osloWallInstant("2026-03-27", 13, 59, "+01:00"),
        expected: { showCurrent: true, showNext: true, showThird: true },
      },
      {
        label: "fre 14:00: eldste borte",
        instant: osloWallInstant("2026-03-27", 14, 0, "+01:00"),
        expected: { showCurrent: false, showNext: true, showThird: true },
      },
      {
        label: "lør: next + third",
        instant: osloWallInstant("2026-03-28", 10, 0, "+01:00"),
        expected: { showCurrent: false, showNext: true, showThird: true },
      },
      {
        label: "man 00:00 neste ISO-uke: third false",
        instant: osloWallInstant("2026-03-30", 0, 0, "+02:00"),
        expected: { showCurrent: true, showNext: true, showThird: false },
      },
    ];

    it.each(cases)("$label", ({ instant, expected }) => {
      expect(getVisibleWindow(instant)).toEqual(expected);
    });
  });

  describe("DST-grenser (Europe/Oslo) — tor 14 / fre 14 / tor 08", () => {
    it("vår (CEST): tor 14:00 +02:00 åpner third", () => {
      const instant = osloWallInstant("2026-04-23", 14, 0, "+02:00");
      expect(getVisibleWindow(instant).showThird).toBe(true);
      expect(shouldRunMenuWeekOpeningNotify(instant)).toBe(true);
    });

    it("høst (CET): tor 14:00 +01:00 etter DST-slutt", () => {
      const instant = osloWallInstant("2026-10-29", 14, 0, "+01:00");
      expect(getVisibleWindow(instant).showThird).toBe(true);
      expect(shouldRunMenuWeekOpeningNotify(instant)).toBe(true);
    });

    it("høst (CEST): fre 14:00 +02:00 skjuler current", () => {
      const instant = osloWallInstant("2026-10-23", 14, 0, "+02:00");
      expect(getVisibleWindow(instant)).toEqual({ showCurrent: false, showNext: true, showThird: true });
    });

    it("week-scheduler tor 08-vindu (CEST)", () => {
      const instant = osloWallInstant("2026-04-23", 8, 5, "+02:00");
      vi.useFakeTimers();
      vi.setSystemTime(instant);
      const p = new Intl.DateTimeFormat("en-GB", {
        timeZone: "Europe/Oslo",
        weekday: "long",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }).formatToParts(instant);
      const weekday = p.find((x) => x.type === "weekday")?.value;
      const hour = Number(p.find((x) => x.type === "hour")?.value);
      expect(weekday).toBe("Thursday");
      expect(hour).toBe(8);
      vi.useRealTimers();
    });
  });

  describe("notify — kun tor 14 + showThird", () => {
    it("tor 14:05 med showThird: shouldRun", () => {
      const now = osloWallInstant("2026-03-26", 14, 5, "+01:00");
      expect(getVisibleWindow(now).showThird).toBe(true);
      expect(shouldRunMenuWeekOpeningNotify(now)).toBe(true);
    });

    it("tor 13:59: ikke notify", () => {
      const now = osloWallInstant("2026-03-26", 13, 59, "+01:00");
      expect(shouldRunMenuWeekOpeningNotify(now)).toBe(false);
    });

    it("fre 14:05: ikke notify (feil ukedag)", () => {
      const now = osloWallInstant("2026-03-27", 14, 5, "+01:00");
      expect(shouldRunMenuWeekOpeningNotify(now)).toBe(false);
    });

    it("man 14:05: ikke notify (third ikke synlig)", () => {
      const now = osloWallInstant("2026-03-23", 14, 5, "+01:00");
      expect(getVisibleWindow(now).showThird).toBe(false);
      expect(shouldRunMenuWeekOpeningNotify(now)).toBe(false);
    });
  });

  describe("rollout (N+3) — 3 tiers × 5 dager, customerVisible, pins fylt", () => {
    const rolloutInstant = new Date("2026-05-15T12:00:00.000Z");
    const expectedDates = ["2026-06-01", "2026-06-02", "2026-06-03", "2026-06-04", "2026-06-05"];
    let createdDocs: unknown[];

    beforeEach(() => {
      createdDocs = [];
    });

    it("genererer 15 menuDays publisert uten tom pin-dag", async () => {
      const fetchImpl = async (q: string) => {
        if (q.includes('_type == "mealIdea"')) return diverseMealsFixture("chain-bank");
        if (q.includes("mealRefId")) return [];
        if (q.includes("{ mealTitle, description }")) return [];
        return [];
      };
      const sanityRead = {
        fetch: vi.fn((q: string) => fetchImpl(q)),
      } as unknown as SanityClient;
      const mockWrite = () =>
        ({
          transaction: () => {
            const chain = {
              createOrReplace: vi.fn((doc: unknown) => {
                createdDocs.push(doc);
                return chain;
              }),
              patch: vi.fn(() => chain),
              commit: vi.fn(async () => {}),
            };
            return chain;
          },
        }) as unknown as SanityClient;

      const res = await runMenuWeekRollout({
        instant: rolloutInstant,
        sanityProviderRef: MELHUS_PROVIDER_SANITY_ID,
        supabaseAdmin: () => mockSupabaseForTiers(["BASIS", "LUXUS", "ENTERPRISE"]),
        sanityRead,
        getSanityWrite: mockWrite,
      });

      expect(res.targetWeek).toBe("2026-06-01");
      expect(res.tiersProcessed).toEqual(["BASIS", "LUXUS", "ENTERPRISE"]);
      expect(res.menuDaysCreated).toBe(15);
      expect(res.errors).toEqual([]);
      expect(createdDocs).toHaveLength(15);

      for (const doc of createdDocs as Array<Record<string, unknown>>) {
        expect(doc.customerVisible).toBe(true);
        expect(doc.approvedForPublish).toBe(true);
        expect(doc.mealTitle).toBeTruthy();
        expect(expectedDates).toContain(doc.date);
      }

      const plan = res.sharedWeekPlan ?? [];
      expect(plan).toHaveLength(5);
      expect(plan[1]?.mealTitle).toMatch(/Suppe/i);
      expect(plan[3]?.mealTitle).toMatch(/Fisk/i);
      expect(plan[4]?.mealTitle).toMatch(/Fredagskos/i);
    });
  });

  describe("notify idempotency — send-log unique (filterRecipientsForSend)", () => {
    it("andre kjøring hopper over allerede sendt", () => {
      const recipients = [
        { userId: "u1", email: "a@test.no", companyId: "c1" },
        { userId: "u2", email: "b@test.no", companyId: "c1" },
      ];
      const first = filterRecipientsForSend(recipients, new Map(), new Set());
      expect(first.toSend).toHaveLength(2);

      const second = filterRecipientsForSend(recipients, new Map(), new Set(["u1", "u2"]));
      expect(second.toSend).toHaveLength(0);
      expect(second.skippedAlready).toBe(2);
    });
  });

  describe("ende-til-ende kalenderkjede med injisert systemtid", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });
    afterEach(() => {
      vi.useRealTimers();
    });

    it("rollout-target → eventKey → notify-vindu på samme tredje-uke-mandag", () => {
      const rolloutInstant = new Date("2026-03-19T12:00:00.000Z");
      const openingInstant = osloWallInstant("2026-03-26", 14, 5, "+01:00");
      const targetMonday = rolloutTargetFromRolloutInstant(rolloutInstant);

      vi.setSystemTime(openingInstant);
      expect(weekOpeningThirdWeekMonday(openingInstant)).toBe(targetMonday);
      expect(weekOpeningEventKey(openingInstant)).toBe(targetMonday);
      expect(shouldRunMenuWeekOpeningNotify(openingInstant)).toBe(true);
    });
  });

  describe("#271 stille-feil — week-scheduler sub-call non-ok → 500", () => {
    const cronSecret = "publish-chain-cron-secret";
    let fetchMock: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      process.env.CRON_SECRET = cronSecret;
      process.env.PUBLIC_APP_URL = "http://test.local";
      fetchMock = vi.fn();
      vi.stubGlobal("fetch", fetchMock);
      vi.useFakeTimers();
      captureServerMessage.mockClear();
    });

    afterEach(() => {
      delete process.env.CRON_SECRET;
      delete process.env.PUBLIC_APP_URL;
      vi.unstubAllGlobals();
      vi.useRealTimers();
    });

    function cronReq() {
      return new Request("http://test.local/api/cron/week-scheduler", {
        method: "GET",
        headers: { Authorization: `Bearer ${cronSecret}` },
      });
    }

    it("tor 14:05 — sub-call 500 gir route 500 + Sentry", async () => {
      vi.setSystemTime(osloWallInstant("2026-03-26", 14, 5, "+01:00"));
      fetchMock.mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => "notify failed",
      });

      const res = await getWeekScheduler(cronReq());
      expect(res.status).toBe(500);
      const json = await res.json();
      expect(json.ok).toBe(false);
      expect(json.error).toBe("WEEK_SCHEDULER_PARTIAL_FAILURE");
      expect(json.detail.triggered).toContain("thursday_14_week_opening_notify");
      expect(captureServerMessage).toHaveBeenCalledWith("week-scheduler sub-call failed", "error", expect.any(Object));
    });

    it("tor 08:05 — week-visibility sub-call feil evalueres", () => {
      const evaluation = evaluateWeekSchedulerSubCalls(
        ["thursday_08_open_next"],
        [{ action: "week-visibility", ok: false, status: 500 }],
      );
      expect(evaluation.allOk).toBe(false);
      expect(evaluation.failures[0]?.trigger).toBe("thursday_08_open_next");
    });

    it("utenfor vindu: no-op 200", async () => {
      vi.setSystemTime(osloWallInstant("2026-03-23", 10, 0, "+01:00"));
      const res = await getWeekScheduler(cronReq());
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data.triggered).toEqual([]);
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe("#271 stille-feil — notify-anomalier (failed>0, zero-send)", () => {
    const cronSecret = "publish-chain-notify-secret";

    beforeEach(() => {
      process.env.CRON_SECRET = cronSecret;
      vi.useFakeTimers();
      captureServerMessage.mockClear();
    });

    afterEach(() => {
      delete process.env.CRON_SECRET;
      vi.useRealTimers();
      vi.restoreAllMocks();
    });

    it("tor 14:05 — failed>0 eksponerer observabilityAlerts + Sentry", async () => {
      vi.setSystemTime(osloWallInstant("2026-03-26", 14, 5, "+01:00"));

      const notifyResult = {
        eventKey: "2026-04-06",
        weekMonday: "2026-04-06",
        sent: 1,
        failed: 2,
        eligible: 5,
        attempted: 3,
        skippedOptOut: 0,
        skippedAlready: 0,
        skippedNoWindow: false,
      };

      vi.spyOn(await import("@/lib/notifications/menuWeekOpeningNotify"), "runMenuWeekOpeningEmailNotify").mockResolvedValue(
        notifyResult,
      );

      const res = await getMenuWeekOpeningNotify(
        new Request("http://test.local/api/cron/menu-week-opening-notify", {
          method: "GET",
          headers: { Authorization: `Bearer ${cronSecret}` },
        }),
      );

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data.observabilityAlerts).toContain("send_failures");
      expect(captureServerMessage).toHaveBeenCalledWith(
        "menu-week-opening-notify anomaly",
        "error",
        expect.objectContaining({ anomalyKinds: "send_failures" }),
      );
    });

    it("tor 14:05 — zero-send med pending på åpningsdag er anomali", () => {
      const anomalies = detectMenuWeekOpeningNotifyAnomalies(
        {
          eventKey: "2026-04-06",
          weekMonday: "2026-04-06",
          sent: 0,
          failed: 0,
          eligible: 3,
          attempted: 2,
          skippedOptOut: 0,
          skippedAlready: 0,
        },
        { onOpeningDay: true },
      );
      expect(anomalies.map((a) => a.kind)).toContain("zero_send_with_pending");
    });

    it("utenfor vindu: skipped outside_window", async () => {
      vi.setSystemTime(osloWallInstant("2026-03-26", 13, 59, "+01:00"));
      const res = await getMenuWeekOpeningNotify(
        new Request("http://test.local/api/cron/menu-week-opening-notify", {
          method: "GET",
          headers: { Authorization: `Bearer ${cronSecret}` },
        }),
      );
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data.skipped).toBe(true);
      expect(json.data.reason).toBe("outside_window");
    });
  });
});
