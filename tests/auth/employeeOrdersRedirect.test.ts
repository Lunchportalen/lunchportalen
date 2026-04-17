/**
 * app/orders/page: employee skal alltid redirecte til /week (direkte route-atferd).
 */
import { describe, test, expect, vi, beforeEach } from "vitest";

const redirectMock = vi.fn();

vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    redirectMock(url);
    throw new Error(`NEXT_REDIRECT:${url}`);
  },
}));

vi.mock("next/headers", () => ({
  headers: () => new Headers(),
}));

const getScopeMock = vi.fn();

vi.mock("@/lib/auth/scope", () => ({
  getScope: (...args: unknown[]) => getScopeMock(...args),
  ScopeError: class ScopeError extends Error {
    code: string;
    constructor(message: string, _status?: number, code?: string) {
      super(message);
      this.code = code ?? "FORBIDDEN";
    }
  },
}));

vi.mock("@/lib/agreements/requireActiveAgreement", () => ({
  requireActiveAgreement: vi.fn().mockResolvedValue(undefined),
}));

describe("app/orders/page employee", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    redirectMock.mockImplementation((url: string) => {
      throw new Error(`NEXT_REDIRECT:${url}`);
    });
    getScopeMock.mockResolvedValue({
      user_id: "u1",
      email: "e@test.no",
      role: "employee",
      company_id: "c1",
      location_id: "l1",
      is_active: true,
    });
  });

  test("redirects to /week", async () => {
    const mod = await import("@/app/orders/page");
    await expect(mod.default()).rejects.toThrow(/NEXT_REDIRECT/);
    expect(redirectMock).toHaveBeenCalledWith("/week");
  });
});
