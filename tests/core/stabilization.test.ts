import { describe, expect, it } from "vitest";

import { AsyncTimeoutError, withRetry, withTimeout } from "@/lib/core/asyncOps";
import { coreError, coreErrorFromUnknown, coreErrorToJson } from "@/lib/core/errors";

describe("lib/core/errors", () => {
  it("builds deterministic CoreError", () => {
    const e = coreError({
      code: "test",
      message: "m",
      source: "unit",
      severity: "medium",
    });
    expect(coreErrorToJson(e)).toEqual({
      code: "test",
      message: "m",
      source: "unit",
      severity: "medium",
    });
  });

  it("maps unknown errors", () => {
    const e = coreErrorFromUnknown("unit", new Error("x"), { code: "c" });
    expect(e.code).toBe("c");
    expect(e.severity).toBe("high");
  });
});

describe("lib/core/asyncOps", () => {
  it("withTimeout rejects slow promises", async () => {
    await expect(
      withTimeout(
        new Promise((r) => setTimeout(() => r(1), 500)),
        20,
        "slow",
      ),
    ).rejects.toBeInstanceOf(AsyncTimeoutError);
  });

  it("withRetry stops after maxAttempts", async () => {
    let n = 0;
    await expect(
      withRetry(
        async () => {
          n += 1;
          throw new Error("fail");
        },
        { maxAttempts: 2, baseDelayMs: 1 },
        () => true,
      ),
    ).rejects.toThrow("fail");
    expect(n).toBe(2);
  });
});
