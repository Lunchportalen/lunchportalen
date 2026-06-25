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
    const provider = messages.provider as { nav: { orders: string }; dashboard: { eyebrow: string } };
    expect(provider.nav.orders).toBe("Orders");
    expect(provider.dashboard.eyebrow).toBe("Provider");
    expect(JSON.stringify(messages)).not.toContain("[EN]");
  });

  it("loadMessagesForLocale merges nb fallback for sv, de and es", async () => {
    const sv = await loadMessagesForLocale("sv");
    expect(sv.common).toMatchObject({ save: "Spara" });
    expect(sv.localeSwitcher).toMatchObject({ label: "Välj språk" });
    const svProvider = sv.provider as { dashboard: { activeCustomers: string } };
    expect(svProvider.dashboard.activeCustomers).toBe("Aktiva kunder");

    const de = await loadMessagesForLocale("de");
    expect(de.common).toMatchObject({ save: "Speichern" });
    const deProvider = de.provider as { nav: { orders: string } };
    expect(deProvider.nav.orders).toBe("Bestellungen");

    const es = await loadMessagesForLocale("es");
    expect(es.localeSwitcher).toMatchObject({ label: "Elegir idioma" });
    const esProvider = es.provider as { dashboard: { quickActionsSection: string } };
    expect(esProvider.dashboard.quickActionsSection).toBe("Acciones rápidas");
  });

  it("loadMessagesForLocale merges nb fallback for it", async () => {
    const itMessages = await loadMessagesForLocale("it");
    expect(itMessages.common).toMatchObject({ save: "Salva", language: "Lingua" });
    expect(itMessages.localeSwitcher).toMatchObject({ label: "Scegli lingua" });
    const itProvider = itMessages.provider as { nav: { orders: string }; settings: { menuProfile: { heading: string } } };
    expect(itProvider.nav.orders).toBe("Ordini");
    expect(itProvider.settings.menuProfile.heading).toMatch(/profilo menu/i);
  });
});
