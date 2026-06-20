import { describe, expect, test } from "vitest";

import { isWeekMenuComingSoon } from "@/lib/week/weekMenuReadiness";

describe("weekMenuReadiness", () => {
  test("tom uke med synlige dager → kommer snart", () => {
    const days = [
      { date: "2026-04-06", categories: [], isEnabled: true },
      { date: "2026-04-07", categories: [], isEnabled: true },
    ];
    expect(isWeekMenuComingSoon(days, "2026-04-06")).toBe(true);
  });

  test("minst én dag med kategori → ikke kommer snart", () => {
    const days = [
      { date: "2026-04-06", categories: [], isEnabled: true },
      { date: "2026-04-07", categories: [{ key: "varmrett" }], isEnabled: true },
    ];
    expect(isWeekMenuComingSoon(days, "2026-04-06")).toBe(false);
  });

  test("NO_TIER_FOR_DAY alene → ikke kommer snart", () => {
    const days = [{ date: "2026-04-06", categories: [], reason: "NO_TIER_FOR_DAY" }];
    expect(isWeekMenuComingSoon(days, "2026-04-06")).toBe(false);
  });
});
