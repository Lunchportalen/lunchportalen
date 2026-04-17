import { describe, expect, it, vi } from "vitest";

const readSystemSettingsBaselineMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/system/settings", () => ({
  readSystemSettingsBaseline: (...args: unknown[]) => readSystemSettingsBaselineMock(...args),
}));

import { getSettings } from "@/lib/settings/getSettings";

describe("getSettings", () => {
  it("returns fail-closed settings even when baseline is degraded", async () => {
    readSystemSettingsBaselineMock.mockResolvedValue({
      settings: { featureFlags: { ai: false }, posture: "fail_closed" },
      baseline: { status: "row_missing" },
    });

    const result = await getSettings({} as never);

    expect(result).toEqual({
      featureFlags: { ai: false },
      posture: "fail_closed",
    });
  });
});
