import { describe, expect, test } from "vitest";

import { activityIconKind } from "@/components/provider/tripletex-status/activityIconKind";

describe("activityIconKind (TPT-B-7c polish-7)", () => {
  test("finalized → success", () => {
    expect(activityIconKind("tripletex_onboarding_finalized")).toBe("success");
  });

  test("customer skipped → warn", () => {
    expect(activityIconKind("tripletex_onboarding_customer_skipped")).toBe("warn");
  });

  test("disconnected → error", () => {
    expect(activityIconKind("tripletex_onboarding_disconnected")).toBe("error");
  });

  test("state change to DEGRADED → warn", () => {
    expect(activityIconKind("tripletex_connection_state_change", { new_state: "DEGRADED" })).toBe("warn");
  });
});
