import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { LP_MENU_PROFILE_RESOLVER_ENV } from "@/lib/menu-profile/featureFlag";
import { getMenuProfile } from "@/lib/menu-profile/registry";
import { resolveMenuProfileForProvider } from "@/lib/menu-profile/resolver";
import {
  buildProviderMenuWorkspacePresentation,
  categoryLabelFromMenuProfile,
} from "@/lib/provider-menu/providerMenuProfilePresentation";

describe("providerMenuProfilePresentation (G5a — workspace presentation only)", () => {
  it("flag OFF returns inactive presentation", () => {
    const result = resolveMenuProfileForProvider({
      menuProfileId: "italian_office_lunch",
      env: { [LP_MENU_PROFILE_RESOLVER_ENV]: "false" },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const presentation = buildProviderMenuWorkspacePresentation(result, "EUR");
    expect(presentation).toEqual({ active: false });
  });

  it("flag OFF with norwegian profile still returns inactive (legacy_disabled)", () => {
    const result = resolveMenuProfileForProvider({});
    const presentation = buildProviderMenuWorkspacePresentation(result, "NOK");
    expect(presentation).toEqual({ active: false });
  });

  it("flag ON + italian_office_lunch shows IT package presentation", () => {
    const result = resolveMenuProfileForProvider({
      menuProfileId: "italian_office_lunch",
      env: { [LP_MENU_PROFILE_RESOLVER_ENV]: "true" },
    });
    expect(result.ok).toBe(true);
    if (!result.ok || !result.enabled) return;

    const presentation = buildProviderMenuWorkspacePresentation(result, "EUR");
    expect(presentation.active).toBe(true);
    if (!presentation.active) return;

    expect(presentation.meta.profileName).toBe("Pranzo aziendale italiano");
    expect(presentation.meta.market).toBe("IT");
    expect(presentation.meta.locale).toBe("it-IT");

    const basis = presentation.packageTiers.find((p) => p.tier === "BASIS");
    expect(basis?.text).toContain("Panini");
    expect(basis?.text).toContain("Insalata");
    expect(basis?.text).toContain("Primo del giorno");

    const luxus = presentation.packageTiers.find((p) => p.tier === "LUXUS");
    expect(luxus?.text).toContain("Bowl");
    expect(luxus?.text).toContain("Piatto freddo");

    const enterprise = presentation.packageTiers.find((p) => p.tier === "ENTERPRISE");
    expect(enterprise?.text).toContain("Upgrade Enterprise");
  });

  it("flag ON + german_business_lunch shows DE package presentation", () => {
    const result = resolveMenuProfileForProvider({
      menuProfileId: "german_business_lunch",
      env: { [LP_MENU_PROFILE_RESOLVER_ENV]: "true" },
    });
    expect(result.ok).toBe(true);
    if (!result.ok || !result.enabled) return;

    const presentation = buildProviderMenuWorkspacePresentation(result, "EUR");
    expect(presentation.active).toBe(true);
    if (!presentation.active) return;

    expect(presentation.meta.market).toBe("DE");
    expect(presentation.meta.locale).toBe("de-DE");

    const basis = presentation.packageTiers.find((p) => p.tier === "BASIS");
    expect(basis?.text).toContain("Belegte Brötchen");
    expect(basis?.text).toContain("Warme Mahlzeit");

    const luxus = presentation.packageTiers.find((p) => p.tier === "LUXUS");
    expect(luxus?.text).toContain("Vegetarische Option");
  });

  it("norwegian profile mirrors legacy package categories when flag ON", () => {
    const profile = getMenuProfile("norwegian_company_lunch");
    const basisText = profile.packageModel.basis.categoryKeys
      .map((key) => categoryLabelFromMenuProfile(profile, key))
      .join(", ");

    expect(basisText).toContain("Påsmurt");
    expect(basisText).toContain("Salatboks");
    expect(basisText).toContain("Varmrett");
  });

  it("resolver error returns inactive presentation", () => {
    const result = resolveMenuProfileForProvider({
      menuProfileId: "not_a_real_profile",
      env: { [LP_MENU_PROFILE_RESOLVER_ENV]: "true" },
    });
    expect(result.ok).toBe(false);

    const presentation = buildProviderMenuWorkspacePresentation(result, "NOK");
    expect(presentation).toEqual({ active: false });
  });
});

describe("providerMenuProfilePresentation scope guard (G5a)", () => {
  const FORBIDDEN_PATHS = [
    "app/api/provider/menu-days",
    "app/api/provider/menu-catalog",
    "lib/provider-menu/menuDayPayload.ts",
  ];

  it("presentation module does not import forbidden runtime paths", () => {
    const source = readFileSync(
      join(process.cwd(), "lib/provider-menu/providerMenuProfilePresentation.ts"),
      "utf8",
    );
    for (const forbidden of FORBIDDEN_PATHS) {
      expect(source).not.toContain(forbidden);
    }
    expect(source).not.toContain("lp_order_set");
    expect(source).not.toContain("lp_order_advance_status");
  });
});
