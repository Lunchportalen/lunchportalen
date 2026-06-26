/**
 * G5d.2 — Runtime mapping proposal view model tests (shadow-only).
 */
import { describe, expect, test } from "vitest";

import { getMenuProfile } from "@/lib/menu-profile/registry";
import { buildMenuProfileRuntimeMapping } from "@/lib/menu-profile/runtimeMapping";
import {
  LP_MENU_PROFILE_RESOLVER_ENV,
  LP_MENU_PROFILE_RUNTIME_MAPPING_PROPOSAL_ENV,
} from "@/lib/menu-profile/featureFlag";
import {
  assertNoRuntimeEnablement,
  buildProviderMenuRuntimeMappingProposal,
  buildProviderMenuRuntimeMappingProposalPresentation,
} from "@/lib/provider-menu/providerMenuRuntimeMappingProposal";
import { resolveMenuProfileForProvider } from "@/lib/menu-profile/resolver";

const PROPOSAL_FLAGS = {
  [LP_MENU_PROFILE_RESOLVER_ENV]: "true",
  [LP_MENU_PROFILE_RUNTIME_MAPPING_PROPOSAL_ENV]: "true",
};

const RESOLVER_ONLY = {
  [LP_MENU_PROFILE_RESOLVER_ENV]: "true",
  [LP_MENU_PROFILE_RUNTIME_MAPPING_PROPOSAL_ENV]: "false",
};

function proposalForProfile(profileId: string) {
  const profile = getMenuProfile(profileId as Parameters<typeof getMenuProfile>[0]);
  const runtimeMapping = buildMenuProfileRuntimeMapping({ menuProfile: profile });
  return buildProviderMenuRuntimeMappingProposal({
    menuProfile: profile,
    runtimeMapping,
    currency: "NOK",
  });
}

describe("G5d.2 — NO profile runtime mapping proposal", () => {
  const proposal = proposalForProfile("norwegian_company_lunch");

  test.each([
    ["salatboks", "salat", "salatboks", "salatboks"],
    ["thaimat", "thai", "thaimat", "thaimat"],
    ["varmrett", "varmrett", "varmrett", "varmmat"],
  ] as const)("%s maps to runtime keys", (profileKey, category, lunch, order) => {
    const item = proposal.categories.find((c) => c.profileCategoryKey === profileKey);
    expect(item?.runtimeCategoryKey).toBe(category);
    expect(item?.runtimeLunchCategoryKey).toBe(lunch);
    expect(item?.runtimeOrderChoiceKey).toBe(order);
    expect(item?.status).toBe("mapped_existing_no_runtime");
  });

  test("all save/publish/order flags remain false", () => {
    for (const category of proposal.categories) {
      expect(category.canSaveToMenuDay).toBe(false);
      expect(category.canSaveToCatalog).toBe(false);
      expect(category.canPublish).toBe(false);
      expect(category.canOrder).toBe(false);
    }
    assertNoRuntimeEnablement(proposal);
  });

  test("summary runtimeEnabledCount is always 0", () => {
    expect(proposal.summary.runtimeEnabledCount).toBe(0);
    expect(proposal.summary.canSaveCount).toBe(0);
    expect(proposal.summary.canPublishCount).toBe(0);
    expect(proposal.summary.canOrderCount).toBe(0);
    expect(proposal.isRuntimeEnabled).toBe(false);
    expect(proposal.isShadowOnly).toBe(true);
  });

  test("enterprise upgrade is not order category", () => {
    const upgrade = proposal.categories.find((c) => c.profileCategoryKey === "enterprise_upgrade");
    expect(upgrade?.status).toBe("enterprise_upgrade");
    expect(upgrade?.canOrder).toBe(false);
    expect(upgrade?.runtimeCategoryKey).toBeNull();
  });
});

