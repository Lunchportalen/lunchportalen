/**
 * U87: Canvas custom view + frame kind henger sammen med kanonisk definisjon.
 */
import { describe, expect, it } from "vitest";
import { editorCanvasFrameKind } from "@/components/cms/blockCanvas/editorCanvasFrameKind";
import {
  CANVAS_VIEW_COMPONENT_BY_ALIAS,
  getBlockTypeDefinition,
  getCanvasFrameKindForBlockType,
} from "@/lib/cms/blocks/blockTypeDefinitions";
import type { Block } from "@/app/(backoffice)/backoffice/content/_components/editorBlockTypes";

function minimalBlock(type: Block["type"]): Block {
  return { id: "t", type } as Block;
}

describe("BlockViewRoutingParity (U87)", () => {
  it("getCanvasFrameKindForBlockType og editorCanvasFrameKind er konsistente", () => {
    const types: Block["type"][] = [
      "hero",
      "hero_full",
      "hero_bleed",
      "cards",
      "zigzag",
      "pricing",
      "cta",
      "relatedLinks",
      "grid",
      "richText",
      "banner",
    ];
    for (const t of types) {
      expect(editorCanvasFrameKind(minimalBlock(t))).toBe(getCanvasFrameKindForBlockType(t));
      expect(getBlockTypeDefinition(t)?.canvasFrameKind).toBe(getCanvasFrameKindForBlockType(t));
    }
  });

  it("canvasViewComponent peker på forventede rammer for nøkkeltyper", () => {
    expect(CANVAS_VIEW_COMPONENT_BY_ALIAS.hero).toBe("HeroCanvasFrame");
    expect(CANVAS_VIEW_COMPONENT_BY_ALIAS.hero_full).toBe("HeroCanvasFrame");
    expect(CANVAS_VIEW_COMPONENT_BY_ALIAS.hero_bleed).toBe("HeroCanvasFrame");
    expect(CANVAS_VIEW_COMPONENT_BY_ALIAS.cards).toBe("CardsCanvasFrame");
    expect(CANVAS_VIEW_COMPONENT_BY_ALIAS.zigzag).toBe("StepsCanvasFrame");
    expect(CANVAS_VIEW_COMPONENT_BY_ALIAS.pricing).toBe("PricingCanvasFrame");
    expect(CANVAS_VIEW_COMPONENT_BY_ALIAS.cta).toBe("CtaCanvasFrame");
    expect(CANVAS_VIEW_COMPONENT_BY_ALIAS.relatedLinks).toBe("RelatedCanvasFrame");
    expect(CANVAS_VIEW_COMPONENT_BY_ALIAS.grid).toBe("GridCanvasFrame");
  });
});
