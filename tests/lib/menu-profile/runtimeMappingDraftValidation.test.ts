/**
 * G5d.3c — Runtime mapping draft validation helper tests (pure, shadow-only).
 */
import { describe, expect, test } from "vitest";

import { getMenuProfile } from "@/lib/menu-profile/registry";
import { buildMenuProfileRuntimeMapping } from "@/lib/menu-profile/runtimeMapping";
import {
  assertValidRuntimeMappingDraft,
  validateRuntimeMappingDraft,
  type RuntimeMappingDraftValidationInput,
} from "@/lib/menu-profile/runtimeMappingDraftValidation";
import {
  buildProviderMenuRuntimeMappingProposal,
  type ProviderMenuRuntimeMappingProposal,
} from "@/lib/provider-menu/providerMenuRuntimeMappingProposal";

const PROVIDER_ID = "11111111-1111-1111-1111-111111111111";

function proposalForProfile(profileId: string): ProviderMenuRuntimeMappingProposal {
  const profile = getMenuProfile(profileId as Parameters<typeof getMenuProfile>[0]);
  const runtimeMapping = buildMenuProfileRuntimeMapping({ menuProfile: profile });
  return buildProviderMenuRuntimeMappingProposal({
    menuProfile: profile,
    runtimeMapping,
    currency: profileId === "german_business_lunch" ? "EUR" : profileId === "italian_office_lunch" ? "EUR" : "NOK",
  });
}

function buildDraftInputFromProposal(
  proposal: ProviderMenuRuntimeMappingProposal,
  menuProfileId: string,
): RuntimeMappingDraftValidationInput {
  const unmapped = proposal.categories
    .filter((c) => c.status !== "mapped_existing_no_runtime" && c.status !== "enterprise_upgrade")
    .map((c) => c.profileCategoryKey);

  return {
    providerId: PROVIDER_ID,
    menuProfileId,
    mappingVersion: proposal.mappingVersion,
    draftStatus: "draft",
    mappingJson: { ...proposal },
    unmappedCategoriesJson: unmapped,
    warmDishPreviewJson: [...proposal.warmDishPreview],
    validationSummaryJson: { validatedAt: "2026-06-26T00:00:00.000Z", errorCount: 0 },
  };
}

describe("G5d.3c — valid NO shadow draft passes", () => {
  test("norwegian_company_lunch proposal snapshot validates", () => {
    const proposal = proposalForProfile("norwegian_company_lunch");
    const input = buildDraftInputFromProposal(proposal, "norwegian_company_lunch");
    const result = validateRuntimeMappingDraft(input);
    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
    assertValidRuntimeMappingDraft(input);
  });
});

describe("G5d.3c — valid IT shadow draft passes", () => {
  test("italian_office_lunch with all runtime null validates", () => {
    const proposal = proposalForProfile("italian_office_lunch");
    for (const category of proposal.categories) {
      if (category.status !== "mapped_existing_no_runtime") {
        expect(category.runtimeCategoryKey).toBeNull();
        expect(category.runtimeOrderChoiceKey).toBeNull();
      }
    }
    const input = buildDraftInputFromProposal(proposal, "italian_office_lunch");
    const result = validateRuntimeMappingDraft(input);
    expect(result.ok).toBe(true);
  });
});

describe("G5d.3c — valid DE shadow draft passes", () => {
  test("german_business_lunch with all runtime null validates", () => {
    const proposal = proposalForProfile("german_business_lunch");
    for (const category of proposal.categories) {
      if (category.status !== "mapped_existing_no_runtime") {
        expect(category.runtimeCategoryKey).toBeNull();
        expect(category.runtimeOrderChoiceKey).toBeNull();
      }
    }
    const input = buildDraftInputFromProposal(proposal, "german_business_lunch");
    const result = validateRuntimeMappingDraft(input);
    expect(result.ok).toBe(true);
  });
});

