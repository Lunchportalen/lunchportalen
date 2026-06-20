import { describe, expect, test } from "vitest";

import {
  filterRecipientsForSend,
  formatWeekRangeNo,
  isMenuWeekOpeningNotifyWindow,
  menuWeekOpeningEnabledFromPref,
  shouldRunMenuWeekOpeningNotify,
  weekOpeningEventKey,
  weekOpeningThirdWeekMonday,
} from "@/lib/notifications/menuWeekOpeningCore";
import { buildMenuWeekOpeningEmail } from "@/lib/notifications/menuWeekOpeningEmailTemplate";

describe("menuWeekOpeningCore", () => {
  test("torsdag 14:00 Oslo er notify-vindu", () => {
    const now = new Date("2026-03-26T14:05:00+01:00");
    expect(isMenuWeekOpeningNotifyWindow(now)).toBe(true);
    expect(shouldRunMenuWeekOpeningNotify(now)).toBe(true);
  });

  test("torsdag 13:59 er ikke notify-vindu", () => {
    const now = new Date("2026-03-26T13:59:00+01:00");
    expect(isMenuWeekOpeningNotifyWindow(now)).toBe(false);
  });

  test("weekOpeningEventKey er mandag uke 3", () => {
    const now = new Date("2026-03-26T14:05:00+01:00");
    const mon = weekOpeningThirdWeekMonday(now);
    expect(mon).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(weekOpeningEventKey(now)).toBe(mon);
  });

  test("formatWeekRangeNo", () => {
    expect(formatWeekRangeNo("2026-04-06")).toBe("06.04–10.04");
  });

  test("menuWeekOpeningEnabledFromPref default på", () => {
    expect(menuWeekOpeningEnabledFromPref(undefined)).toBe(true);
    expect(menuWeekOpeningEnabledFromPref(null)).toBe(true);
    expect(menuWeekOpeningEnabledFromPref(false)).toBe(false);
  });

  test("filterRecipientsForSend respekterer opt-out og idempotens", () => {
    const recipients = [
      { userId: "a", email: "a@test.no", companyId: "c1" },
      { userId: "b", email: "b@test.no", companyId: "c1" },
      { userId: "c", email: "c@test.no", companyId: "c1" },
    ];
    const prefs = new Map<string, boolean | null>([["b", false]]);
    const already = new Set(["c"]);
    const { toSend, skippedOptOut, skippedAlready } = filterRecipientsForSend(recipients, prefs, already);
    expect(toSend.map((r) => r.userId)).toEqual(["a"]);
    expect(skippedOptOut).toBe(1);
    expect(skippedAlready).toBe(1);
  });
});

describe("menuWeekOpeningEmailTemplate", () => {
  test("bruker gull CTA og ikke hot pink", () => {
    const mail = buildMenuWeekOpeningEmail({
      weekRangeLabel: "06.04–10.04",
      menuTitle: "Kyllinggryte",
      weekUrl: "https://lunchportalen.no/week",
      logoUrl: "https://lunchportalen.no/brand/LP-logo-uten-bakgrunn.png",
    });
    expect(mail.html).toContain("#f5c518");
    expect(mail.html).not.toContain("#e91e8c");
    expect(mail.html).toContain("Bestill uka");
    expect(mail.subject).toContain("06.04–10.04");
  });
});
