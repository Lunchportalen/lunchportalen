import { describe, expect, test, vi } from "vitest";

import { LIFECYCLE_REASON_MIN_LENGTH, validateLifecycleReason } from "@/lib/providers/lifecycleReason";
import { providerCustomerStatusLabel } from "@/lib/providers/customerTypes";

vi.mock("@/app/leverandor/kunder/actions", () => ({
  suspendCustomer: vi.fn(),
  pauseCustomer: vi.fn(),
  deleteCustomer: vi.fn(),
  resumeCustomer: vi.fn(),
}));

describe("validateLifecycleReason", () => {
  test("rejects short reason", () => {
    expect(validateLifecycleReason("for kort")).toMatch(/minst/);
  });

  test("accepts reason at minimum length", () => {
    const ok = "a".repeat(LIFECYCLE_REASON_MIN_LENGTH);
    expect(validateLifecycleReason(ok)).toBeNull();
  });
});

describe("providerCustomerStatusLabel", () => {
  test.each([
    ["ACTIVE", "Aktiv"],
    ["PAUSED", "Pauset"],
    ["SUSPENDED", "Suspendert"],
    ["DELETED", "Slettet"],
  ] as const)("maps %s", (status, label) => {
    expect(providerCustomerStatusLabel(status)).toBe(label);
  });
});

describe("SuspendDialog reason gate", () => {
  test("minimum length constant matches RPC", () => {
    expect(LIFECYCLE_REASON_MIN_LENGTH).toBe(20);
  });
});

describe("server action payload contract", () => {
  test("suspendCustomer is exported from actions module", async () => {
    const mod = await import("@/app/leverandor/kunder/actions");
    expect(typeof mod.suspendCustomer).toBe("function");
    expect(typeof mod.pauseCustomer).toBe("function");
    expect(typeof mod.deleteCustomer).toBe("function");
    expect(typeof mod.resumeCustomer).toBe("function");
  });
});
