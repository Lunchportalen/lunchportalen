/**
 * Direkte route-atferd for employee: layout-guard, /orders, /min-side resolution.
 * next/navigation.redirect kastes som NEXT_REDIRECT (samme mønster som backoffice-layout-guard).
 */
import { describe, test, expect, vi, beforeEach } from "vitest";

const redirectMock = vi.fn();
const headersMock = vi.fn();
const getAuthContextMock = vi.fn();

vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    redirectMock(url);
    throw new Error(`NEXT_REDIRECT:${url}`);
  },
}));

vi.mock("next/headers", () => ({
  headers: () => headersMock(),
}));

vi.mock("@/lib/auth/getAuthContext", () => ({
  getAuthContext: () => getAuthContextMock(),
}));

describe("enforceEmployeeWeekOnlyOnAppShell (actual redirect)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    redirectMock.mockImplementation((url: string) => {
      throw new Error(`NEXT_REDIRECT:${url}`);
    });
  });

  test("employee + x-pathname /home → redirect /week", async () => {
    headersMock.mockResolvedValue(new Headers({ "x-pathname": "/home" }));
    getAuthContextMock.mockResolvedValue({ ok: true, role: "employee" });
    const { enforceEmployeeWeekOnlyOnAppShell } = await import("@/lib/auth/employeeAppSurface");
    await expect(enforceEmployeeWeekOnlyOnAppShell()).rejects.toThrow(/NEXT_REDIRECT/);
    expect(redirectMock).toHaveBeenCalledWith("/week");
  });

  test("employee + x-pathname /dashboard → redirect /week", async () => {
    headersMock.mockResolvedValue(new Headers({ "x-pathname": "/dashboard" }));
    getAuthContextMock.mockResolvedValue({ ok: true, role: "employee" });
    const { enforceEmployeeWeekOnlyOnAppShell } = await import("@/lib/auth/employeeAppSurface");
    await expect(enforceEmployeeWeekOnlyOnAppShell()).rejects.toThrow(/NEXT_REDIRECT/);
    expect(redirectMock).toHaveBeenCalledWith("/week");
  });

  test("employee + x-pathname /week → no redirect", async () => {
    headersMock.mockResolvedValue(new Headers({ "x-pathname": "/week" }));
    getAuthContextMock.mockResolvedValue({ ok: true, role: "employee" });
    const { enforceEmployeeWeekOnlyOnAppShell } = await import("@/lib/auth/employeeAppSurface");
    await enforceEmployeeWeekOnlyOnAppShell();
    expect(redirectMock).not.toHaveBeenCalled();
  });

  test("company_admin + /home → no redirect from employee guard", async () => {
    headersMock.mockResolvedValue(new Headers({ "x-pathname": "/home" }));
    getAuthContextMock.mockResolvedValue({ ok: true, role: "company_admin" });
    const { enforceEmployeeWeekOnlyOnAppShell } = await import("@/lib/auth/employeeAppSurface");
    await enforceEmployeeWeekOnlyOnAppShell();
    expect(redirectMock).not.toHaveBeenCalled();
  });
});

describe("min-side + homeForRole", () => {
  test("homeForRole(employee) is /week", async () => {
    const { homeForRole } = await import("@/lib/auth/redirect");
    expect(homeForRole("employee")).toBe("/week");
  });
});
