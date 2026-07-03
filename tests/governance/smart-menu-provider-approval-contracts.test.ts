/**
 * SMART-2 — provider translation approval governance contracts (static).
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";

import {
  isMenuProfileCompatibilityCutoverEnabled,
  isMenuProfileResolverEnabled,
  isMenuProfileRuntimeCompatibilityHookEnabled,
} from "@/lib/menu-profile/featureFlag";
import {
  isEmployeeVisibleTranslation,
  isNonEmployeeVisibleStatus,
} from "@/lib/smart-menu/translationStatus";

const ROOT = process.cwd();
const DESIGN_DOC = "docs/architecture/smart-menu-language-profile-currency.md";
const API_LIST = "app/api/provider/menu-translations/route.ts";
const API_ITEM = "app/api/provider/menu-translations/[id]/route.ts";
const UI_PAGE = "app/leverandor/meny/oversettelser/page.tsx";
const UI_PANEL = "app/leverandor/meny/oversettelser/ProviderMenuTranslationsPanel.tsx";
const HELPER = "lib/smart-menu/providerTranslationApproval.ts";

const FORBIDDEN_RUNTIME_PATHS = [
  "app/(app)/week/EmployeeWeekClient.tsx",
  "app/api/order/window/route.ts",
  "app/api/week/route.ts",
  "app/api/orders/route.ts",
  "lib/orders/orderWriteGuard.ts",
  "lib/orders/resolveOrderDayItemPersist.ts",
  "lib/menu-publish/tierPricing.ts",
  "lib/provider-menu/menuDayPayload.ts",
  "lib/provider-menu/varmrettSharedWrite.ts",
] as const;

const SECRET_PATTERNS = [
  /password\s*=\s*[^\s\n]+/i,
  /access_token\s*=\s*[^\s\n]+/i,
  /postgresql:\/\/[^\s\n]+:[^\s\n]+@/i,
] as const;

function readSource(relPath: string): string {
  return fs.readFileSync(path.join(ROOT, relPath), "utf8");
}

describe("SMART-2 — provider approval artifacts exist", () => {
  test("API, helper, and UI files exist", () => {
    for (const rel of [API_LIST, API_ITEM, HELPER, UI_PAGE, UI_PANEL]) {
      expect(fs.existsSync(path.join(ROOT, rel))).toBe(true);
    }
  });

  test("API routes are provider-scoped and fail-closed on auth", () => {
    const list = readSource(API_LIST);
    const item = readSource(API_ITEM);
    for (const src of [list, item]) {
      expect(src).toMatch(/getProviderAdminContext/);
      expect(src).toMatch(/hasProviderRole/);
      expect(src).toMatch(/employeeTranslationsLive:\s*false/);
    }
    expect(list).toMatch(/provider_admin/);
    expect(item).toMatch(/METHOD_NOT_ALLOWED|405/);
  });
});

describe("SMART-2 — employee runtime not wired", () => {
  test("forbidden Golden Path paths still do not reference menu_content_translations", () => {
    for (const relPath of FORBIDDEN_RUNTIME_PATHS) {
      const src = readSource(relPath);
      expect(src, `${relPath} must not reference menu_content_translations`).not.toMatch(
        /menu_content_translations/,
      );
    }
  });

  test("helper and UI do not claim employee translations are live", () => {
    const helper = readSource(HELPER);
    const panel = readSource(UI_PANEL);
    const page = readSource(UI_PAGE);
    expect(helper).toMatch(/employeeVisible:\s*false/);
    expect(panel).toMatch(/godkjente oversettelser/i);
    expect(panel).toMatch(/menu-translations\/sources/);
    expect(panel).not.toMatch(/employee translations are live/i);
    expect(page).not.toMatch(/employee translations are live/i);
  });

  test("draft/suggested/rejected/stale remain non-employee-visible", () => {
    for (const status of ["draft", "suggested", "rejected", "stale"] as const) {
      expect(isNonEmployeeVisibleStatus(status)).toBe(true);
      expect(isEmployeeVisibleTranslation(status, true)).toBe(false);
    }
  });
});

describe("SMART-2 — scope guards", () => {
  test("no Sanity mutation or AI in SMART-2 helper/API", () => {
    const helper = readSource(HELPER);
    const list = readSource(API_LIST);
    for (const src of [helper, list]) {
      expect(src).not.toMatch(/requireSanityWrite|@\/lib\/sanity/);
      expect(src).not.toMatch(/\bopenai\b|\banthropic\b|\/api\/ai\//i);
    }
  });

  test("LP_MENU_PROFILE_* flags remain default OFF", () => {
    expect(isMenuProfileResolverEnabled({})).toBe(false);
    expect(isMenuProfileCompatibilityCutoverEnabled({})).toBe(false);
    expect(isMenuProfileRuntimeCompatibilityHookEnabled({})).toBe(false);
  });

  test("design doc documents SMART-2 provider scope without claiming all employee menu is translated", () => {
    const doc = readSource(DESIGN_DOC);
    expect(doc).toMatch(/SMART-2/);
    expect(doc).toMatch(/SMART-3/);
    expect(doc).not.toMatch(/employee translations are live/i);
    expect(doc).toMatch(/No claim that all menu text is always translated/i);
  });

  test("PR #389 remains superseded in design doc", () => {
    const doc = readSource(DESIGN_DOC);
    expect(doc).toMatch(/PR #389/);
    expect(doc).toMatch(/superseded|Superseded/i);
  });

  test("SMART-2 sources contain no obvious secrets", () => {
    for (const rel of [API_LIST, API_ITEM, HELPER, UI_PAGE, UI_PANEL, DESIGN_DOC]) {
      const src = readSource(rel);
      for (const pattern of SECRET_PATTERNS) {
        expect(src, rel).not.toMatch(pattern);
      }
    }
  });
});