describe("G5d.3c — rejects runtime enablement", () => {
  const base = buildDraftInputFromProposal(
    proposalForProfile("norwegian_company_lunch"),
    "norwegian_company_lunch",
  );

  test.each([
    ["isRuntimeEnabled", { isRuntimeEnabled: true }],
    ["canPublish category", { categories: [{ profileCategoryKey: "x", canPublish: true }] }],
    ["canOrder category", { categories: [{ profileCategoryKey: "x", canOrder: true }] }],
    ["canSaveToMenuDay", { categories: [{ profileCategoryKey: "x", canSaveToMenuDay: true }] }],
    ["canSaveToCatalog", { categories: [{ profileCategoryKey: "x", canSaveToCatalog: true }] }],
  ] as const)("rejects %s", (_label, patch) => {
    const mappingJson = {
      ...(base.mappingJson as Record<string, unknown>),
      isShadowOnly: true,
      isRuntimeEnabled: false,
      summary: {
        runtimeEnabledCount: 0,
        canSaveCount: 0,
        canPublishCount: 0,
        canOrderCount: 0,
      },
      ...patch,
    };
    const result = validateRuntimeMappingDraft({ ...base, mappingJson });
    expect(result.ok).toBe(false);
  });
});

describe("G5d.3c — rejects employee visibility", () => {
  test.each(["employeeVisible", "visibleToEmployees"] as const)("rejects %s=true", (field) => {
    const base = buildDraftInputFromProposal(
      proposalForProfile("norwegian_company_lunch"),
      "norwegian_company_lunch",
    );
    const result = validateRuntimeMappingDraft({
      ...base,
      mappingJson: { ...(base.mappingJson as object), [field]: true },
    });
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.code === "employee_visible_not_allowed")).toBe(true);
  });
});

describe("G5d.3c — rejects publish/order activation", () => {
  test.each(["publishEnabled", "orderEnabled"] as const)("rejects %s=true", (field) => {
    const base = buildDraftInputFromProposal(
      proposalForProfile("norwegian_company_lunch"),
      "norwegian_company_lunch",
    );
    const result = validateRuntimeMappingDraft({
      ...base,
      mappingJson: { ...(base.mappingJson as object), [field]: true },
    });
    expect(result.ok).toBe(false);
  });
});

describe("G5d.3c — rejects Sanity write fields", () => {
  const base = buildDraftInputFromProposal(
    proposalForProfile("norwegian_company_lunch"),
    "norwegian_company_lunch",
  );

  test.each(["sanityDocumentId", "sanityId", "sanityDocumentRef"] as const)(
    "rejects %s",
    (field) => {
      const result = validateRuntimeMappingDraft({
        ...base,
        mappingJson: {
          ...(base.mappingJson as object),
          [field]: "doc-123",
        },
      });
      expect(result.ok).toBe(false);
      expect(result.errors.some((e) => e.code === "sanity_document_id_not_allowed")).toBe(true);
    },
  );

  test("rejects warm-dish-preview ID as sanityDocumentId", () => {
    const result = validateRuntimeMappingDraft({
      ...base,
      mappingJson: {
        ...(base.mappingJson as object),
        sanityDocumentId: "warm-dish-preview:norwegian_company_lunch:kjottkaker",
      },
    });
    expect(result.ok).toBe(false);
    expect(
      result.errors.some((e) => e.code === "warm_dish_preview_sanity_id_not_allowed"),
    ).toBe(true);
  });
});

describe("G5d.3c — rejects profile keys in order choice fields", () => {
  const base = buildDraftInputFromProposal(
    proposalForProfile("italian_office_lunch"),
    "italian_office_lunch",
  );

  test.each([
    ["runtimeOrderChoiceKey", "panini"],
    ["orderChoiceKey", "insalata"],
    ["choiceKey", "belegte_broetchen"],
  ] as const)("rejects %s=%s", (field, value) => {
    const result = validateRuntimeMappingDraft({
      ...base,
      mappingJson: {
        ...(base.mappingJson as object),
        categories: [{ profileCategoryKey: "test", [field]: value }],
      },
    });
    expect(result.ok).toBe(false);
    expect(
      result.errors.some((e) => e.code === "profile_key_in_order_choice_not_allowed"),
    ).toBe(true);
  });
});

describe("G5d.3c — rejects price/currency mutation", () => {
  const base = buildDraftInputFromProposal(
    proposalForProfile("norwegian_company_lunch"),
    "norwegian_company_lunch",
  );

  test.each([
    "price",
    "cost",
    "margin",
    "commission",
    "provisjon",
    "vat",
    "mva",
    "currencyOverride",
    "provider_price_rules",
    "pricePreview",
  ] as const)("rejects %s field", (field) => {
    const result = validateRuntimeMappingDraft({
      ...base,
      mappingJson: { ...(base.mappingJson as object), [field]: 100 },
    });
    expect(result.ok).toBe(false);
    expect(
      result.errors.some((e) => e.code === "price_or_currency_mutation_not_allowed"),
    ).toBe(true);
  });
});

