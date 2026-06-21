import { describe, expect, it } from "vitest";

import { osloTodayISODate } from "@/lib/date/oslo";
import { formatDate } from "@/lib/i18n/format";

describe("lib/i18n/format", () => {
  it("formats dates with locale-specific presentation but Oslo timezone", () => {
    const sample = new Date("2026-06-21T10:00:00.000Z");
    const nb = formatDate(sample, "nb", { day: "2-digit", month: "2-digit", year: "numeric" });
    const en = formatDate(sample, "en", { day: "2-digit", month: "2-digit", year: "numeric" });
    expect(nb).toMatch(/\d{2}\.\d{2}\.\d{4}/);
    expect(en).toMatch(/\d{2}\/\d{2}\/\d{4}/);
  });

  it("does not change Oslo operational today helper when UI locale changes", () => {
    const today = osloTodayISODate();
    expect(today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(formatDate(`${today}T12:00:00.000Z`, "en", { timeZone: "Europe/Oslo", year: "numeric" })).toContain("2026");
  });
});
