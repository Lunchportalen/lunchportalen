import { describe, expect, test } from "vitest";

import {
  primaryProviderRoleFromMemberships,
  roleHome,
  roleHomePath,
} from "@/lib/auth/roleHome";
import { resolveLoginDestination } from "@/lib/auth/resolveLoginDestination";
import type { ProviderMembership } from "@/lib/providers/types";

function membership(role: ProviderMembership["role"], providerId = "p1"): ProviderMembership {
  return {
    id: `m-${role}`,
    userId: "u1",
    providerId,
    role,
    createdAt: "2026-01-01T00:00:00Z",
  };
}

describe("primaryProviderRoleFromMemberships", () => {
  test("picks highest role in hierarchy", () => {
    expect(
      primaryProviderRoleFromMemberships([
        membership("provider_viewer"),
        membership("provider_kitchen"),
      ]),
    ).toBe("provider_kitchen");
    expect(
      primaryProviderRoleFromMemberships([
        membership("provider_kitchen"),
        membership("provider_admin"),
      ]),
    ).toBe("provider_admin");
  });
});

describe("roleHomePath — provider routing (MP1)", () => {
  test("provider_kitchen → /leverandor/ordrer", () => {
    expect(roleHomePath({ profileRole: "employee", providerRole: "provider_kitchen" })).toBe(
      "/leverandor/ordrer",
    );
  });

  test("provider_admin → /leverandor", () => {
    expect(roleHomePath({ profileRole: "employee", providerRole: "provider_admin" })).toBe(
      "/leverandor",
    );
  });

  test("provider_viewer → /leverandor", () => {
    expect(roleHomePath({ profileRole: "employee", providerRole: "provider_viewer" })).toBe(
      "/leverandor",
    );
  });

  test("superadmin with provider membership → /superadmin", () => {
    expect(
      roleHomePath({
        profileRole: "superadmin",
        providerRole: "provider_admin",
        isPlatformAdmin: true,
      }),
    ).toBe("/superadmin");
  });

  test("provider membership wins over company_admin profile", () => {
    expect(
      roleHomePath({
        profileRole: "company_admin",
        providerRole: "provider_viewer",
        hasActiveAgreement: true,
      }),
    ).toBe("/leverandor");
  });

  test("provider_kitchen wins over company_admin", () => {
    expect(
      roleHomePath({
        profileRole: "company_admin",
        providerRole: "provider_kitchen",
        hasActiveAgreement: true,
      }),
    ).toBe("/leverandor/ordrer");
  });
});

describe("roleHomePath — unchanged company/employee routing", () => {
  test("company_admin with agreement → /admin", () => {
    expect(roleHomePath({ profileRole: "company_admin", hasActiveAgreement: true })).toBe("/admin");
  });

  test("company_admin without agreement → /avtale-ikke-aktiv", () => {
    expect(roleHomePath({ profileRole: "company_admin", hasActiveAgreement: false })).toBe(
      "/avtale-ikke-aktiv",
    );
  });

  test("employee with agreement → /week", () => {
    expect(roleHomePath({ profileRole: "employee", hasActiveAgreement: true })).toBe("/week");
  });

  test("driver → /driver", () => {
    expect(roleHomePath({ profileRole: "driver" })).toBe("/driver");
  });

  test("tenant kitchen → /kitchen", () => {
    expect(roleHomePath({ profileRole: "kitchen" })).toBe("/kitchen");
  });
});

describe("roleHome (sync profile-only)", () => {
  test("legacy aliases still map", () => {
    expect(roleHome("superadmin")).toBe("/superadmin");
    expect(roleHome("company_admin")).toBe("/admin");
    expect(roleHome("employee")).toBe("/week");
  });
});

describe("resolveLoginDestination delegates to roleHomePath", () => {
  test("provider_kitchen via providerRole input", () => {
    expect(
      resolveLoginDestination({
        role: "employee",
        hasActiveAgreement: true,
        providerRole: "provider_kitchen",
      }),
    ).toBe("/leverandor/ordrer");
  });

  test("company_finance agreement gate unchanged", () => {
    expect(resolveLoginDestination({ role: "company_finance", hasActiveAgreement: true })).toBe(
      "/admin/insights",
    );
    expect(resolveLoginDestination({ role: "company_finance", hasActiveAgreement: false })).toBe(
      "/avtale-ikke-aktiv",
    );
  });
});
