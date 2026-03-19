/**
 * buildCmsPageMetadata — deterministic metadata from body.meta + page title + slug.
 * Ensures defaults/fallbacks when meta is empty and editor-set values flow to public output.
 */
import { describe, test, expect } from "vitest";
import { buildCmsPageMetadata } from "@/lib/cms/public/cmsPageMetadata";

describe("buildCmsPageMetadata", () => {
  test("uses page title and slug when body has no meta", () => {
    const meta = buildCmsPageMetadata({
      pageTitle: "Min side",
      slug: "min-side",
      body: { blocks: [] },
    });
    expect(meta.title).toBe("Min side – Lunchportalen");
    expect(meta.description).toBeUndefined();
    expect(meta.alternates?.canonical).toMatch(/lunchportalen\.no\/min-side/);
    expect(meta.robots).toEqual({ index: true, follow: true });
    expect(meta.openGraph?.title).toBe("Min side");
    expect(meta.openGraph?.url).toMatch(/min-side/);
  });

  test("uses body.meta.seo when present", () => {
    const meta = buildCmsPageMetadata({
      pageTitle: "Page",
      slug: "slug",
      body: {
        blocks: [],
        meta: {
          seo: {
            title: "SEO-tittel",
            description: "Meta-beskrivelse for søk.",
            canonical: "https://example.com/custom",
            noIndex: true,
            noFollow: false,
            ogImage: "/images/og.jpg",
          },
        },
      },
    });
    expect(meta.title).toBe("SEO-tittel – Lunchportalen");
    expect(meta.description).toBe("Meta-beskrivelse for søk.");
    expect(meta.alternates?.canonical).toMatch(/example\.com\/custom/);
    expect(meta.robots).toEqual({ index: false, follow: true });
    expect(meta.openGraph?.images).toHaveLength(1);
    expect(meta.openGraph?.images?.[0].url).toMatch(/lunchportalen\.no\/images\/og/);
  });

  test("uses body.meta.social for OG title/description override", () => {
    const meta = buildCmsPageMetadata({
      pageTitle: "Page",
      slug: "s",
      body: {
        blocks: [],
        meta: {
          seo: { title: "SEO", description: "Desc" },
          social: { title: "Delings-tittel", description: "Delings-beskrivelse" },
        },
      },
    });
    expect(meta.openGraph?.title).toBe("Delings-tittel");
    expect(meta.openGraph?.description).toBe("Delings-beskrivelse");
    expect(meta.twitter?.title).toBe("Delings-tittel");
    expect(meta.twitter?.description).toBe("Delings-beskrivelse");
  });

  test("fallback when pageTitle is null and no seo title", () => {
    const meta = buildCmsPageMetadata({
      pageTitle: null,
      slug: "s",
      body: {},
    });
    expect(meta.title).toBe("Lunchportalen");
    expect(meta.openGraph?.title).toBe("Lunchportalen");
  });

  test("no duplicate suffix when seo title already contains Lunchportalen", () => {
    const meta = buildCmsPageMetadata({
      pageTitle: "Lunchportalen",
      slug: "s",
      body: { meta: { seo: { title: "Lunchportalen" } } },
    });
    expect(meta.title).toBe("Lunchportalen");
  });

  test("no duplicate suffix when seo title contains en-dash", () => {
    const meta = buildCmsPageMetadata({
      pageTitle: "Foo – Bar",
      slug: "s",
      body: {},
    });
    expect(meta.title).toBe("Foo – Bar");
  });

  test("canonical path when override is path not full URL", () => {
    const meta = buildCmsPageMetadata({
      pageTitle: "P",
      slug: "x",
      body: { meta: { seo: { canonical: "/other-path" } } },
    });
    expect(meta.alternates?.canonical).toMatch(/lunchportalen\.no\/other-path/);
  });

  test("empty body or non-object body yields defaults", () => {
    const meta1 = buildCmsPageMetadata({ pageTitle: "T", slug: "s", body: null });
    expect(meta1.title).toBe("T – Lunchportalen");
    expect(meta1.robots).toEqual({ index: true, follow: true });

    const meta2 = buildCmsPageMetadata({ pageTitle: "T", slug: "s", body: [] });
    expect(meta2.title).toBe("T – Lunchportalen");
  });

  test("SEO fields persist when body is envelope with blocks and meta.seo (round-trip shape)", () => {
    const body = {
      version: 1,
      blocks: [],
      meta: {
        seo: {
          title: "Lagret SEO-tittel",
          description: "Lagret beskrivelse",
          noIndex: true,
        },
        social: { title: "Delings-tittel" },
      },
    };
    const meta = buildCmsPageMetadata({
      pageTitle: "Side",
      slug: "side",
      body,
    });
    expect(meta.title).toBe("Lagret SEO-tittel – Lunchportalen");
    expect(meta.description).toBe("Lagret beskrivelse");
    const robots = meta.robots as { index?: boolean } | undefined;
    expect(robots?.index).toBe(false);
    expect(meta.openGraph?.title).toBe("Delings-tittel");
  });

  test("meta.seo with only title persists to metadata title; description falls back", () => {
    const meta = buildCmsPageMetadata({
      pageTitle: "Fallback",
      slug: "x",
      body: { blocks: [], meta: { seo: { title: "Kun tittel" } } },
    });
    expect(meta.title).toBe("Kun tittel – Lunchportalen");
    expect(meta.description).toBeUndefined();
    expect(meta.openGraph?.title).toBe("Kun tittel");
  });
});
