import { describe, expect, it } from "vitest";

import {
  entityRowsForDiscoveryPalette,
  mergeDiscoveryPaletteItems,
  type DiscoveryEntityBundle,
} from "@/lib/cms/backofficeDiscoveryEntities";
import type { BackofficeNavItem } from "@/lib/cms/backofficeExtensionRegistry";

const sampleBundle: DiscoveryEntityBundle = {
  contentPages: [
    { id: "p1", title: "Forside", slug: "forside", status: "published", updated_at: null },
  ],
  mediaItems: [
    {
      id: "m1",
      alt: "Kantine",
      url: "https://cdn.example.com/a/b/photo.jpg",
      status: "ready",
      source: "upload",
      created_at: "2026-01-01T00:00:00.000Z",
    },
  ],
};

describe("backofficeDiscoveryEntities (U20)", () => {
  it("returns no entities when query empty", () => {
    expect(entityRowsForDiscoveryPalette(sampleBundle, "")).toEqual([]);
  });

  it("matches content page by title", () => {
    const rows = entityRowsForDiscoveryPalette(sampleBundle, "forside");
    expect(rows.length).toBe(1);
    expect(rows[0]?.href).toBe("/backoffice/content/p1");
    expect(rows[0]?.extensionId).toContain("u20.entity.content_page");
  });

  it("matches media by alt", () => {
    const rows = entityRowsForDiscoveryPalette(sampleBundle, "kantine");
    expect(rows.length).toBe(1);
    expect(rows[0]?.href).toContain("/backoffice/media?u20id=");
    expect(rows[0]?.extensionId).toContain("u20.entity.media");
  });

  it("mergeDiscoveryPaletteItems appends entities", () => {
    const nav: BackofficeNavItem[] = [
      { label: "Content", href: "/backoffice/content", iconName: "content", groupId: "content" },
    ];
    const entities: BackofficeNavItem[] = [
      {
        label: "Side · X",
        href: "/backoffice/content/p1",
        iconName: "content",
        groupId: "content",
        extensionId: "u20.entity.content_page.p1",
      },
    ];
    const merged = mergeDiscoveryPaletteItems(nav, entities);
    expect(merged.length).toBe(2);
  });
});
