import { describe, it, expect } from "vitest";

import { formatCompanyOperativeHistoryWhenNb } from "@/lib/server/admin/loadCompanyOperativeRecentHistory";

describe("formatCompanyOperativeHistoryWhenNb", () => {
  it("returnerer dato og klokkeslett for gyldig ISO", () => {
    const s = formatCompanyOperativeHistoryWhenNb("2026-04-13T14:30:00.000Z");
    expect(s).toContain("2026");
    expect(s).toContain("kl.");
    expect(s).toMatch(/\d{2}:\d{2}/);
  });

  it("tåler tom streng", () => {
    expect(formatCompanyOperativeHistoryWhenNb("")).toBe("—");
  });
});
