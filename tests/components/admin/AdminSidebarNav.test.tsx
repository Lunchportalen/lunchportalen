import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

const SIDEBAR_CLIENT_PATH = join(process.cwd(), "app", "admin", "AdminSidebar.client.tsx");

describe("AdminSidebarNav", () => {
  test("Firmadashbord lenker til /admin/firmadashbord uten companyId", () => {
    const source = readFileSync(SIDEBAR_CLIENT_PATH, "utf-8");
    expect(source).toContain('href: "/admin/firmadashbord"');
    expect(source).not.toMatch(/\/admin\/company\/\$\{/);
  });

  test("Firmadashbord-lenke styres av showFirmadashbordLink (ikke companyId-prop)", () => {
    const source = readFileSync(SIDEBAR_CLIENT_PATH, "utf-8");
    expect(source).toContain("showFirmadashbordLink");
    expect(source).not.toContain("buildNavGroups(companyId");
  });
});
