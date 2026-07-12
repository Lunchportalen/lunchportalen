import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  APP_LOCALES,
  getLocaleLabel,
  htmlLangForAppLocale,
  intlLocaleForAppLocale,
} from "@/lib/i18n/localeRegistry";
import { loadMessagesForLocale } from "@/lib/i18n/messages";

const NORWEGIAN_LEAKAGE = [
  "Lagre",
  "Velg språk",
  "Ukjent",
  "Leverandør",
  "Innstillinger",
  "Ordre",
  "Faktura",
  "MVA",
  "oppgjør",
  "provisjon",
  "Avtale",
  "Leveringsadresse ikke satt",
  "Retten",
];

function collectLeafPaths(node: unknown, prefix = ""): string[] {
  if (typeof node === "string") return prefix ? [prefix] : [];
  if (!node || typeof node !== "object") return [];
  const out: string[] = [];
  for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
    const path = prefix ? `${prefix}.${key}` : key;
    out.push(...collectLeafPaths(value, path));
  }
  return out;
}

function getAtPath(node: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, key) => {
    if (acc && typeof acc === "object" && key in (acc as Record<string, unknown>)) {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, node);
}

function extractPlaceholders(value: string): string[] {
  return (value.match(/\{[a-zA-Z0-9_,]+\}/g) ?? []).sort();
}

describe("Italian locale foundation (pre-G5)", () => {
  it("registers it in APP_LOCALES and locale registry", () => {
    expect(APP_LOCALES).toContain("it");
    expect(APP_LOCALES).toHaveLength(15);
    expect(getLocaleLabel("it")).toBe("Italiano");
    expect(htmlLangForAppLocale("it")).toBe("it-IT");
    expect(intlLocaleForAppLocale("it")).toBe("it-IT");
  });

  it("messages/it.json exists on disk", () => {
    const raw = readFileSync(join(process.cwd(), "messages/it.json"), "utf8");
    expect(raw.length).toBeGreaterThan(1000);
    expect(JSON.parse(raw).nav.languageIt).toBe("Italiano");
  });

  it("loadMessagesForLocale('it') has full key parity with nb for provider.*", async () => {
    const nb = (await loadMessagesForLocale("nb")) as Record<string, unknown>;
    const it = (await loadMessagesForLocale("it")) as Record<string, unknown>;
    const nbProviderPaths = collectLeafPaths(nb.provider).map((p) => `provider.${p}`);
    for (const path of nbProviderPaths) {
      const itVal = getAtPath(it, path);
      expect(typeof itVal).toBe("string");
      expect(String(itVal).length).toBeGreaterThan(0);
    }
  });

  it("provider.* placeholder parity between nb and it", async () => {
    const nb = (await loadMessagesForLocale("nb")) as Record<string, unknown>;
    const it = (await loadMessagesForLocale("it")) as Record<string, unknown>;
    const nbProviderPaths = collectLeafPaths(nb.provider).map((p) => `provider.${p}`);
    for (const path of nbProviderPaths) {
      const nbVal = String(getAtPath(nb, path));
      const itVal = String(getAtPath(it, path));
      expect(extractPlaceholders(itVal)).toEqual(extractPlaceholders(nbVal));
    }
  });

  it("merged Italian messages avoid critical Norwegian leakage in provider chrome", async () => {
    const it = (await loadMessagesForLocale("it")) as Record<string, unknown>;
    const providerPaths = collectLeafPaths(it.provider).map((p) => `provider.${p}`);
    for (const path of providerPaths) {
      const value = String(getAtPath(it, path));
      for (const forbidden of NORWEGIAN_LEAKAGE) {
        expect(value).not.toBe(forbidden);
        expect(value).not.toContain(` ${forbidden} `);
      }
    }
  });

  it("Italian provider menu profile diagnostic copy exists", async () => {
    const it = (await loadMessagesForLocale("it")) as {
      provider: {
        settings: {
          menuProfile: {
            heading: string;
            profileLabel: string;
            currencyLabel: string;
            readOnlyNote: string;
          };
        };
      };
    };
    expect(it.provider.settings.menuProfile.heading).toMatch(/profilo menu/i);
    expect(it.provider.settings.menuProfile.profileLabel).toBe("Profilo menu");
    expect(it.provider.settings.menuProfile.currencyLabel).toContain("Valuta");
    expect(it.provider.settings.menuProfile.readOnlyNote).toMatch(/menu/i);
  });

  it("Italian commercial glossary: IVA, commissione, liquidazione, scelte fisse", async () => {
    const it = (await loadMessagesForLocale("it")) as {
      provider: {
        billing: { agreement: { vatLabel: string }; summary: { commission: string } };
        menu: { catalogModel: { title: string } };
      };
    };
    expect(it.provider.billing.agreement.vatLabel).toContain("IVA");
    expect(it.provider.billing.summary.commission).toMatch(/commissione/i);
    expect(it.provider.menu.catalogModel.title).toMatch(/scelte fisse/i);
    const billingPage = (await loadMessagesForLocale("it")) as {
      provider: { billing: { page: { heading: string } } };
    };
    expect(billingPage.provider.billing.page.heading).toMatch(/liquidazione/i);
  });

  it("Tripletex is not presented as Italian/global accounting standard", async () => {
    const it = (await loadMessagesForLocale("it")) as {
      provider: { settings: { page: { accountingIntro: string } } };
    };
    const intro = it.provider.settings.page.accountingIntro;
    expect(intro).toMatch(/norvegese|Norvegia/i);
    expect(intro).toMatch(/non è lo standard contabile italiano/i);
  });

  it("employee/week menu chrome stays price-free in Italian (no commercial leakage keys)", async () => {
    const it = (await loadMessagesForLocale("it")) as {
      provider: { menu: Record<string, unknown> };
    };
    const menuJson = JSON.stringify(it.provider.menu);
    expect(menuJson).not.toMatch(/NOK|provisjon|commissione 5 %|fatturazione cliente/i);
  });
});