describe("G5d.3c — rejects provider-owned data mutation", () => {
  const base = buildDraftInputFromProposal(
    proposalForProfile("norwegian_company_lunch"),
    "norwegian_company_lunch",
  );

  test.each([
    "catalogTitleOverride",
    "itemTitleOverride",
    "mealTitleOverride",
    "allergenOverride",
    "companyNameOverride",
    "customerNameOverride",
  ] as const)("rejects %s field", (field) => {
    const result = validateRuntimeMappingDraft({
      ...base,
      mappingJson: { ...(base.mappingJson as object), [field]: "Override" },
    });
    expect(result.ok).toBe(false);
    expect(
      result.errors.some((e) => e.code === "provider_owned_title_mutation_not_allowed"),
    ).toBe(true);
  });
});

describe("G5d.3c — rejects invalid JSON shapes", () => {
  const base = buildDraftInputFromProposal(
    proposalForProfile("norwegian_company_lunch"),
    "norwegian_company_lunch",
  );

  test.each([
    ["mappingJson array", { mappingJson: [] }],
    ["mappingJson null", { mappingJson: null }],
    ["mappingJson string", { mappingJson: "bad" }],
    ["unmappedCategoriesJson object", { unmappedCategoriesJson: {} }],
    ["warmDishPreviewJson object", { warmDishPreviewJson: {} }],
    ["validationSummaryJson array", { validationSummaryJson: [] }],
  ] as const)("%s", (_label, patch) => {
    const result = validateRuntimeMappingDraft({ ...base, ...patch });
    expect(result.ok).toBe(false);
  });
});

describe("G5d.3c — rejects invalid profile/status", () => {
  const base = buildDraftInputFromProposal(
    proposalForProfile("norwegian_company_lunch"),
    "norwegian_company_lunch",
  );

  test("rejects bad menuProfileId", () => {
    const result = validateRuntimeMappingDraft({
      ...base,
      menuProfileId: "not_a_real_profile",
    });
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.code === "invalid_menu_profile_id")).toBe(true);
  });

  test("rejects bad draftStatus", () => {
    const result = validateRuntimeMappingDraft({
      ...base,
      draftStatus: "published" as "draft",
    });
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.code === "invalid_draft_status")).toBe(true);
  });
});

describe("G5d.3c — archive invariant", () => {
  const base = buildDraftInputFromProposal(
    proposalForProfile("norwegian_company_lunch"),
    "norwegian_company_lunch",
  );

  test("archived requires archivedAt", () => {
    const result = validateRuntimeMappingDraft({
      ...base,
      draftStatus: "archived",
      archivedAt: null,
    });
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.code === "archived_requires_archived_at")).toBe(true);
  });

  test("non-archived must not have archivedAt", () => {
    const result = validateRuntimeMappingDraft({
      ...base,
      draftStatus: "draft",
      archivedAt: "2026-06-26T12:00:00.000Z",
    });
    expect(result.ok).toBe(false);
    expect(
      result.errors.some((e) => e.code === "non_archived_must_not_have_archived_at"),
    ).toBe(true);
  });

  test("archived with archivedAt passes shape checks", () => {
    const result = validateRuntimeMappingDraft({
      ...base,
      draftStatus: "archived",
      archivedAt: "2026-06-26T12:00:00.000Z",
    });
    expect(result.ok).toBe(true);
  });
});

describe("G5d.3c — assertValidRuntimeMappingDraft", () => {
  test("throws on invalid draft", () => {
    const base = buildDraftInputFromProposal(
      proposalForProfile("norwegian_company_lunch"),
      "norwegian_company_lunch",
    );
    expect(() =>
      assertValidRuntimeMappingDraft({
        ...base,
        mappingJson: { isRuntimeEnabled: true },
      }),
    ).toThrow(/Invalid runtime mapping draft/);
  });

  test("does not throw on valid draft", () => {
    const base = buildDraftInputFromProposal(
      proposalForProfile("norwegian_company_lunch"),
      "norwegian_company_lunch",
    );
    expect(() => assertValidRuntimeMappingDraft(base)).not.toThrow();
  });
});
