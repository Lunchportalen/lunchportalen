import { describe, expect, it } from "vitest";

import { partitionWindowDaysForSummary } from "@/lib/employee/mineRegistrerteDagerPartition";

describe("partitionWindowDaysForSummary", () => {
  it("skiller i dag og kommende og sorterer kommende stigende", () => {
    const days = [
      { date: "2026-04-17" },
      { date: "2026-04-14" },
      { date: "2026-04-15" },
    ];
    const { today, upcoming } = partitionWindowDaysForSummary(days, "2026-04-15");
    expect(today.map((d) => d.date)).toEqual(["2026-04-15"]);
    expect(upcoming.map((d) => d.date)).toEqual(["2026-04-17"]);
  });
});
