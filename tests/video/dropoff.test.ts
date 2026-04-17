import { describe, expect, test } from "vitest";

import { detectDropOff } from "@/lib/video/dropoff";

describe("detectDropOff", () => {
  test("svak hook først", () => {
    expect(detectDropOff({ hookRetention: 30, completionRate: 50 })).toBe("weak_hook");
  });

  test("svak historie når hook OK", () => {
    expect(detectDropOff({ hookRetention: 50, completionRate: 10 })).toBe("weak_story");
  });

  test("null når begge over terskel", () => {
    expect(detectDropOff({ hookRetention: 50, completionRate: 25 })).toBe(null);
  });
});
