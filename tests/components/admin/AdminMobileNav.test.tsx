import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

const MOBILE_NAV_PATH = join(process.cwd(), "app", "admin", "AdminMobileNav.tsx");
const CSS_PATH = join(process.cwd(), "app", "styles", "ds", "admin-shell.css");

describe("AdminMobileNav", () => {
  test("rendrer 5 primær-items inkludert Mer", () => {
    const source = readFileSync(MOBILE_NAV_PATH, "utf-8");
    const primaryBlock = source.split("const MORE_ITEMS")[0] ?? "";
    expect(primaryBlock.match(/href: "\/admin/g)?.length).toBe(4);
    expect(source).toContain('<span>Mer</span>');
  });

  test("skjules over 980px", () => {
    const css = readFileSync(CSS_PATH, "utf-8");
    expect(css).toContain("@media (min-width: 980px)");
    expect(css).toMatch(/\.ds-admin-mobile-nav\s*\{\s*display:\s*none;/);
  });

  test("Mer-knappen åpner overlay med resterende items", () => {
    const source = readFileSync(MOBILE_NAV_PATH, "utf-8");
    expect(source).toContain("setOpen(true)");
    expect(source).toContain("Lokasjoner");
    expect(source).toContain("Avtale");
    expect(source).toContain("Faktura");
    expect(source).toContain('<dialog className="ds-admin-more"');
  });
});
