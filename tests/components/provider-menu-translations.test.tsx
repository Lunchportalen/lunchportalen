import { describe, expect, test } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("Provider menu translations page", () => {
  test("explains translations are not employee-live yet via i18n", () => {
    const page = readFileSync(
      resolve("app/leverandor/meny/oversettelser/page.tsx"),
      "utf8",
    );
    const panel = readFileSync(
      resolve("app/leverandor/meny/oversettelser/ProviderMenuTranslationsPanel.tsx"),
      "utf8",
    );

    expect(page).toContain('getTranslations("provider.menu.translationsPage")');
    expect(page).toMatch(/t\("lead"/);
    expect(panel).toContain('useTranslations("provider.menu.translations")');
    expect(panel).toMatch(/t\("introApproved"\)/);
    expect(panel).toMatch(/t\("coverageTitle"\)/);
    expect(panel).toMatch(/menu-translations\/sources/);
    expect(panel).toMatch(/t\("introPartialCoverage"\)/);
    expect(panel).toMatch(/t\("approve"\)/);
    expect(panel).toMatch(/t\("reject"\)/);
    expect(panel).toMatch(/t\("saveDraft"\)/);
    expect(panel).not.toMatch(/automatic AI|AI translation|AI-oversett/i);
    expect(panel).not.toMatch(/employee translations are live/i);
    expect(panel).not.toMatch(/LocaleSwitcher/i);
  });
});
