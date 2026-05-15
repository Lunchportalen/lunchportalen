import { describe, expect, it } from "vitest";

import { mondayToFridayIso, startOfWeekMondayNPlus3, utcInstantToOsloDateISO } from "@/lib/menu-publish/calendar";

describe("menu-publish calendar (N+3 rollout)", () => {
  it("mandag uke N+3 fra fast Oslo-dato (2026-05-15)", () => {
    const instant = new Date("2026-05-15T12:00:00.000Z");
    expect(utcInstantToOsloDateISO(instant)).toBe("2026-05-15");

    const mon = startOfWeekMondayNPlus3("2026-05-15");
    expect(mon).toBe("2026-06-01");

    const days = mondayToFridayIso(mon);
    expect(days).toEqual(["2026-06-01", "2026-06-02", "2026-06-03", "2026-06-04", "2026-06-05"]);
  });
});
