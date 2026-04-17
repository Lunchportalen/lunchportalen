import { describe, expect, it } from "vitest";
import { blockCollapsedPreviewSummary } from "@/app/(backoffice)/backoffice/content/_components/BlockCollapsedPreview";
import { normalizeBlock } from "@/app/(backoffice)/backoffice/content/_components/contentWorkspace.blocks";
import type { Block } from "@/app/(backoffice)/backoffice/content/_components/editorBlockTypes";
import { getBlockLabel } from "@/app/(backoffice)/backoffice/content/_components/blockLabels";

const FORBIDDEN_LABEL = /^Blokk$/i;

/** U76: ingen synlig blokk føles som tom placeholder i label eller preview. */
describe("NoToyBlocksLeft (U76)", () => {
  const types: Block["type"][] = [
    "hero",
    "hero_full",
    "hero_bleed",
    "banner",
    "richText",
    "image",
    "cta",
    "divider",
    "cards",
    "zigzag",
    "pricing",
    "grid",
    "form",
    "relatedLinks",
  ];

  function emptyish(type: Block["type"]): Block {
    const b = normalizeBlock({ id: "e", type });
    if (!b) throw new Error(`normalizeBlock failed: ${type}`);
    return b;
  }

  it("etiketter er aldri generiske «Blokk»", () => {
    for (const t of types) {
      expect(getBlockLabel(t)).not.toMatch(FORBIDDEN_LABEL);
    }
  });

  it("tom preview er fortsatt beskrivende (min. et signal)", () => {
    for (const t of types) {
      const s = blockCollapsedPreviewSummary(emptyish(t));
      expect(s.trim().length).toBeGreaterThan(6);
      expect(s.toLowerCase()).not.toBe("blokk");
      expect(s.toLowerCase()).not.toMatch(/^tom\.?$/);
    }
  });
});
