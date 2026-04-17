import { describe, expect, test } from "vitest";

import { recordRevenue } from "@/lib/ai/revenueEngine";

describe("revenueEngine", () => {
  test("skips non-positive amounts without calling external systems", async () => {
    const r = await recordRevenue({ amount: 0, type: "REVENUE_EVENT" }, { rid: "test_rid" });
    expect(r.ok).toBe(false);
    expect(r.skipped).toBe(true);
  });
});
