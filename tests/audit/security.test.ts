import { describe, expect, it } from "vitest";

import { detectSuspicious } from "@/lib/audit/security";

describe("detectSuspicious", () => {
  it("returns null for small samples", () => {
    expect(detectSuspicious(Array.from({ length: 50 }, () => ({})))).toBeNull();
  });

  it("flags high activity over threshold", () => {
    expect(detectSuspicious(Array.from({ length: 51 }, () => ({})))).toBe("high_activity");
  });
});
