import { describe, expect, it } from "vitest";
import { getBlockLabel, getBlockShortLabel, getBlockTreeLabel } from "@/app/(backoffice)/backoffice/content/_components/blockLabels";
import { normalizeBlock } from "@/app/(backoffice)/backoffice/content/_components/contentWorkspace.blocks";
import type { Block } from "@/app/(backoffice)/backoffice/content/_components/editorBlockTypes";

const FORBIDDEN = /^Blokk$/;
const FORBIDDEN_SECTION = /^Seksjon$/;

const ALL_TYPES: Block["type"][] = [
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

function minimalBlock(type: Block["type"]): Block {
  const b = normalizeBlock({ id: "t", type });
  if (!b) throw new Error(`normalizeBlock failed: ${type}`);
  return b;
}

describe("NoGenericBlockNames (U75)", () => {
  it("kjente blokktyper har aldri kun «Blokk» eller «Seksjon» som etikett", () => {
    for (const t of ALL_TYPES) {
      expect(getBlockLabel(t)).not.toMatch(FORBIDDEN);
      expect(getBlockLabel(t)).not.toMatch(FORBIDDEN_SECTION);
      expect(getBlockShortLabel(t)).not.toMatch(FORBIDDEN);
      expect(getBlockShortLabel(t)).not.toMatch(FORBIDDEN_SECTION);
      const tree = getBlockTreeLabel(minimalBlock(t));
      expect(tree).not.toMatch(FORBIDDEN);
      expect(tree).not.toMatch(FORBIDDEN_SECTION);
    }
  });

  it("ukjent type-tekst er fortsatt eksplisitt (ikke bare «Blokk»)", () => {
    expect(getBlockLabel("unknownThing")).toContain("unknownThing");
    expect(getBlockShortLabel("unknownThing")).toBeTruthy();
  });
});
