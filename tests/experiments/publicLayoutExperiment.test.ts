import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/localRuntime/runtime", () => ({
  isLocalCmsRuntimeEnabled: () => false,
}));

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: () => {
    throw new Error("Missing env: SUPABASE_SERVICE_ROLE_KEY");
  },
}));

vi.mock("@/lib/ops/log", () => ({
  opsLog: vi.fn(),
}));

vi.mock("@/lib/experiments/overlayRunningExperiment", () => ({
  getRunningExperimentAssignmentForPage: vi.fn(),
}));

import { getPublicLayoutExperimentAssignment } from "@/lib/experiments/publicLayoutExperiment";

describe("getPublicLayoutExperimentAssignment", () => {
  it("returns null when admin client cannot be created (no build crash)", async () => {
    await expect(getPublicLayoutExperimentAssignment("/kontakt")).resolves.toBeNull();
  });
});
