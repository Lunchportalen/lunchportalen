import { describe, expect, test } from "vitest";

import { addMonthsIso, isoMonthStartOslo } from "@/lib/esg/osloMonth";

describe("esg osloMonth", () => {
  test("addMonthsIso shifts calendar months", () => {
    expect(addMonthsIso("2026-01-01", -1)).toBe("2025-12-01");
    expect(addMonthsIso("2026-01-01", 11)).toBe("2026-12-01");
  });

  test("isoMonthStartOslo returns YYYY-MM-01", () => {
    const s = isoMonthStartOslo(new Date("2026-03-15T12:00:00Z"));
    expect(s).toMatch(/^\d{4}-\d{2}-01$/);
  });
});
