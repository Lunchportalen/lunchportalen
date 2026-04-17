/**
 * U94 — Block Entry (hva en blokk er) vs Data Type (hvor den kan brukes) er atskilt.
 */
import { describe, expect, it } from "vitest";
import { CORE_CMS_BLOCK_DEFINITIONS } from "@/lib/cms/blocks/registry";
import { listBlockEditorDataTypeDefinitions } from "@/lib/cms/blocks/blockEditorDataTypes";

describe("BlockEntryVsDataTypeParity (U94)", () => {
  it("data type-definisjoner har ikke content/settings/labelBuilder — det lever i block entry", () => {
    for (const dt of listBlockEditorDataTypeDefinitions()) {
      const keys = Object.keys(dt) as string[];
      expect(keys).not.toContain("contentSchema");
      expect(keys).not.toContain("settingsSchema");
      expect(keys).not.toContain("defaultContent");
      expect(keys).not.toContain("propertyEditor");
    }
  });

  it("block entry definitions har type/label (identitet) — ikke document allowlist", () => {
    const hero = CORE_CMS_BLOCK_DEFINITIONS.find((b) => b.type === "hero");
    expect(hero?.type).toBe("hero");
    expect(hero?.label?.length).toBeGreaterThan(0);
    const keys = Object.keys(hero ?? {});
    expect(keys).not.toContain("allowedBlockAliases");
    expect(keys).not.toContain("minItems");
    expect(keys).not.toContain("maxItems");
  });

  it("samme block alias kan refereres av flere data types med ulike grenser", () => {
    const dts = listBlockEditorDataTypeDefinitions();
    const withHero = dts.filter((d) => d.allowedBlockAliases.includes("hero"));
    expect(withHero.length).toBeGreaterThanOrEqual(2);
    const maxes = new Set(withHero.map((d) => d.maxItems));
    expect(maxes.size).toBeGreaterThanOrEqual(2);
  });
});
