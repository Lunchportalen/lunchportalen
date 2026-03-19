// tests/statusPageHelpers.test.ts
// @ts-nocheck
import { describe, test, expect } from "vitest";

import {
  safeState,
  normalizePath,
  sanitizeNextForDisplay,
  safeNextFallback,
  primaryHref,
} from "@/app/status/page";

describe("status page helpers – safeState", () => {
  test("maps known raw states to normalized StatusState", () => {
    expect(safeState("closed")).toBe("closed");
    expect(safeState("pending")).toBe("pending");
    expect(safeState("inactive")).toBe("inactive");
    expect(safeState("missing_agreement")).toBe("missing_agreement");
    expect(safeState("missing-agreement")).toBe("missing_agreement");
    expect(safeState("no_contract")).toBe("missing_agreement");
    expect(safeState("no-contract")).toBe("missing_agreement");
    expect(safeState("hold")).toBe("hold");
    expect(safeState("billing_hold")).toBe("hold");
    expect(safeState("billing-hold")).toBe("hold");
    expect(safeState("blocked")).toBe("blocked");
    expect(safeState("paused")).toBe("paused");
  });

  test("defaults to blocked for unknown or empty values (fail-closed)", () => {
    expect(safeState("unknown-state")).toBe("blocked");
    expect(safeState("")).toBe("blocked");
    expect(safeState(null)).toBe("blocked");
  });
});

describe("status page helpers – normalizePath", () => {
  test("returns null for falsy or empty input", () => {
    expect(normalizePath(null)).toBeNull();
    expect(normalizePath("")).toBeNull();
    expect(normalizePath("   ")).toBeNull();
  });

  test("rejects paths that do not start with single leading slash", () => {
    expect(normalizePath("orders")).toBeNull();
    expect(normalizePath("http://evil.test")).toBeNull();
    expect(normalizePath("//evil")).toBeNull();
  });

  test("rejects control characters and /api/* jumps", () => {
    expect(normalizePath("/good\nbad")).toBeNull();
    expect(normalizePath("/api/orders")).toBeNull();
  });

  test("rejects login/onboarding/auth loop targets and raw /orders surface", () => {
    const blocked = [
      "/login",
      "/login/foo",
      "/register",
      "/register/x",
      "/registrering",
      "/registrering/foo",
      "/forgot-password",
      "/forgot-password/x",
      "/reset-password",
      "/reset-password/x",
      "/onboarding",
      "/onboarding/step",
      "/orders",
      "/orders/today",
    ];
    for (const p of blocked) {
      expect(normalizePath(p)).toBeNull();
    }
  });

  test("accepts safe app paths", () => {
    expect(normalizePath("/week")).toBe("/week");
    expect(normalizePath("/admin")).toBe("/admin");
    expect(normalizePath("/admin/orders")).toBe("/admin/orders");
    expect(normalizePath("/superadmin/system")).toBe("/superadmin/system");
  });
});

describe("status page helpers – sanitizeNextForDisplay", () => {
  test("returns null when nextPath is null", () => {
    expect(sanitizeNextForDisplay(null)).toBeNull();
  });

  test("rewrites /superadmin* to /admin for public UX", () => {
    expect(sanitizeNextForDisplay("/superadmin")).toBe("/admin");
    expect(sanitizeNextForDisplay("/superadmin/system")).toBe("/admin");
  });

  test("keeps non-superadmin paths as-is", () => {
    expect(sanitizeNextForDisplay("/admin")).toBe("/admin");
    expect(sanitizeNextForDisplay("/week")).toBe("/week");
  });
});

describe("status page helpers – safeNextFallback + primaryHref", () => {
  test("safeNextFallback always returns a sane app path", () => {
    expect(safeNextFallback(null)).toBe("/week");
    expect(safeNextFallback("/week")).toBe("/week");
  });

  test("primaryHref always goes through /api/auth/post-login with encoded next", () => {
    const href = primaryHref("/admin");
    expect(href).toBe("/api/auth/post-login?next=%2Fadmin");

    const fallbackHref = primaryHref(null);
    expect(fallbackHref).toBe("/api/auth/post-login?next=%2Fweek");
  });
});
