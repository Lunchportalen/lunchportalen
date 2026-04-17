import { describe, expect, test } from "vitest";

import { CONTROL_ACTIONS, isRegisteredControlAction } from "@/lib/ai/controlTower/actionRegistry";

describe("control tower registry", () => {
  test("all actions are registered and discoverable", () => {
    for (const v of Object.values(CONTROL_ACTIONS)) {
      expect(isRegisteredControlAction(v)).toBe(true);
    }
    expect(isRegisteredControlAction("nope")).toBe(false);
  });
});
