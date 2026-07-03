/**
 * PR B → SMART-3 — employee /week language UX with approved translation overlay.
 */
import fs from "node:fs";
import path from "node:path";

import { describe, expect, test } from "vitest";

const ROOT = process.cwd();

function readSource(relPath: string): string {
  return fs.readFileSync(path.join(ROOT, relPath), "utf8");
}

describe("employee week language UX", () => {
  test("HeaderShell enables LocaleSwitcher for employee nav variant (SMART-3)", () => {
    const src = readSource("components/nav/HeaderShell.tsx");
    expect(src).toMatch(/showLocaleSwitcher\s*=\s*true/);
    expect(src).toContain("showLocaleSwitcher");
  });

  test("HeaderShellView renders LocaleSwitcher only when showLocaleSwitcher is true", () => {
    const src = readSource("components/nav/HeaderShellView.tsx");
    expect(src).toContain("showLocaleSwitcher?: boolean");
    expect(src).toMatch(/showLocaleSwitcher\s*\?\s*<LocaleSwitcher/);
  });

  test("EmployeeLayout client shell enables LocaleSwitcher", () => {
    const src = readSource("components/layout/EmployeeLayout.tsx");
    expect(src).toContain("showLocaleSwitcher={true}");
  });

  test("EmployeeWeekClient explains approved translation behavior honestly", () => {
    const src = readSource("app/(app)/week/EmployeeWeekClient.tsx");
    expect(src).toMatch(/godkjente menytekster/i);
    expect(src).toMatch(/Originaltekst vises ellers/i);
    expect(src).not.toMatch(/useTranslations|loadMessagesForLocale/);
  });

  test("provider and admin shells still wire LocaleSwitcher", () => {
    expect(readSource("components/providers/ProviderNav.tsx")).toContain("<LocaleSwitcher");
    expect(readSource("app/admin/AdminTopbar.tsx")).toContain("<LocaleSwitcher");
  });

  test("order/window uses display locale via SMART-3 overlay — week/orders unchanged", () => {
    const windowSrc = readSource("app/api/order/window/route.ts");
    expect(windowSrc).toContain("overlayApprovedTranslationsOnOrderWindowDays");
    for (const route of ["app/api/week/route.ts"]) {
      const src = readSource(route);
      expect(src).not.toMatch(/\blp_locale\b/);
      expect(src).not.toMatch(/\bresolveAppLocale\b/);
    }
  });
});
