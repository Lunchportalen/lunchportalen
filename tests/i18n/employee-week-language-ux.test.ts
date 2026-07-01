/**
 * PR B — employee /week must not advertise UI locale switching before employee i18n ships.
 */
import fs from "node:fs";
import path from "node:path";

import { describe, expect, test } from "vitest";

const ROOT = process.cwd();

function readSource(relPath: string): string {
  return fs.readFileSync(path.join(ROOT, relPath), "utf8");
}

describe("employee week language UX", () => {
  test("HeaderShell hides LocaleSwitcher for employee nav variant", () => {
    const src = readSource("components/nav/HeaderShell.tsx");
    expect(src).toContain('navVariantKey !== "employee"');
    expect(src).toContain("showLocaleSwitcher");
  });

  test("HeaderShellView renders LocaleSwitcher only when showLocaleSwitcher is true", () => {
    const src = readSource("components/nav/HeaderShellView.tsx");
    expect(src).toContain("showLocaleSwitcher?: boolean");
    expect(src).toMatch(/showLocaleSwitcher\s*\?\s*<LocaleSwitcher/);
  });

  test("EmployeeLayout client shell hides LocaleSwitcher", () => {
    const src = readSource("components/layout/EmployeeLayout.tsx");
    expect(src).toContain("showLocaleSwitcher={false}");
  });

  test("EmployeeWeekClient explains provider-original menu content", () => {
    const src = readSource("app/(app)/week/EmployeeWeekClient.tsx");
    expect(src).toContain("Menyinnhold vises på leverandørens originalspråk");
    expect(src).toContain("Språkvalg for ansatte kommer senere");
    expect(src).not.toMatch(/useTranslations|loadMessagesForLocale/);
  });

  test("provider and admin shells still wire LocaleSwitcher", () => {
    expect(readSource("components/providers/ProviderNav.tsx")).toContain("<LocaleSwitcher");
    expect(readSource("app/admin/AdminTopbar.tsx")).toContain("<LocaleSwitcher");
  });

  test("employee menu APIs still ignore UI locale (no regression)", () => {
    for (const route of ["app/api/order/window/route.ts", "app/api/week/route.ts"]) {
      const src = readSource(route);
      expect(src).not.toMatch(/\blp_locale\b/);
      expect(src).not.toMatch(/\bresolveAppLocale\b/);
    }
  });
});
