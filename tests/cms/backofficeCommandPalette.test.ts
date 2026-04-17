import { describe, expect, test } from "vitest";
import {
  BACKOFFICE_NAV_ITEMS,
  BACKOFFICE_PALETTE_ITEMS,
  filterBackofficeNavItems,
  groupFilteredBackofficeNavItems,
} from "@/lib/cms/backofficeExtensionRegistry";

describe("CP10 — backoffice command palette filter", () => {
  test("filterBackofficeNavItems returns all when query empty (palette)", () => {
    expect(filterBackofficeNavItems(BACKOFFICE_PALETTE_ITEMS, "").length).toBe(BACKOFFICE_PALETTE_ITEMS.length);
    expect(filterBackofficeNavItems(BACKOFFICE_PALETTE_ITEMS, "   ").length).toBe(BACKOFFICE_PALETTE_ITEMS.length);
  });

  test("filterBackofficeNavItems matches label", () => {
    const r = filterBackofficeNavItems(BACKOFFICE_PALETTE_ITEMS, "content");
    expect(r.some((x) => x.href === "/backoffice/content")).toBe(true);
  });

  test("filterBackofficeNavItems matches path segment", () => {
    const r = filterBackofficeNavItems(BACKOFFICE_PALETTE_ITEMS, "week-menu");
    expect(r.some((x) => x.href === "/backoffice/week-menu")).toBe(true);
  });

  test("CP11 — every nav item has groupId", () => {
    for (const it of BACKOFFICE_NAV_ITEMS) {
      expect(it.groupId).toBeTruthy();
    }
  });

  test("CP11 — groupFilteredBackofficeNavItems covers all filtered items (group order ≠ flat list order)", () => {
    const filtered = filterBackofficeNavItems(BACKOFFICE_PALETTE_ITEMS, "");
    const grouped = groupFilteredBackofficeNavItems(filtered);
    const flat = grouped.flatMap((g) => g.items);
    expect(flat.length).toBe(filtered.length);
    expect(new Set(flat.map((x) => x.href))).toEqual(new Set(filtered.map((x) => x.href)));
  });

  test("CP12 — palette includes discovery extras without dup href", () => {
    expect(BACKOFFICE_PALETTE_ITEMS.length).toBeGreaterThan(BACKOFFICE_NAV_ITEMS.length);
    const hrefs = BACKOFFICE_PALETTE_ITEMS.map((x) => x.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
    expect(hrefs).toContain("/backoffice/content/recycle-bin");
    expect(hrefs).toContain("/backoffice/control-tower");
  });
});
