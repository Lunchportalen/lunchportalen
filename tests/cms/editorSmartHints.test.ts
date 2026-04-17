import { describe, expect, test } from "vitest";
import { normalizeBlock } from "@/app/(backoffice)/backoffice/content/_components/contentWorkspace.blocks";
import { analyzeBlock, analyzePageBlocks } from "@/lib/cms/editorSmartHints";

describe("editorSmartHints", () => {
  test("hero without CTA gets warn/bad hints", () => {
    const hero = normalizeBlock({
      id: "1",
      type: "hero",
      title: "Kort",
      subtitle: "",
      imageId: "",
      ctaLabel: "",
      ctaHref: "",
    });
    if (!hero || hero.type !== "hero") throw new Error("expected hero");
    const q = analyzeBlock(hero);
    expect(q.score).toBeLessThan(60);
    expect(q.hints.some((h) => h.includes("CTA"))).toBe(true);
  });

  test("richText with empty body scores low", () => {
    const q = analyzeBlock({
      id: "2",
      type: "richText",
      body: "  ",
      heading: "X",
    });
    expect(q.level).toBe("bad");
  });

  test("analyzePageBlocks flags missing page CTA", () => {
    const a = normalizeBlock({
      id: "a",
      type: "hero",
      title: "Velkommen til oss og våre tjenester",
      imageId: "x",
      ctaLabel: "Kontakt",
      ctaHref: "/k",
    });
    if (!a) throw new Error("hero");
    const { hints } = analyzePageBlocks([
      a,
      { id: "b", type: "richText", body: "<p>Lang nok tekst for å unngå tomt innhold her.</p>", heading: "Om oss" },
    ]);
    expect(hints.some((h) => h.includes("CTA"))).toBe(true);
  });
});
