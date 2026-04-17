import { describe, expect, test } from "vitest";

import { decideRevenueActions } from "@/lib/ai/revenue/decisionEngine";

describe("decideRevenueActions", () => {
  test("maps low scroll to design actions", () => {
    const actions = decideRevenueActions([
      {
        issue: "low_scroll_depth",
        evidence: "test",
        metrics: { avgScrollPct: 30 },
      },
    ]);
    expect(actions.some((a) => a.type === "design" && a.target === "spacing.section")).toBe(true);
  });
});
