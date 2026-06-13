import { describe, expect, it } from "vitest";

import { getCurrentWeekDates } from "@/lib/date/week";
import { addDaysISO } from "@/lib/date/oslo";

describe("provider kitchen orders week range alignment", () => {
  it("lørdag peker uke-filter mot neste arbeidsuke (inkl. mandag 2026-06-15)", () => {
    const saturday = new Date("2026-06-13T10:00:00");
    const dates = getCurrentWeekDates(saturday);
    expect(dates[0]).toBe("2026-06-15");
    expect(dates).toContain("2026-06-15");

    const from = dates[0];
    const last = dates[dates.length - 1];
    const toExclusive = addDaysISO(last, 1);
    expect("2026-06-15" >= from).toBe(true);
    expect("2026-06-15" < toExclusive).toBe(true);
  });

  it("mandag peker uke-filter mot inneværende arbeidsuke", () => {
    const monday = new Date("2026-06-15T10:00:00");
    const dates = getCurrentWeekDates(monday);
    expect(dates[0]).toBe("2026-06-15");
    expect(dates.length).toBe(5);
  });
});
