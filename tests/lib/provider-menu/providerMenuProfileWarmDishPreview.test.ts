import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  LP_MENU_PROFILE_RESOLVER_ENV,
  LP_MENU_PROFILE_WARM_DISH_PREVIEW_ENV,
  isMenuProfileWarmDishPreviewEnabled,
  isMenuProfileWarmDishPreviewPanelEnabled,
  MENU_PROFILE_IDS,
} from "@/lib/menu-profile";
import { getWarmDishBankSeedsForProfile } from "@/lib/menu-profile/warmDishBankSeeds";
import { resolveMenuProfileForProvider } from "@/lib/menu-profile/resolver";
import {
  buildMenuProfileWarmDishPreview,
  buildProviderMenuWarmDishPreviewPresentation,
} from "@/lib/provider-menu/providerMenuProfileWarmDishPreview";

const BOTH_FLAGS = {
  [LP_MENU_PROFILE_RESOLVER_ENV]: "true",
  [LP_MENU_PROFILE_WARM_DISH_PREVIEW_ENV]: "true",
};

const RESOLVER_ONLY = {
  [LP_MENU_PROFILE_RESOLVER_ENV]: "true",
  [LP_MENU_PROFILE_WARM_DISH_PREVIEW_ENV]: "false",
};

describe("featureFlag LP_MENU_PROFILE_WARM_DISH_PREVIEW (G5c)", () => {
  it("defaults OFF unless explicitly true or 1", () => {
    expect(isMenuProfileWarmDishPreviewEnabled({})).toBe(false);
    expect(isMenuProfileWarmDishPreviewEnabled({ [LP_MENU_PROFILE_WARM_DISH_PREVIEW_ENV]: "false" })).toBe(
      false,
    );
    expect(isMenuProfileWarmDishPreviewEnabled({ [LP_MENU_PROFILE_WARM_DISH_PREVIEW_ENV]: "true" })).toBe(true);
    expect(isMenuProfileWarmDishPreviewEnabled({ [LP_MENU_PROFILE_WARM_DISH_PREVIEW_ENV]: "1" })).toBe(true);
  });

  it("panel requires both resolver and warm-dish-preview flags", () => {
    expect(isMenuProfileWarmDishPreviewPanelEnabled({})).toBe(false);
    expect(isMenuProfileWarmDishPreviewPanelEnabled(RESOLVER_ONLY)).toBe(false);
    expect(isMenuProfileWarmDishPreviewPanelEnabled(BOTH_FLAGS)).toBe(true);
  });
});

