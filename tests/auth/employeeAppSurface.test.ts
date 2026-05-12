import { describe, expect, it } from "vitest";
import { isEmployeeAllowedAppSurfacePath } from "@/lib/auth/employeeAppSurfacePath";

/**
 * Direkte rute-policy for employee (app-shell): /week og /meny er tillatt som hovedflater.
 * Layout bruker `x-pathname` + getAuthContext; her testes ren path-matrise.
 */
describe("employee app surface (path policy)", () => {
  it("allows /week, /meny, and nested routes", () => {
    expect(isEmployeeAllowedAppSurfacePath("/week")).toBe(true);
    expect(isEmployeeAllowedAppSurfacePath("/week/foo")).toBe(true);
    expect(isEmployeeAllowedAppSurfacePath("/meny")).toBe(true);
    expect(isEmployeeAllowedAppSurfacePath("/meny/foo")).toBe(true);
  });

  it("denies other app routes employees must not use as shell surface", () => {
    expect(isEmployeeAllowedAppSurfacePath("/home")).toBe(false);
    expect(isEmployeeAllowedAppSurfacePath("/dashboard")).toBe(false);
    expect(isEmployeeAllowedAppSurfacePath("/orders")).toBe(false);
    expect(isEmployeeAllowedAppSurfacePath("/min-side")).toBe(false);
    expect(isEmployeeAllowedAppSurfacePath("/admin")).toBe(false);
  });

  it("normalizes missing leading slash", () => {
    expect(isEmployeeAllowedAppSurfacePath("week")).toBe(true);
    expect(isEmployeeAllowedAppSurfacePath("meny")).toBe(true);
  });
});
