import { describe, expect, test } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("LeverandorDashboardPage locale switcher", () => {
  test("dashboard topbar includes LocaleSwitcher with profile persistence", () => {
    const source = readFileSync(resolve(process.cwd(), "app/leverandor/page.tsx"), "utf8");
    expect(source).toContain("ds-provider-topbar");
    expect(source).toContain("LocaleSwitcher");
    expect(source).toContain("ds-provider-topbar__locale");
    expect(source).toContain("persistProfile");
  });
});
