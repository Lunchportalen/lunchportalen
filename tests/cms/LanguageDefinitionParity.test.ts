import { describe, expect, it } from "vitest";
import { listBaselineLanguageDefinitions, listLanguageAliases } from "@/lib/cms/schema/languageDefinitions";
import { mergeAllLanguagesWithOverrides } from "@/lib/cms/schema/languageDefinitionMerge";

describe("LanguageDefinitionParity", () => {
  it("baseline exposes ≥2 aliases with one default", () => {
    const aliases = listLanguageAliases();
    expect(aliases.length).toBeGreaterThanOrEqual(2);
    const defs = listBaselineLanguageDefinitions();
    const defaults = defs.filter((d) => d.enabled && d.isDefault);
    expect(defaults).toHaveLength(1);
  });

  it("merge preserves baseline when no overrides", () => {
    const merged = mergeAllLanguagesWithOverrides(null);
    expect(merged["nb-no"]?.storageLocale).toBe("nb");
    expect(merged["en-gb"]?.storageLocale).toBe("en");
  });
});
