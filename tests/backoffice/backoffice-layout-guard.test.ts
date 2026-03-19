/**
 * Backoffice layout guard: unauthenticated → redirect to login; wrong role → redirect to role home; superadmin → shell.
 * Proves protection and no crash.
 */
// @ts-nocheck

import { describe, test, expect, vi, beforeEach } from "vitest";
import React from "react";

(global as any).React = React;

const redirectMock = vi.fn();
const getAuthContextMock = vi.fn();
const headersMock = vi.fn();

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

// Minimal shell render for "safe load" — layout returns BackofficeShell with children
vi.mock("@/app/(backoffice)/backoffice/_shell/BackofficeShell", () => ({
  default: ({ children }: { children: React.ReactNode }) => React.createElement("div", { "data-backoffice-shell": "1" }, children),
}));

vi.mock("@/components/auth/BlockedAccess", () => ({
  default: ({ reason }: { reason: string }) => React.createElement("div", { "data-blocked": reason }, "Ingen tilgang"),
}));

describe("Backoffice layout guard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    redirectMock.mockImplementation((url: string) => {
      throw new Error(`NEXT_REDIRECT:${url}`);
    });
    headersMock.mockResolvedValue(new Headers({ "x-url": "http://local/backoffice/content" }));
  });

  test("unauthenticated → redirect to /login?next=... (safe redirect)", async () => {
    getAuthContextMock.mockResolvedValue({ ok: false, reason: "UNAUTHENTICATED" });

    const mod = await import("@/app/(backoffice)/backoffice/layout");
    const Layout = mod.default;

    await expect(Layout({ children: null })).rejects.toThrow(/NEXT_REDIRECT/);
    expect(redirectMock).toHaveBeenCalledTimes(1);
    const [url] = redirectMock.mock.calls[0];
    expect(url).toMatch(/^\/login\?next=/);
    expect(decodeURIComponent(url)).toContain("/backoffice");
  });

  test("unauthenticated with empty headers → redirect with fallback next (no crash)", async () => {
    headersMock.mockResolvedValue(new Headers());
    getAuthContextMock.mockResolvedValue({ ok: false, reason: "UNAUTHENTICATED" });

    const mod = await import("@/app/(backoffice)/backoffice/layout");
    const Layout = mod.default;

    await expect(Layout({ children: null })).rejects.toThrow(/NEXT_REDIRECT/);
    const [url] = redirectMock.mock.calls[0];
    expect(url).toMatch(/^\/login\?next=/);
    expect(decodeURIComponent(url)).toContain("/backoffice/content");
  });

  test("authenticated but not superadmin → redirect to role home (no 403 false negative)", async () => {
    getAuthContextMock.mockResolvedValue({
      ok: true,
      reason: "OK",
      role: "company_admin",
      user: { id: "u1", email: "admin@test.no" },
      company_id: "c1",
      location_id: "l1",
      rid: "rid",
    });

    const mod = await import("@/app/(backoffice)/backoffice/layout");
    const Layout = mod.default;

    await expect(Layout({ children: null })).rejects.toThrow(/NEXT_REDIRECT/);
    expect(redirectMock).toHaveBeenCalledWith("/admin");
  });

  test("authenticated superadmin → renders shell (safe load, no crash)", async () => {
    getAuthContextMock.mockResolvedValue({
      ok: true,
      reason: "OK",
      role: "superadmin",
      user: { id: "u1", email: "super@test.no" },
      company_id: null,
      location_id: null,
      rid: "rid",
    });

    const mod = await import("@/app/(backoffice)/backoffice/layout");
    const Layout = mod.default;

    const result = await Layout({ children: React.createElement("span", null, "child") });
    expect(redirectMock).not.toHaveBeenCalled();
    expect(result).toBeDefined();
    expect(result && typeof result === "object" && "type" in result).toBe(true);
  });

  test("auth ok false with reason NO_PROFILE → BlockedAccess (no redirect to login)", async () => {
    getAuthContextMock.mockResolvedValue({ ok: false, reason: "NO_PROFILE" });

    const mod = await import("@/app/(backoffice)/backoffice/layout");
    const Layout = mod.default;

    const result = await Layout({ children: null });
    expect(redirectMock).not.toHaveBeenCalled();
    expect(result).toBeDefined();
    expect(result?.props?.reason).toBe("NO_PROFILE");
  });
});
