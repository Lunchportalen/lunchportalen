import { describe, expect, test } from "vitest";

import { landingForRole, normalizeRole } from "@/lib/auth/role";
import { resolveLoginDestination } from "@/lib/auth/resolveLoginDestination";

describe("normalizeRole", () => {
  test("maps all seven canonical membership/profile roles", () => {
    expect(normalizeRole("superadmin")).toBe("superadmin");
    expect(normalizeRole("company_admin")).toBe("company_admin");
    expect(normalizeRole("employee")).toBe("employee");
    expect(normalizeRole("driver")).toBe("driver");
    expect(normalizeRole("kitchen")).toBe("kitchen");
    expect(normalizeRole("company_finance")).toBe("company_finance");
    expect(normalizeRole("location_admin")).toBe("location_admin");
  });

  test("returns null for unknown input", () => {
    expect(normalizeRole("nope")).toBeNull();
    expect(normalizeRole("")).toBeNull();
    expect(normalizeRole(null)).toBeNull();
  });
});

describe("landingForRole", () => {
  test("returns expected paths for all seven roles", () => {
    expect(landingForRole("superadmin")).toBe("/superadmin");
    expect(landingForRole("company_admin")).toBe("/admin");
    expect(landingForRole("company_finance")).toBe("/admin/insights");
    expect(landingForRole("location_admin")).toBe("/admin/locations");
    expect(landingForRole("employee")).toBe("/week");
    expect(landingForRole("driver")).toBe("/driver");
    expect(landingForRole("kitchen")).toBe("/kitchen");
  });
});

describe("resolveLoginDestination", () => {
  test("company_finance respects agreement gate", () => {
    expect(resolveLoginDestination({ role: "company_finance", hasActiveAgreement: true })).toBe(
      "/admin/insights",
    );
    expect(resolveLoginDestination({ role: "company_finance", hasActiveAgreement: false })).toBe(
      "/avtale-ikke-aktiv",
    );
  });

  test("location_admin respects agreement gate", () => {
    expect(resolveLoginDestination({ role: "location_admin", hasActiveAgreement: true })).toBe(
      "/admin/locations",
    );
    expect(resolveLoginDestination({ role: "location_admin", hasActiveAgreement: false })).toBe(
      "/avtale-ikke-aktiv",
    );
  });
});