describe("providerMenuProfileWarmDishPreview (G5c)", () => {
  it("both flags OFF returns inactive presentation", () => {
    const result = resolveMenuProfileForProvider({
      menuProfileId: "norwegian_company_lunch",
      env: {},
    });
    const presentation = buildProviderMenuWarmDishPreviewPresentation(result, "NOK", {});
    expect(presentation).toEqual({ active: false });
  });

  it("G5a ON + G5c OFF returns inactive warm dish preview", () => {
    const result = resolveMenuProfileForProvider({
      menuProfileId: "norwegian_company_lunch",
      env: RESOLVER_ONLY,
    });
    const presentation = buildProviderMenuWarmDishPreviewPresentation(result, "NOK", RESOLVER_ONLY);
    expect(presentation).toEqual({ active: false });
  });

  it.each(MENU_PROFILE_IDS)("profile %s has at least five warm dish preview items when flags ON", (profileId) => {
    const result = resolveMenuProfileForProvider({
      menuProfileId: profileId,
      env: BOTH_FLAGS,
    });
    expect(result.ok).toBe(true);
    if (!result.ok || !result.enabled) return;

    const presentation = buildProviderMenuWarmDishPreviewPresentation(result, "EUR", BOTH_FLAGS);
    expect(presentation.active).toBe(true);
    if (!presentation.active) return;

    expect(presentation.items.length).toBeGreaterThanOrEqual(5);
    expect(presentation.previewOnly).toBe(true);
    expect(presentation.publishRuntimeEnabled).toBe(false);
    expect(presentation.orderRuntimeEnabled).toBe(false);
  });

  it("NO profile shows Norwegian warm dish suggestions", () => {
    const result = resolveMenuProfileForProvider({
      menuProfileId: "norwegian_company_lunch",
      env: BOTH_FLAGS,
    });
    expect(result.ok).toBe(true);
    if (!result.ok || !result.enabled) return;

    const presentation = buildProviderMenuWarmDishPreviewPresentation(result, "NOK", BOTH_FLAGS);
    expect(presentation.active).toBe(true);
    if (!presentation.active) return;

    expect(presentation.items.some((i) => i.title.includes("Kjøttkaker"))).toBe(true);
    expect(presentation.items.some((i) => i.title.includes("Kyllinggryte"))).toBe(true);
    expect(presentation.countryCode).toBe("NO");
    expect(presentation.currency).toBe("NOK");
  });

  it("IT profile shows Italian warm dish suggestions", () => {
    const result = resolveMenuProfileForProvider({
      menuProfileId: "italian_office_lunch",
      env: BOTH_FLAGS,
    });
    expect(result.ok).toBe(true);
    if (!result.ok || !result.enabled) return;

    const presentation = buildProviderMenuWarmDishPreviewPresentation(result, "EUR", BOTH_FLAGS);
    expect(presentation.active).toBe(true);
    if (!presentation.active) return;

    expect(presentation.items.some((i) => i.title.includes("Lasagne"))).toBe(true);
    expect(presentation.items.some((i) => i.title.includes("Risotto"))).toBe(true);
    expect(presentation.locale).toBe("it-IT");
  });

  it("DE profile shows German warm dish suggestions", () => {
    const result = resolveMenuProfileForProvider({
      menuProfileId: "german_business_lunch",
      env: BOTH_FLAGS,
    });
    expect(result.ok).toBe(true);
    if (!result.ok || !result.enabled) return;

    const presentation = buildProviderMenuWarmDishPreviewPresentation(result, "EUR", BOTH_FLAGS);
    expect(presentation.active).toBe(true);
    if (!presentation.active) return;

    expect(presentation.items.some((i) => i.title.includes("Hähnchengeschnetzeltes"))).toBe(true);
    expect(presentation.items.some((i) => i.title.includes("Linseneintopf"))).toBe(true);
  });

  it("all preview items are read-only with no apply/publish paths", () => {
    const result = resolveMenuProfileForProvider({
      menuProfileId: "swedish_lunch",
      env: BOTH_FLAGS,
    });
    expect(result.ok).toBe(true);
    if (!result.ok || !result.enabled) return;

    const presentation = buildProviderMenuWarmDishPreviewPresentation(result, "SEK", BOTH_FLAGS);
    expect(presentation.active).toBe(true);
    if (!presentation.active) return;

    for (const item of presentation.items) {
      expect(item.isPreviewOnly).toBe(true);
      expect(item.canApplyToMenu).toBe(false);
      expect(item.canPublish).toBe(false);
      expect(item.isProviderOwned).toBe(false);
      expect(item.isWarmDish).toBe(true);
      expect(item.id.startsWith("warm-dish-preview:")).toBe(true);
    }
  });

  it("buildMenuProfileWarmDishPreview uses inert seeds only", () => {
    const result = resolveMenuProfileForProvider({
      menuProfileId: "uk_office_lunch",
      env: BOTH_FLAGS,
    });
    expect(result.ok).toBe(true);
    if (!result.ok || !result.enabled) return;

    const seeds = getWarmDishBankSeedsForProfile("uk_office_lunch");
    const preview = buildMenuProfileWarmDishPreview({
      profile: result.profile,
      warmDishBankSeeds: seeds,
      locale: result.profile.locale,
      market: result.profile.market,
      currency: "GBP",
    });

    expect(preview.items).toHaveLength(5);
    expect(preview.items[0]?.title).toBe(seeds[0]?.title);
  });
});

describe("providerMenuProfileWarmDishPreview scope guard (G5c)", () => {
  const FORBIDDEN_PATHS = [
    "app/api/provider/menu-days",
    "app/api/provider/menu-catalog",
    "lib/provider-menu/menuDayPayload.ts",
    "lib/cms/menuDayContract.ts",
  ];

  it("presentation module does not import forbidden runtime paths", () => {
    const source = readFileSync(
      join(process.cwd(), "lib/provider-menu/providerMenuProfileWarmDishPreview.ts"),
      "utf8",
    );
    for (const forbidden of FORBIDDEN_PATHS) {
      expect(source).not.toContain(forbidden);
    }
    expect(source).not.toContain("lp_order_set");
    expect(source).not.toContain("lp_order_advance_status");
  });

  it("ProviderMenuBuilder does not wire warm dish preview into save handlers", () => {
    const source = readFileSync(join(process.cwd(), "components/providers/ProviderMenuBuilder.tsx"), "utf8");
    expect(source).toContain("warmDishPreviewPresentation");
    const saveIdx = source.indexOf("async function save(");
    expect(saveIdx).toBeGreaterThan(-1);
    const saveBlock = source.slice(saveIdx, saveIdx + 4000);
    expect(saveBlock).not.toContain("warmDishPreview");
  });

  it("preview panel has no apply/save/publish actions", () => {
    const source = readFileSync(
      join(process.cwd(), "components/providers/ProviderMenuProfileWarmDishPreviewPanel.tsx"),
      "utf8",
    );
    expect(source).not.toContain("onApply");
    expect(source).not.toContain("onSave");
    expect(source).not.toContain("onPublish");
    expect(source).not.toContain("fetch(");
  });
});
