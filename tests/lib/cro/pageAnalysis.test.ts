/**
 * CRO page-analysis engine: extraction, structured CRO signals, malformed-content safety.
 */
import { describe, test, expect } from "vitest";
import { analyzePageForCro } from "@/lib/cro/pageAnalysis";

describe("analyzePageForCro", () => {
  test("returns structured CRO signals with all required fields", () => {
    const analysis = analyzePageForCro({
      blocks: [
        { id: "h1", type: "hero", data: { title: "Firmalunsj som fungerer" } },
        { id: "b1", type: "richText", data: { heading: "Fordeler", body: "Sikkerhet og compliance. Enkel oppsett." } },
        { id: "c1", type: "cta", data: { title: "Be om demo", buttonLabel: "Be om demo" } },
      ],
      meta: { cro: { trustSignals: ["Sikkerhet", "ESG"] } },
      pageTitle: "Forside",
    });

    expect(analysis.blocksAnalyzed).toBe(3);
    expect(analysis.blockTypesInOrder).toEqual(["hero", "richText", "cta"]);
    expect(analysis.heroIndex).toBe(0);
    expect(analysis.firstCtaIndex).toBe(2);
    expect(analysis.ctaCount).toBe(1);

    expect(analysis.hasCta).toBe(true);
    expect(analysis.ctaButtonLabel).toBe("Be om demo");
    expect(analysis.ctaTitle).toBe("Be om demo");
    expect(analysis.firstCtaBlockId).toBe("c1");
    expect(analysis.primaryCtaClarity).toBe("clear");

    expect(analysis.firstHeading).toBe("Fordeler");
    expect(analysis.heroTitle).toBe("Firmalunsj som fungerer");
    expect(analysis.mainHeadline).toBe("Firmalunsj som fungerer");
    expect(analysis.headlineClarity).toBe("clear");

    expect(analysis.hasValueProps).toBe(true);
    expect(analysis.valuePropsSource).toBe("heading");
    expect(analysis.bodyContent).toContain("Sikkerhet");
    expect(analysis.trustSignalMentions).toContain("sikkerhet");
    expect(analysis.trustSignalMentions).toContain("compliance");
    expect(analysis.metaTrustSignals).toEqual(["Sikkerhet", "ESG"]);

    expect(analysis.hasExplicitOffer).toBe(true);
    expect(analysis.offerInCtaLabel).toBe(true);
    expect(analysis.introMinWords).toBe(30);
  });

  test("malformed blocks: null yields safe defaults and zero counts", () => {
    const analysis = analyzePageForCro({ blocks: null, meta: {}, pageTitle: "P" });

    expect(analysis.blocksAnalyzed).toBe(0);
    expect(analysis.blockTypesInOrder).toEqual([]);
    expect(analysis.heroIndex).toBe(null);
    expect(analysis.firstCtaIndex).toBe(null);
    expect(analysis.ctaCount).toBe(0);
    expect(analysis.hasCta).toBe(false);
    expect(analysis.ctaButtonLabel).toBe("");
    expect(analysis.ctaTitle).toBe("");
    expect(analysis.primaryCtaClarity).toBe("none");
    expect(analysis.firstHeading).toBe("");
    expect(analysis.heroTitle).toBe("");
    expect(analysis.mainHeadline).toBe("");
    expect(analysis.headlineClarity).toBe("missing");
    expect(analysis.hasValueProps).toBe(false);
    expect(analysis.valuePropsSource).toBe("none");
    expect(analysis.bodyContent).toBe("");
    expect(analysis.trustSignalMentions).toEqual([]);
    expect(analysis.metaTrustSignals).toEqual([]);
    expect(analysis.longParagraphCount).toBe(0);
    expect(analysis.introTooShort).toBe(false);
    expect(analysis.hasExplicitOffer).toBe(false);
    expect(analysis.offerInCtaLabel).toBe(false);
  });

  test("malformed blocks: non-array yields empty analysis", () => {
    const analysis = analyzePageForCro({ blocks: { not: "array" }, meta: undefined, pageTitle: undefined });
    expect(analysis.blocksAnalyzed).toBe(0);
    expect(analysis.blockTypesInOrder).toEqual([]);
    expect(analysis.primaryCtaClarity).toBe("none");
  });

  test("primaryCtaClarity: none when no CTA", () => {
    const analysis = analyzePageForCro({
      blocks: [{ id: "r1", type: "richText", data: { body: "Text" } }],
      meta: {},
    });
    expect(analysis.primaryCtaClarity).toBe("none");
    expect(analysis.hasCta).toBe(false);
  });

  test("primaryCtaClarity: weak when generic button or empty title", () => {
    const weak1 = analyzePageForCro({
      blocks: [{ id: "c1", type: "cta", data: { buttonLabel: "Klikk her", title: "Go" } }],
      meta: {},
    });
    expect(weak1.primaryCtaClarity).toBe("weak");

    const weak2 = analyzePageForCro({
      blocks: [{ id: "c1", type: "cta", data: { buttonLabel: "Send", title: "" } }],
      meta: {},
    });
    expect(weak2.primaryCtaClarity).toBe("weak");
  });

  test("primaryCtaClarity: clear when specific label and title", () => {
    const analysis = analyzePageForCro({
      blocks: [{ id: "c1", type: "cta", data: { title: "Be om tilbud", buttonLabel: "Kontakt oss" } }],
      meta: {},
    });
    expect(analysis.primaryCtaClarity).toBe("clear");
  });

  test("headlineClarity: missing when no headline", () => {
    const analysis = analyzePageForCro({
      blocks: [{ id: "r1", type: "richText", data: { body: "No heading" } }],
      meta: {},
    });
    expect(analysis.headlineClarity).toBe("missing");
    expect(analysis.mainHeadline).toBe("");
  });

  test("headlineClarity: weak when very short", () => {
    const analysis = analyzePageForCro({
      blocks: [{ id: "h1", type: "hero", data: { title: "Hi" } }],
      meta: {},
    });
    expect(analysis.headlineClarity).toBe("weak");
  });

  test("valuePropsSource: body when phrase in body", () => {
    const analysis = analyzePageForCro({
      blocks: [
        {
          id: "r1",
          type: "richText",
          data: { heading: "Intro", body: "Her er fordeler med løsningen. Benefits for bedriften." },
        },
      ],
      meta: {},
    });
    expect(analysis.hasValueProps).toBe(true);
    expect(analysis.valuePropsSource).toBe("body");
  });

  test("introTooShort when first richText has few words", () => {
    const analysis = analyzePageForCro({
      blocks: [{ id: "r1", type: "richText", data: { body: "Kort intro." } }],
      meta: {},
    });
    expect(analysis.introWordCount).toBe(2);
    expect(analysis.introTooShort).toBe(true);
  });

  test("longParagraphCount when richText body exceeds word threshold", () => {
    const longBody = Array.from({ length: 210 }, () => "word").join(" ");
    const analysis = analyzePageForCro({
      blocks: [
        { id: "r1", type: "richText", data: { body: "Short." } },
        { id: "r2", type: "richText", data: { body: longBody } },
      ],
      meta: {},
    });
    expect(analysis.longParagraphCount).toBe(1);
  });

  test("meta.cro.trustSignals parsed when present", () => {
    const analysis = analyzePageForCro({
      blocks: [],
      meta: { cro: { trustSignals: ["A", "B"] } },
    });
    expect(analysis.metaTrustSignals).toEqual(["A", "B"]);
  });

  test("malformed meta.cro yields empty metaTrustSignals", () => {
    const a1 = analyzePageForCro({ blocks: [], meta: { cro: "string" } });
    expect(a1.metaTrustSignals).toEqual([]);
    const a2 = analyzePageForCro({ blocks: [], meta: {} });
    expect(a2.metaTrustSignals).toEqual([]);
  });

  test("caps blocks at MAX_BLOCKS", () => {
    const many = Array.from({ length: 150 }, (_, i) => ({
      id: `b${i}`,
      type: "richText",
      data: { body: "x" },
    }));
    const analysis = analyzePageForCro({ blocks: many, meta: {} });
    expect(analysis.blocksAnalyzed).toBe(100);
  });

  test("section order: heroIndex and firstCtaIndex correct", () => {
    const analysis = analyzePageForCro({
      blocks: [
        { id: "r1", type: "richText", data: {} },
        { id: "h1", type: "hero", data: { title: "Hero" } },
        { id: "c1", type: "cta", data: { title: "C", buttonLabel: "Go" } },
      ],
      meta: {},
    });
    expect(analysis.blockTypesInOrder).toEqual(["richText", "hero", "cta"]);
    expect(analysis.heroIndex).toBe(1);
    expect(analysis.firstCtaIndex).toBe(2);
    expect(analysis.ctaCount).toBe(1);
  });
});
