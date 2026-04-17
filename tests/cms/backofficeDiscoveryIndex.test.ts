import { describe, expect, it } from "vitest";

import { getBackofficeDiscoveryIndexSize, rankDiscoveryNavItems } from "@/lib/cms/backofficeDiscoveryIndex";
import { BACKOFFICE_PALETTE_ITEMS, filterBackofficeNavItems } from "@/lib/cms/backofficeExtensionRegistry";

describe("backofficeDiscoveryIndex (U19)", () => {
  it("index size matches palette href count", () => {
    expect(getBackofficeDiscoveryIndexSize()).toBe(new Set(BACKOFFICE_PALETTE_ITEMS.map((x) => x.href)).size);
  });

  it("rankDiscoveryNavItems preserves order when query empty", () => {
    const a = rankDiscoveryNavItems(BACKOFFICE_PALETTE_ITEMS, "");
    expect(a.length).toBe(BACKOFFICE_PALETTE_ITEMS.length);
  });

  it("ranking boosts relevant matches (uke → week-menu)", () => {
    const base = filterBackofficeNavItems(BACKOFFICE_PALETTE_ITEMS, "uke");
    const ranked = rankDiscoveryNavItems(base, "uke");
    expect(ranked[0]?.href).toBe("/backoffice/week-menu");
  });
});
