/**
 * U94 — Library grouping and visible entries follow Data Type allowlist + groups.
 */
import { describe, expect, it } from "vitest";
import {
  getBlockEditorDataType,
  groupBlockLibraryEntriesByDataType,
  type BlockLibraryEntryLike,
} from "@/lib/cms/blocks/blockEditorDataTypes";

describe("BlockDataTypeLibraryBindingParity (U94)", () => {
  const compact = getBlockEditorDataType("compact_page_blocks")!;
  const entries: BlockLibraryEntryLike[] = [
    { type: "hero", label: "Hero", libraryGroup: "ignored-when-dt" },
    { type: "richText", label: "Tekst", libraryGroup: "x" },
    { type: "image", label: "Bilde", libraryGroup: "x" },
    { type: "cards", label: "Kort", libraryGroup: "x" },
    { type: "cta", label: "CTA", libraryGroup: "x" },
    { type: "pricing", label: "Pris", libraryGroup: "should-not-appear" },
  ];

  it("grupper kommer fra data type (rekkefølge og titler)", () => {
    const grouped = groupBlockLibraryEntriesByDataType(entries, compact);
    const titles = grouped.map((g) => g.group);
    expect(titles).toContain("Kjerne");
    expect(titles).toContain("Seksjon");
    expect(titles).toContain("Handling");
    expect(grouped.find((g) => g.group === "Kjerne")!.items.map((i) => i.type).sort()).toEqual(
      ["hero", "image", "richText"].sort(),
    );
    expect(grouped.find((g) => g.group === "Seksjon")!.items.map((i) => i.type)).toEqual(["cards"]);
    expect(grouped.find((g) => g.group === "Handling")!.items.map((i) => i.type)).toEqual(["cta"]);
  });

  it("blokk som ikke er i allowlist filtreres bort (ikke i noen gruppe)", () => {
    const grouped = groupBlockLibraryEntriesByDataType(entries, compact);
    const allTypes = grouped.flatMap((g) => g.items.map((i) => i.type));
    expect(allTypes).not.toContain("pricing");
  });

  it("micro data type: én synlig gruppe dekker hele allowlisten", () => {
    const micro = getBlockEditorDataType("page_micro_blocks")!;
    const microEntries: BlockLibraryEntryLike[] = [
      { type: "hero", label: "H", libraryGroup: "z" },
      { type: "richText", label: "R", libraryGroup: "z" },
      { type: "cta", label: "C", libraryGroup: "z" },
    ];
    const grouped = groupBlockLibraryEntriesByDataType(microEntries, micro);
    expect(grouped.length).toBe(1);
    expect(grouped[0]!.group).toBe("Tillatte blokker");
    expect(grouped[0]!.items.map((i) => i.type).sort()).toEqual(["cta", "hero", "richText"].sort());
  });
});
