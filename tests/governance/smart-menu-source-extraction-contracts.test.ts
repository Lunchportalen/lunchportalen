/**
 * SMART-4 — source extraction / locale coverage governance contracts (static).
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";

import {
  isMenuProfileCompatibilityCutoverEnabled,
  isMenuProfileResolverEnabled,
  isMenuProfileRuntimeCompatibilityHookEnabled,
} from "@/lib/menu-profile/featureFlag";

const ROOT = process.cwd();

const SMART4_FILES = [
  "lib/smart-menu/menuTranslationSources.ts",
  "lib/smart-menu/translationCoverage.ts",
  "lib/smart-menu/providerTranslationSources.ts",
  "app/api/provider/menu-translations/sources/route.ts",
] as const;

const FORBIDDEN_RUNTIME_PATHS = [
  "app/api/orders/route.ts",
  "lib/orders/resolveOrderDayItemPersist.ts",
  "lib/orders/orderWriteGuard.ts",
] as const;

function readSource(relPath: string): string {
  return fs.readFileSync(path.join(ROOT, relPath), "utf8");
}

describe("SMART-4 — artifacts exist", () => {
  test("source extraction and coverage modules exist", () => {
    for (const rel of SMART4_FILES) {
      expect(fs.existsSync(path.join(ROOT, rel))).toBe(true);
    }
  });

  test("provider sources API is provider-scoped and read-only by default", () => {
    const src = readSource("app/api/provider/menu-translations/sources/route.ts");
    expect(src).toMatch(/getProviderAdminContext/);
    expect(src).toMatch(/hasProviderRole/);
    expect(src).toMatch(/employeeTranslationsLive:\s*false/);
    expect(src).toMatch(/METHOD_NOT_ALLOWED|405/);
    expect(src).not.toMatch(/requireSanityWrite/);
  });
});

describe("SMART-4 — scope guards", () => {
  test("no order write-path or employee overlay mutation in SMART-4 helpers", () => {
    for (const rel of [
      "lib/smart-menu/menuTranslationSources.ts",
      "lib/smart-menu/translationCoverage.ts",
      "lib/smart-menu/providerTranslationSources.ts",
    ]) {
      const src = readSource(rel);
      expect(src).not.toMatch(/lp_order_set/);
      expect(src).not.toMatch(/\bopenai\b|\banthropic\b|\/api\/ai\//i);
      expect(src).not.toMatch(/requireSanityWrite/);
    }
  });

  test("forbidden Golden Path paths unchanged by SMART-4 source files", () => {
    for (const relPath of FORBIDDEN_RUNTIME_PATHS) {
      const src = readSource(relPath);
      expect(src, `${relPath} must not reference menuTranslationSources`).not.toMatch(
        /menuTranslationSources|translationCoverage/,
      );
    }
  });

  test("LP_MENU_PROFILE_* flags remain default OFF", () => {
    expect(isMenuProfileResolverEnabled({})).toBe(false);
    expect(isMenuProfileCompatibilityCutoverEnabled({})).toBe(false);
    expect(isMenuProfileRuntimeCompatibilityHookEnabled({})).toBe(false);
  });

  test("design doc documents SMART-4 source extraction without claiming full translation", () => {
    const doc = readSource("docs/architecture/smart-menu-language-profile-currency.md");
    expect(doc).toMatch(/SMART-4/);
    expect(doc).toMatch(/source extraction|translation candidates|coverage/i);
    expect(doc).not.toMatch(/No automatic translations are provided/i);
    expect(doc).not.toMatch(/G5d\.8 \/ cutover is active/i);
  });

  test("provider UI exposes coverage QA without AI or auto-approve", () => {
    const panel = readSource("app/leverandor/meny/oversettelser/ProviderMenuTranslationsPanel.tsx");
    expect(panel).toMatch(/menu-translations\/sources/);
    expect(panel).toMatch(/Dekning per språk|Kilder uten godkjent oversettelse/);
    expect(panel).not.toMatch(/auto-approve|AI-oversett|OpenAI/i);
  });
});

describe("SMART-4 — PR #389 remains superseded", () => {
  test("design doc still marks PR #389 as superseded/not merged", () => {
    const doc = readSource("docs/architecture/smart-menu-language-profile-currency.md");
    expect(doc).toMatch(/PR #389/);
    expect(doc).toMatch(/superseded|not merged/i);
  });
});
