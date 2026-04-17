import { describe, expect, test } from "vitest";
import { buildPublicCmsJsonLdGraph } from "@/components/seo/CmsStructuredData";
import { buildEditorialFallbackPublicBody } from "@/lib/cms/seed/editorialFallbackHomeBody";

describe("public CMS JSON-LD (same truth as body + metadata)", () => {
  test("seed/fallback body yields valid graph without throw (fail-closed description, not fake live)", () => {
    const body = buildEditorialFallbackPublicBody();
    const graph = buildPublicCmsJsonLdGraph(
      { title: null, slug: "om-oss", body },
      "/om-oss",
    );
    expect(Array.isArray(graph)).toBe(true);
    expect(graph.length).toBeGreaterThanOrEqual(2);
    const raw = JSON.stringify(graph);
    expect(raw).toContain("Redaksjonelt innhold er ikke tilgjengelig fra CMS");
    expect(() => JSON.parse(raw)).not.toThrow();
  });

  test("live-shaped body uses SEO description from same body object", () => {
    const body = {
      version: 1,
      blocks: [{ type: "richText", id: "x", data: {} }],
      meta: {
        seo: { title: "T", description: "Beskrivelse fra CMS-body" },
      },
    };
    const graph = buildPublicCmsJsonLdGraph(
      { title: "Sideoverskrift", slug: "faq", body },
      "/faq",
    );
    const raw = JSON.stringify(graph);
    expect(raw).toContain("Beskrivelse fra CMS-body");
  });
});
