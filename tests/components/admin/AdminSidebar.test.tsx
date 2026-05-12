import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

const SIDEBAR_CLIENT_PATH = join(process.cwd(), "app", "admin", "AdminSidebar.client.tsx");
const SIDEBAR_PATH = join(process.cwd(), "app", "admin", "AdminSidebar.tsx");
const CSS_PATH = join(process.cwd(), "app", "styles", "ds", "admin-shell.css");

describe("AdminSidebar", () => {
  test("rendrer 7 nav-items", () => {
    const source = readFileSync(SIDEBAR_CLIENT_PATH, "utf-8");
    expect(source.match(/href: "\/admin/g)?.length).toBe(7);
  });

  test("aktiv state er exact for /admin og startsWith for undersider", () => {
    const source = readFileSync(SIDEBAR_CLIENT_PATH, "utf-8");
    expect(source).toContain("if (item.exact) return pathname === item.href");
    expect(source).toContain("pathname.startsWith(`${item.href}/`)");
    expect(source).toContain('aria-current={active ? "page" : undefined}');
  });

  test("brand-mark viser LP", () => {
    const source = readFileSync(SIDEBAR_PATH, "utf-8");
    expect(source).toContain('className="ds-admin-sidebar__mark">LP');
  });

  test("user-avatar viser initialer fra userName", () => {
    const source = readFileSync(SIDEBAR_PATH, "utf-8");
    expect(source).toContain("initialsFromName(userName)");
    expect(source).toContain("slice(0, 2)");
  });

  test("touch targets er minst 44px", () => {
    const css = readFileSync(CSS_PATH, "utf-8");
    expect(css).toContain(".ds-admin-sidebar__item");
    expect(css).toContain("min-height: 44px");
  });
});
