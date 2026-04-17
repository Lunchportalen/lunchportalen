import { describe, expect, test } from "vitest";

import { canSeeNextWeek, canSeeThisWeek } from "@/lib/week/availability";

describe("week visibility (Oslo) — torsdag 08:00 / fredag 15:00", () => {
  test("torsdag 07:59: neste uke ikke åpnet", () => {
    const d = new Date("2026-03-26T06:59:00+01:00"); // tor CET
    expect(canSeeNextWeek(d)).toBe(false);
  });

  test("torsdag 08:00: neste uke åpnet", () => {
    const d = new Date("2026-03-26T08:00:00+01:00");
    expect(canSeeNextWeek(d)).toBe(true);
  });

  test("fredag 14:59: denne uke fortsatt synlig", () => {
    const d = new Date("2026-03-27T14:59:00+01:00");
    expect(canSeeThisWeek(d)).toBe(true);
  });

  test("fredag 15:00: denne uke skjult", () => {
    const d = new Date("2026-03-27T15:00:00+01:00");
    expect(canSeeThisWeek(d)).toBe(false);
  });
});
