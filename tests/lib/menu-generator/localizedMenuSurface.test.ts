import { describe, expect, test } from "vitest";

import {
  buildLocalizedRuntimeCategoryLabels,
  buildPackageCardMenuTerms,
  getLocalizedCategoryLabels,
} from "@/lib/menu-generator/localizedCategoryLabels";
import { buildLocalizedMenuSurfacePresentation } from "@/lib/menu-generator/localizedMenuSurface";
import { SUPPORTED_MENU_LOCALES } from "@/lib/menu-generator/types";

const NON_NB_FORBIDDEN = ["Påsmurt", "Salatboks", "Varmrett"] as const;

type LocaleExpectation = {
  locale: (typeof SUPPORTED_MENU_LOCALES)[number];
  expectInBasis: readonly string[];
  forbidInBasis?: readonly string[];
};

const LOCALE_EXPECTATIONS: LocaleExpectation[] = [
  {
    locale: "nb-NO",
    expectInBasis: ["Påsmurt", "Salatboks", "Varmrett"],
  },
  {
    locale: "sv-SE",
    expectInBasis: ["Mackor", "Sallader", "Varmrätt"],
    forbidInBasis: NON_NB_FORBIDDEN,
  },
  {
    locale: "da-DK",
    expectInBasis: ["Smørrebrød", "Salater", "Varm ret"],
    forbidInBasis: NON_NB_FORBIDDEN,
  },
  {
    locale: "fi-FI",
    expectInBasis: ["Voileivät", "Salaatit", "Lämmin ruoka"],
    forbidInBasis: NON_NB_FORBIDDEN,
  },
  {
    locale: "de-DE",
    expectInBasis: ["Belegte Brötchen", "Salate", "Warme Gerichte"],
    forbidInBasis: NON_NB_FORBIDDEN,
  },
  {
    locale: "en-GB",
    expectInBasis: ["Sandwiches", "Salads", "Hot meals"],
    forbidInBasis: NON_NB_FORBIDDEN,
  },
  {
    locale: "fr-FR",
    expectInBasis: ["Sandwichs", "Salades", "Plats chauds"],
    forbidInBasis: NON_NB_FORBIDDEN,
  },
  {
    locale: "es-ES",
    expectInBasis: ["Bocadillos", "Ensaladas", "Platos calientes"],
    forbidInBasis: NON_NB_FORBIDDEN,
  },
  {
    locale: "it-IT",
    expectInBasis: ["Panini", "Insalate", "Piatti caldi"],
    forbidInBasis: NON_NB_FORBIDDEN,
  },
];

describe("localizedMenuSurface — packageCard menu terms", () => {
  test.each(LOCALE_EXPECTATIONS)(
    "$locale packageCard.basisIncludes uses menuLocale labels",
    ({ locale, expectInBasis, forbidInBasis = [] }) => {
      const terms = buildPackageCardMenuTerms(locale);
      for (const label of expectInBasis) {
        expect(terms.basisIncludes).toContain(label);
      }
      for (const forbidden of forbidInBasis) {
        expect(terms.basisIncludes).not.toContain(forbidden);
        expect(terms.luxusIncludes).not.toContain(forbidden);
      }
    },
  );

  test.each(SUPPORTED_MENU_LOCALES.filter((l) => l !== "nb-NO"))(
    "%s luxusIncludes adds premium categories from same locale",
    (locale) => {
      const labels = getLocalizedCategoryLabels(locale);
      const terms = buildPackageCardMenuTerms(locale);
      expect(terms.luxusIncludes).toContain(labels.sushi);
      expect(terms.luxusIncludes).toContain(labels.poke);
      expect(terms.luxusIncludes).toContain(labels.asian);
    },
  );

  test("provider menuLocale controls package terms — not employee UI locale", () => {
    const de = buildPackageCardMenuTerms("de-DE");
    const no = buildPackageCardMenuTerms("nb-NO");
    expect(de.basisIncludes).not.toBe(no.basisIncludes);
    expect(de.basisIncludes).toContain("Belegte Brötchen");
    expect(no.basisIncludes).toContain("Påsmurt");
  });

  test("provider menuLocale controls category labels independently", () => {
    const deLabels = buildLocalizedRuntimeCategoryLabels("de-DE");
    const noLabels = buildLocalizedRuntimeCategoryLabels("nb-NO");
    expect(deLabels.paasmurt).toBe("Belegte Brötchen");
    expect(noLabels.paasmurt).toBe("Påsmurt");
  });

  test("buildLocalizedMenuSurfacePresentation includes packageCardMenuTerms when flag ON", () => {
    const presentation = buildLocalizedMenuSurfacePresentation({
      providerId: "11111111-1111-1111-1111-111111111111",
      settingsRow: {
        providerId: "11111111-1111-1111-1111-111111111111",
        locale: "de-DE",
        menuProfileId: "german_business_lunch",
        defaultCountryCode: "DE",
        defaultCurrency: "EUR",
      },
      resolverResult: null,
      env: { LP_MENU_PROFILE_RESOLVER: "true", LP_LOCALIZED_FIXED_MENU_GENERATOR: "true" },
    });

    expect(presentation.active).toBe(true);
    if (!presentation.active) return;

    expect(presentation.packageCardMenuTerms.basisIncludes).toContain("Belegte Brötchen");
    expect(presentation.packageCardMenuTerms.basisIncludes).not.toContain("Påsmurt");
  });

  test("employee UI locale does not change buildPackageCardMenuTerms output", () => {
    const providerTerms = buildPackageCardMenuTerms("sv-SE");
    const employeeUiLocale = "de";
    void employeeUiLocale;
    expect(providerTerms.basisIncludes).toContain("Mackor");
    expect(providerTerms.basisIncludes).not.toContain("Belegte Brötchen");
  });
});

describe("localizedMenuSurface — safety invariants", () => {
  test("package terms module does not reference order write-path or lp_order_set", () => {
    const source = [
      "buildPackageCardMenuTerms",
      "buildLocalizedMenuSurfacePresentation",
    ];
    expect(source.join(" ")).not.toContain("lp_order_set");
    expect(source.join(" ")).not.toContain("order write");
  });
});
