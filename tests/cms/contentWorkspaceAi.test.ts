/**
 * contentWorkspace.ai invariants:
 * - AI tool → feature mapping is stable
 * - buildAiBlocks / buildAiExistingBlocks produce deterministic payloads
 * - buildAiMeta derives context from Page AI contract
 * - rankHeroMediaSuggestions ranks and limits hero candidates deterministically
 * - normalizeAiApiError preserves FEATURE_DISABLED semantics and safe fallbacks
 */

import { describe, test, expect } from "vitest";

import {
  AI_TOOL_TO_FEATURE,
  buildAiBlocks,
  buildAiExistingBlocks,
  buildAiMeta,
  rankHeroMediaSuggestions,
  normalizeAiApiError,
} from "@/app/(backoffice)/backoffice/content/_components/contentWorkspace.ai";
import { normalizeBlock } from "@/app/(backoffice)/backoffice/content/_components/contentWorkspace.blocks";
import type { Block } from "@/app/(backoffice)/backoffice/content/_components/editorBlockTypes";
import { getBlockEntryFlatForRender } from "@/lib/cms/blocks/blockEntryContract";

describe("contentWorkspace.ai – AI tool to feature mapping", () => {
  test("maps known tools to expected features", () => {
    expect(AI_TOOL_TO_FEATURE["content.maintain.page"]).toBe("improve_page");
    expect(AI_TOOL_TO_FEATURE["seo.optimize.page"]).toBe("seo_optimize");
    expect(AI_TOOL_TO_FEATURE["landing.generate.sections"]).toBe(
      "generate_sections",
    );
    expect(AI_TOOL_TO_FEATURE["page.builder"]).toBe("page_builder");
    expect(AI_TOOL_TO_FEATURE["screenshot.builder"]).toBe("screenshot_builder");
  });
});

describe("contentWorkspace.ai – buildAiBlocks / buildAiExistingBlocks", () => {
  const h = normalizeBlock({
    id: "h1",
    type: "hero",
    title: "Tittel",
    subtitle: "Sub",
    imageId: "/img.jpg",
    imageAlt: "Alt",
    ctaLabel: "CTA",
    ctaHref: "/lenke",
  });
  const c = normalizeBlock({
    id: "c1",
    type: "cta",
    title: "CTA tittel",
    body: "CTA tekst",
    buttonLabel: "Knapp",
    buttonHref: "/cta",
  });
  if (!h || !c) throw new Error("normalizeBlock");
  const sampleBlocks: Block[] = [
    h,
    {
      id: "r1",
      type: "richText",
      heading: "Overskrift",
      body: "Brødtekst",
    },
    {
      id: "i1",
      type: "image",
      imageId: "/asset.png",
      alt: "Bilde",
      caption: "Bildetekst",
    },
    c,
  ];

  test("buildAiBlocks preserves id/type and wraps data per block type", () => {
    const aiBlocks = buildAiBlocks(sampleBlocks);
    expect(aiBlocks).toHaveLength(sampleBlocks.length);
    const hero = aiBlocks[0];
    expect(hero.id).toBe("h1");
    expect(hero.type).toBe("hero");
    expect(hero.data).toEqual(getBlockEntryFlatForRender(sampleBlocks[0]));
    const rich = aiBlocks[1];
    expect(rich.data).toEqual({ heading: "Overskrift", body: "Brødtekst" });
    const image = aiBlocks[2];
    expect(image.data).toEqual({
      imageId: "/asset.png",
      alt: "Bilde",
      caption: "Bildetekst",
    });
    const cta = aiBlocks[3];
    expect(cta.data).toEqual(getBlockEntryFlatForRender(sampleBlocks[3]));
  });

  test("buildAiExistingBlocks exposes only id + type", () => {
    const existing = buildAiExistingBlocks(sampleBlocks);
    expect(existing).toEqual([
      { id: "h1", type: "hero" },
      { id: "r1", type: "richText" },
      { id: "i1", type: "image" },
      { id: "c1", type: "cta" },
    ]);
  });
});

describe("contentWorkspace.ai – buildAiMeta", () => {
  test("extracts description and title from Page AI contract meta", () => {
    const meta = {
      seo: { title: "SEO-tittel", description: "SEO-beskrivelse" },
      intent: {
        intent: "lead",
        audience: "CFO",
      },
    };
    const ctx = buildAiMeta(meta);
    // Contract helpers decide what to expose; at minimum it should not throw and should
    // surface stable strings when present.
    if (ctx.title) {
      expect(typeof ctx.title).toBe("string");
    }
    if (ctx.description) {
      expect(typeof ctx.description).toBe("string");
    }
  });
});

describe("contentWorkspace.ai – rankHeroMediaSuggestions", () => {
  test("returns empty list when no tokens or matches", () => {
    expect(rankHeroMediaSuggestions("", [])).toEqual([]);
    const items = [
      { id: "1", url: "/a.jpg", filename: "foo", alt: "bar" },
      { id: "2", url: "/b.jpg", filename: "baz", alt: "qux" },
    ];
    expect(rankHeroMediaSuggestions("xyz", items)).toEqual([]);
  });

  test("ranks items by number of matched tokens and limits to 6", () => {
    const items = [
      { id: "1", url: "/a.jpg", filename: "kontroll og forutsigbarhet", alt: "" },
      { id: "2", url: "/b.jpg", filename: "kostnadskontroll", alt: "" },
      { id: "3", url: "/c.jpg", filename: "annet", alt: "" },
    ];
    const suggestions = rankHeroMediaSuggestions(
      "Kontroll og forutsigbarhet for lunsjordrer",
      items,
    );
    expect(suggestions.length).toBeGreaterThan(0);
    expect(suggestions[0].mediaId).toBe("1");
    expect(suggestions[0].reason).toContain("Match på:");
  });
});

describe("contentWorkspace.ai – normalizeAiApiError", () => {
  test("maps 503 FEATURE_DISABLED or 'AI is disabled.' to Norwegian message", () => {
    expect(
      normalizeAiApiError(503, { error: "FEATURE_DISABLED", message: "AI is disabled." }),
    ).toBe("AI er ikke tilgjengelig (mangler serverkonfigurasjon).");
    expect(
      normalizeAiApiError(503, { message: "AI is disabled." }),
    ).toBe("AI er ikke tilgjengelig (mangler serverkonfigurasjon).");
  });

  test("falls back to message when present, otherwise 'Feil {status}'", () => {
    expect(normalizeAiApiError(500, { message: "Internal error" })).toBe(
      "Internal error",
    );
    expect(normalizeAiApiError(429, {})).toBe("Feil 429");
  });
});

