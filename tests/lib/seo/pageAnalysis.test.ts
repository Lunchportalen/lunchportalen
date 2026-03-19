/**
 * Page-analysis engine: extraction, structured SEO signals, malformed-content safety.
 */
import { describe, test, expect } from "vitest";
import { analyzePageForSeo } from "@/lib/seo/pageAnalysis";

describe("analyzePageForSeo", () => {
  test("returns structured SEO signals with all required fields", () => {
    const analysis = analyzePageForSeo({
      blocks: [
        { id: "b1", type: "richText", data: { heading: "H1", body: "Intro [link](/hvordan)." } },
        { id: "b2", type: "image", data: { assetPath: "/img.jpg", alt: "Bilde" } },
        { id: "b3", type: "cta", data: { title: "CTA", buttonLabel: "Be om demo" } },
      ],
      meta: { seo: { title: "SEO Title", description: "Meta desc" } },
      pageTitle: "Page",
    });
    expect(analysis.title).toBe("SEO Title");
    expect(analysis.description).toBe("Meta desc");
    expect(analysis.headings).toEqual(["H1"]);
    expect(analysis.firstHeading).toBe("H1");
    expect(analysis.bodyContent).toContain("Intro");
    expect(analysis.bodyWordCount).toBeGreaterThan(0);
    expect(analysis.hasInternalLinks).toBe(true);
    expect(analysis.internalLinkCount).toBeGreaterThan(0);
    expect(analysis.imageAlts).toHaveLength(1);
    expect(analysis.imageAlts[0]).toEqual({ blockId: "b2", alt: "Bilde", empty: false });
    expect(analysis.hasFaq).toBe(false);
    expect(analysis.hasCta).toBe(true);
    expect(analysis.ctaButtonLabel).toBe("Be om demo");
    expect(analysis.ctaTitle).toBe("CTA");
    expect(analysis.blocksAnalyzed).toBe(3);
  });

  test("malformed blocks: null yields empty signals and zero counts", () => {
    const analysis = analyzePageForSeo({ blocks: null, meta: {}, pageTitle: "P" });
    expect(analysis.title).toBe("P");
    expect(analysis.description).toBe("");
    expect(analysis.headings).toEqual([]);
    expect(analysis.firstHeading).toBe("");
    expect(analysis.bodyContent).toBe("");
    expect(analysis.bodyWordCount).toBe(0);
    expect(analysis.hasInternalLinks).toBe(false);
    expect(analysis.internalLinkCount).toBe(0);
    expect(analysis.imageAlts).toEqual([]);
    expect(analysis.hasFaq).toBe(false);
    expect(analysis.hasCta).toBe(false);
    expect(analysis.blocksAnalyzed).toBe(0);
  });

  test("malformed blocks: non-array yields empty signals", () => {
    const analysis = analyzePageForSeo({ blocks: { not: "array" }, meta: undefined, pageTitle: undefined });
    expect(analysis.blocksAnalyzed).toBe(0);
    expect(analysis.headings).toEqual([]);
    expect(analysis.imageAlts).toEqual([]);
  });

  test("malformed meta: invalid or missing seo leaves title/description from pageTitle or flat meta", () => {
    const a1 = analyzePageForSeo({ blocks: [], meta: null, pageTitle: "Fallback" });
    expect(a1.title).toBe("Fallback");
    expect(a1.description).toBe("");

    const a2 = analyzePageForSeo({ blocks: [], meta: { description: "Flat", title: "FlatTitle" }, pageTitle: "" });
    expect(a2.title).toBe("FlatTitle");
    expect(a2.description).toBe("Flat");
  });

  test("FAQ detected when richText heading is Spørsmål og svar or FAQ", () => {
    const a1 = analyzePageForSeo({
      blocks: [{ id: "f", type: "richText", data: { heading: "Spørsmål og svar", body: "Q&A" } }],
      meta: {},
    });
    expect(a1.hasFaq).toBe(true);

    const a2 = analyzePageForSeo({
      blocks: [{ id: "f", type: "richText", data: { title: "FAQ", body: "Q&A" } }],
      meta: {},
    });
    expect(a2.hasFaq).toBe(true);
  });

  test("image and hero alt extracted; empty alt flagged", () => {
    const analysis = analyzePageForSeo({
      blocks: [
        { id: "i1", type: "image", data: { assetPath: "/a.jpg", alt: "" } },
        { id: "h1", type: "hero", data: { imageUrl: "/b.jpg", imageAlt: "Hero alt" } },
      ],
      meta: {},
    });
    expect(analysis.imageAlts).toHaveLength(2);
    expect(analysis.imageAlts.find((a) => a.blockId === "i1")).toEqual({ blockId: "i1", alt: "", empty: true });
    expect(analysis.imageAlts.find((a) => a.blockId === "h1")).toEqual({ blockId: "h1", alt: "Hero alt", empty: false });
  });

  test("caps blocks at MAX_BLOCKS and reports blocksAnalyzed", () => {
    const many = Array.from({ length: 150 }, (_, i) => ({
      id: `b${i}`,
      type: "richText",
      data: { body: "x" },
    }));
    const analysis = analyzePageForSeo({ blocks: many, meta: {} });
    expect(analysis.blocksAnalyzed).toBe(100);
  });
});