describe("G5d.2 — IT profile shadow-only proposal", () => {
  const proposal = proposalForProfile("italian_office_lunch");

  test.each(["panini", "insalata", "primo_del_giorno"] as const)(
    "%s has null runtime keys",
    (profileKey) => {
      const item = proposal.categories.find((c) => c.profileCategoryKey === profileKey);
      expect(item?.runtimeCategoryKey).toBeNull();
      expect(item?.runtimeLunchCategoryKey).toBeNull();
      expect(item?.runtimeOrderChoiceKey).toBeNull();
      expect(item?.status).toBe("shadow_only_non_no");
      expect(item?.canOrder).toBe(false);
    },
  );
});

describe("G5d.2 — DE profile shadow-only proposal", () => {
  const proposal = proposalForProfile("german_business_lunch");

  test.each(["belegte_broetchen", "warme_mahlzeit", "vegetarische_option"] as const)(
    "%s has null runtime keys",
    (profileKey) => {
      const item = proposal.categories.find((c) => c.profileCategoryKey === profileKey);
      expect(item?.runtimeCategoryKey).toBeNull();
      expect(item?.canOrder).toBe(false);
      expect(item?.status).toBe("shadow_only_non_no");
    },
  );
});

describe("G5d.2 — warm dish preview mapping in proposal", () => {
  const proposal = proposalForProfile("norwegian_company_lunch");

  test("warm dish preview IDs are preview-only", () => {
    expect(proposal.warmDishPreview.length).toBeGreaterThan(0);
    for (const item of proposal.warmDishPreview) {
      expect(item.warmDishPreviewId.startsWith("warm-dish-preview:")).toBe(true);
      expect(item.canApplyToMenu).toBe(false);
      expect(item.canPublish).toBe(false);
      expect(item.canOrder).toBe(false);
      expect(item.status).toBe("preview_only");
    }
  });
});

describe("G5d.2 — proposal presentation flag gating", () => {
  test("proposal flag OFF returns inactive", () => {
    const resolver = resolveMenuProfileForProvider({
      menuProfileId: "norwegian_company_lunch",
      env: RESOLVER_ONLY,
    });
    const mapping = buildMenuProfileRuntimeMapping({
      menuProfile: getMenuProfile("norwegian_company_lunch"),
    });
    const presentation = buildProviderMenuRuntimeMappingProposalPresentation(
      resolver,
      "NOK",
      mapping,
      RESOLVER_ONLY,
    );
    expect(presentation.active).toBe(false);
  });

  test("resolver ON + proposal ON returns active proposal", () => {
    const resolver = resolveMenuProfileForProvider({
      menuProfileId: "norwegian_company_lunch",
      env: PROPOSAL_FLAGS,
    });
    const mapping = buildMenuProfileRuntimeMapping({
      menuProfile: getMenuProfile("norwegian_company_lunch"),
    });
    const presentation = buildProviderMenuRuntimeMappingProposalPresentation(
      resolver,
      "NOK",
      mapping,
      PROPOSAL_FLAGS,
    );
    expect(presentation.active).toBe(true);
    if (!presentation.active) return;
    expect(presentation.summary.mappedCategoryCount).toBeGreaterThan(0);
  });
});

describe("G5d.2 — assertNoRuntimeEnablement throws on accidental enablement", () => {
  test("throws when isRuntimeEnabled is true", () => {
    const proposal = proposalForProfile("norwegian_company_lunch");
    const tampered = { ...proposal, isRuntimeEnabled: true as false };
    expect(() => assertNoRuntimeEnablement(tampered)).toThrow(/isRuntimeEnabled/);
  });

  test("throws when category canOrder is true", () => {
    const proposal = proposalForProfile("norwegian_company_lunch");
    const tampered = {
      ...proposal,
      categories: proposal.categories.map((c, i) =>
        i === 0 ? { ...c, canOrder: true as false } : c,
      ),
    };
    expect(() => assertNoRuntimeEnablement(tampered)).toThrow(/canOrder/);
  });
});
