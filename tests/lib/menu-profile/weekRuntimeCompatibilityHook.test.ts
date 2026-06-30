/**
 * G5d.7c — Preview /week runtime compatibility hook boundary tests.
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, test, vi, beforeEach } from "vitest";

import {
  LP_MENU_PROFILE_RUNTIME_COMPATIBILITY_HOOK_ENV,
  isMenuProfileRuntimeCompatibilityHookEnabled,
} from "@/lib/menu-profile/featureFlag";
import {
  G5D7C_WEEK_HOOK_BOUNDARY_PATH,
  maybeRunWeekRuntimeCompatibilityHook,
} from "@/lib/menu-profile/weekRuntimeCompatibilityHook.server";
import * as resolver from "@/lib/menu-profile/weekRuntimeCompatibilityResolver.server";

const ROOT = process.cwd();
const HOOK_HELPER = "lib/menu-profile/weekRuntimeCompatibilityHook.server.ts";

const opsLogMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/ops/log", () => ({ opsLog: opsLogMock }));

describe("G5d.7c — LP_MENU_PROFILE_RUNTIME_COMPATIBILITY_HOOK flag helper", () => {
  test("defaults to false", () => {
    expect(isMenuProfileRuntimeCompatibilityHookEnabled({})).toBe(false);
    expect(
      isMenuProfileRuntimeCompatibilityHookEnabled({
        [LP_MENU_PROFILE_RUNTIME_COMPATIBILITY_HOOK_ENV]: undefined,
      }),
    ).toBe(false);
  });

  test('is true only for exact "true"', () => {
    expect(
      isMenuProfileRuntimeCompatibilityHookEnabled({
        [LP_MENU_PROFILE_RUNTIME_COMPATIBILITY_HOOK_ENV]: "true",
      }),
    ).toBe(true);
    expect(
      isMenuProfileRuntimeCompatibilityHookEnabled({
        [LP_MENU_PROFILE_RUNTIME_COMPATIBILITY_HOOK_ENV]: "true\r\n",
      }),
    ).toBe(true);
  });

  test("is false for non-true values", () => {
    for (const value of ["", "false", "1", "yes", "TRUE", "on"]) {
      expect(
        isMenuProfileRuntimeCompatibilityHookEnabled({
          [LP_MENU_PROFILE_RUNTIME_COMPATIBILITY_HOOK_ENV]: value,
        }),
      ).toBe(false);
    }
  });

  test("LP_MENU_PROFILE_EMPLOYEE_PROFILE_RUNTIME is not implemented in featureFlag.ts", () => {
    const src = fs.readFileSync(path.join(ROOT, "lib/menu-profile/featureFlag.ts"), "utf8");
    expect(src).not.toContain("LP_MENU_PROFILE_EMPLOYEE_PROFILE_RUNTIME");
    expect(src).not.toContain("isMenuProfileEmployeeProfileRuntimeEnabled");
  });
});

describe("G5d.7c — hook boundary server-only / imports", () => {
  test("hook helper starts with import server-only", () => {
    const src = fs.readFileSync(path.join(ROOT, HOOK_HELPER), "utf8");
    expect(src).toMatch(/^import\s+["']server-only["'];/m);
  });

  test("hook helper imports adapter only from canonical resolver path", () => {
    const src = fs.readFileSync(path.join(ROOT, HOOK_HELPER), "utf8");
    expect(src).toContain("weekRuntimeCompatibilityResolver.server");
    expect(src).not.toMatch(/from\s+["']@\/app\/api\/week/);
    expect(src).not.toMatch(/from\s+["']@\/lib\/week/);
    expect(src).not.toMatch(/\bfetch\s*\(/);
    expect(src).not.toMatch(/\.insert\s*\(|\.delete\s*\(|\.upsert\s*\(/);
  });

  test("boundary path constant points to week route", () => {
    expect(G5D7C_WEEK_HOOK_BOUNDARY_PATH).toBe("app/api/week/route.ts");
  });
});

describe("G5d.7c — hook boundary behavior", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("flag OFF is no-op and does not call adapter", () => {
    const spy = vi.spyOn(resolver, "buildWeekRuntimeCompatibilityDecision");
    maybeRunWeekRuntimeCompatibilityHook({
      currentDays: [{ dateISO: "2026-06-16" }],
      rid: "rid_off",
      env: {},
    });
    expect(spy).not.toHaveBeenCalled();
    expect(opsLogMock).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  test("flag ON calls adapter and logs safe observability only", () => {
    const spy = vi.spyOn(resolver, "buildWeekRuntimeCompatibilityDecision");
    maybeRunWeekRuntimeCompatibilityHook({
      currentDays: [{ dateISO: "2026-06-16" }],
      rid: "rid_on",
      env: { [LP_MENU_PROFILE_RUNTIME_COMPATIBILITY_HOOK_ENV]: "true" },
    });
    expect(spy).toHaveBeenCalledTimes(1);
    const decision = spy.mock.results[0]?.value;
    expect(decision.selectedSource).toBe("current");
    expect(decision.candidateOrderable).toBe(false);
    expect(decision.sourceOfTruthChanged).toBe(false);
    expect(decision.autoRollout).toBe(false);
    expect(opsLogMock).toHaveBeenCalledWith(
      "week.runtimeCompatibilityHook",
      expect.objectContaining({
        rid: "rid_on",
        boundary: "app/api/week/route.ts",
        selectedSource: "current",
        fallbackToCurrent: true,
        candidateOrderable: false,
        sourceOfTruthChanged: false,
      }),
    );
    spy.mockRestore();
  });
});
