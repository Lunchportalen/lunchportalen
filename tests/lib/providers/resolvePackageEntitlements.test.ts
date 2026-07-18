import { describe, expect, it, vi } from "vitest";

import {
  assertChoiceEntitled,
  resolvePackageEntitlements,
} from "@/lib/providers/resolvePackageEntitlements";

function mockAdmin(rows: Array<{ entitlement_key: string; is_enabled: boolean; package_key: string }>) {
  return {
    from() {
      return {
        select() {
          return {
            eq() {
              return {
                eq: async () => ({ data: rows, error: null }),
              };
            },
          };
        },
      };
    },
  } as any;
}

describe("resolvePackageEntitlements", () => {
  it("maps legacy Melhus BASIS rows to canonical orderables", async () => {
    const admin = mockAdmin([
      { package_key: "BASIS", entitlement_key: "menu_category:paasmurt", is_enabled: true },
      { package_key: "BASIS", entitlement_key: "menu_category:salat", is_enabled: true },
      { package_key: "BASIS", entitlement_key: "menu_category:varmrett", is_enabled: true },
      { package_key: "BASIS", entitlement_key: "auto_warm_meal", is_enabled: true },
    ]);
    const res = await resolvePackageEntitlements(admin, {
      providerId: "00000000-0000-4000-8000-000000000001",
      packageKey: "BASIS",
    });
    expect(res.source).toBe("provider_package_entitlements");
    expect(res.orderableCategories.sort()).toEqual(["salad_box", "sandwich", "warm_meal"]);
    expect(() => assertChoiceEntitled(res, "sushi")).toThrow(/PACKAGE_ENTITLEMENT_DENIED/);
  });

  it("falls back to package contract when rows missing and enforcement off", async () => {
    vi.stubEnv("LP_PACKAGE_ENTITLEMENTS_RUNTIME", "");
    const admin = mockAdmin([]);
    const res = await resolvePackageEntitlements(admin, {
      providerId: "00000000-0000-4000-8000-000000000001",
      packageKey: "LUXUS",
    });
    expect(res.source).toBe("package_contract_fallback");
    expect(res.orderableCategories).toContain("sushi");
    vi.unstubAllEnvs();
  });
});
