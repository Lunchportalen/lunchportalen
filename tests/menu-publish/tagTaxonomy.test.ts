import { describe, expect, it } from "vitest";

import {
  CUISINE_DUPLICATES,
  GENERIC_TAGS,
  PROTEIN_DUPLICATES,
  classifyTag,
  normalizeMeaningfulTags,
} from "@/lib/menu-publish/tagTaxonomy";

describe("tagTaxonomy", () => {
  it("classifyTag: generic (case-insensitive)", () => {
    expect(classifyTag("lunsj")).toBe("generic");
    expect(classifyTag("Lunsj")).toBe("generic");
    expect(classifyTag(" varmmat ")).toBe("generic");
  });

  it("classifyTag: cuisine duplicates (eksakt treff)", () => {
    for (const t of CUISINE_DUPLICATES) {
      expect(classifyTag(t)).toBe("cuisineDup");
    }
  });

  it("classifyTag: protein duplicates", () => {
    for (const t of PROTEIN_DUPLICATES) {
      expect(classifyTag(t)).toBe("proteinDup");
    }
  });

  it("classifyTag: meaningful — smale stiler og metoder", () => {
    expect(classifyTag("Norsk husmann")).toBe("meaningful");
    expect(classifyTag("Fritert")).toBe("meaningful");
    expect(classifyTag("Thai")).toBe("meaningful");
    expect(classifyTag("suppe")).toBe("meaningful");
    expect(classifyTag("Suppe")).toBe("meaningful");
  });

  it("GENERIC_TAGS og lister er ikke tomme", () => {
    expect(GENERIC_TAGS.length).toBe(2);
    expect(CUISINE_DUPLICATES.size).toBeGreaterThan(0);
    expect(PROTEIN_DUPLICATES.size).toBeGreaterThan(0);
  });

  it("normalizeMeaningfulTags filtrerer støy og lowercaser", () => {
    const raw = [
      "lunsj",
      "varmmat",
      "Norsk/Skandinavisk",
      "Kylling",
      "vegetar",
      "Fritert",
      "Norsk husmann",
      "Suppe",
      "suppe",
    ];
    const s = normalizeMeaningfulTags(raw);
    expect(s.has("fritert")).toBe(true);
    expect(s.has("norsk husmann")).toBe(true);
    expect(s.has("suppe")).toBe(true);
    expect(s.size).toBe(3);
  });

  it('"suppe" og "Suppe" kollapser til én meningsfull nøkkel', () => {
    const s = normalizeMeaningfulTags(["Suppe", "suppe", "lunsj"]);
    expect([...s].sort()).toEqual(["suppe"]);
  });
});
