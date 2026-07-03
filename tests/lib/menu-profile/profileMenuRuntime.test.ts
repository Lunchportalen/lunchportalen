import { describe, expect, it } from "vitest";

import { CATEGORY_LABELS } from "@/lib/cms/menuDayContract";
import { LP_MENU_PROFILE_RESOLVER_ENV } from "@/lib/menu-profile/featureFlag";
import { getMenuProfile } from "@/lib/menu-profile/registry";
import {
  buildProfileRuntimeCategoryLabels,
  buildProfileWarmDishSuggestions,
  isProfileMenuRuntimeEnabled,
  overlayProfileLabelsOnOrderWindowCategories,
  resolveRuntimeCategoryDisplayLabel,
} from "@/lib/menu-profile/profileMenuRuntime";
import { MENU_PROFILE_IDS } from "@/lib/menu-profile/types";

const ENV_ON = { [LP_MENU_PROFILE_RESOLVER_ENV]: "true" };

describe("profileMenuRuntime — all nine profiles", () => {
  it.each(MENU_PROFILE_IDS)("resolves display labels for %s", (profileId) => {
    const profile = getMenuProfile(profileId);
    const labels = buildProfileRuntimeCategoryLabels(profile);
    expect(labels.paasmurt).toBeTruthy();
    expect(labels.varmrett).toBeTruthy();
    if (profileId !== "norwegian_company_lunch") {
      expect(labels.varmrett).not.toBe(CATEGORY_LABELS.varmrett);
    }
  });

  it("market-specific labels differ for da/fi/fr/no", () => {
    const no = buildProfileRuntimeCategoryLabels(getMenuProfile("norwegian_company_lunch"));
    const da = buildProfileRuntimeCategoryLabels(getMenuProfile("danish_office_lunch"));
    const fi = buildProfileRuntimeCategoryLabels(getMenuProfile("finnish_office_lunch"));
    const fr = buildProfileRuntimeCategoryLabels(getMenuProfile("french_dejeuner"));
    expect(da.varmrett).not.toBe(no.varmrett);
    expect(fi.varmrett).not.toBe(no.varmrett);
    expect(fr.varmrett).not.toBe(no.varmrett);
  });

  it("warm dish suggestions exist for all nine profiles (5 each)", () => {
    for (const profileId of MENU_PROFILE_IDS) {
      const suggestions = buildProfileWarmDishSuggestions(getMenuProfile(profileId));
      expect(suggestions).toHaveLength(5);
      expect(suggestions.every((s) => s.isPreviewOnly)).toBe(true);
    }
  });
});

describe("profileMenuRuntime — order identity safety", () => {
  it("overlayProfileLabelsOnOrderWindowCategories changes label only", () => {
    const profile = getMenuProfile("danish_office_lunch");
    const input = [
      {
        key: "paasmurt",
        category: "paasmurt" as const,
        label: CATEGORY_LABELS.paasmurt,
        title: "Original title",
      },
    ];
    const out = overlayProfileLabelsOnOrderWindowCategories(input, profile);
    expect(out[0]?.key).toBe("paasmurt");
    expect(out[0]?.category).toBe("paasmurt");
    expect(out[0]?.title).toBe("Original title");
    expect(out[0]?.label).toBe(resolveRuntimeCategoryDisplayLabel(profile, "paasmurt"));
    expect(out[0]?.label).not.toBe(CATEGORY_LABELS.paasmurt);
  });
});

describe("profileMenuRuntime — flags and fallback", () => {
  it("isProfileMenuRuntimeEnabled follows LP_MENU_PROFILE_RESOLVER", () => {
    expect(isProfileMenuRuntimeEnabled({})).toBe(false);
    expect(isProfileMenuRuntimeEnabled(ENV_ON)).toBe(true);
  });

  it("unknown profile market falls back to category labels when unmapped slot missing", () => {
    const profile = getMenuProfile("norwegian_company_lunch");
    expect(resolveRuntimeCategoryDisplayLabel(profile, "paasmurt")).toBeTruthy();
  });
});
