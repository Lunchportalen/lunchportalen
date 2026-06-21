import { describe, expect, it } from "vitest";

import { deepMergeMessages, loadMessagesForLocale } from "@/lib/i18n/messages";

describe("i18n messages", () => {
  it("deepMergeMessages keeps nb values for keys missing in en", () => {
    const nb = { common: { save: "Lagre", onlyNb: "Kun norsk" }, nav: { languageNb: "Norsk" } };
    const en = { common: { save: "Save" } };
    const merged = deepMergeMessages(nb, en);
    expect(merged).toEqual({
      common: { save: "Save", onlyNb: "Kun norsk" },
      nav: { languageNb: "Norsk" },
    });
  });

  it("loadMessagesForLocale returns nb-only catalog for nb", async () => {
    const messages = await loadMessagesForLocale("nb");
    expect(messages.common).toMatchObject({ save: "Lagre" });
    expect(messages.localeSwitcher).toMatchObject({ label: "Velg språk" });
  });

  it("loadMessagesForLocale merges nb fallback for en without empty or [EN] stubs", async () => {
    const messages = await loadMessagesForLocale("en");
    expect(messages.common).toMatchObject({ save: "Save", loading: "Loading …" });
    expect(messages.localeSwitcher).toMatchObject({ label: "Choose language" });
    expect(JSON.stringify(messages)).not.toContain("[EN]");
  });
});
