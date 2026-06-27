/**
 * G5d.4c — Pure publish shadow evaluation helper tests (read-only, no I/O).
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";

import { getMenuProfile } from "@/lib/menu-profile/registry";
import { buildMenuProfileRuntimeMapping } from "@/lib/menu-profile/runtimeMapping";
import type { RuntimeMappingDraftValidationInput } from "@/lib/menu-profile/runtimeMappingDraftValidationTypes";
import {
  assertValidPublishShadowEvaluation,
  buildBlockedRuntimeActivationReasons,
  buildRuntimeMappingPublishShadowEvaluation,
  extractUnmappedCategories,
  extractWouldMapCategories,
  summarizeWarmDishPreview,
  validatePublishShadowInput,
} from "@/lib/menu-profile/runtimeMappingPublishShadow.server";
import {
  PUBLISH_SHADOW_BASE_BLOCKED_REASONS,
  PUBLISH_SHADOW_FORBIDDEN_DTO_FIELDS,
  type PublishShadowEvaluationDto,
  type RuntimeMappingPublishShadowInput,
} from "@/lib/menu-profile/runtimeMappingPublishShadowTypes";
import {
  buildProviderMenuRuntimeMappingProposal,
  type ProviderMenuRuntimeMappingProposal,
} from "@/lib/provider-menu/providerMenuRuntimeMappingProposal";
import {
  G5D4_PUBLISH_SHADOW_CONTRACT_FIXTURE,
  PUBLISH_SHADOW_CLIENT_FORBIDDEN_BODY_FIELDS,
} from "../../fixtures/g5d4-publish-shadow-contract.constants";

const ROOT = process.cwd();
const SHADOW_HELPER = "lib/menu-profile/runtimeMappingPublishShadow.server.ts";

function proposalForProfile(profileId: string): ProviderMenuRuntimeMappingProposal {
  const profile = getMenuProfile(profileId as Parameters<typeof getMenuProfile>[0]);
  const runtimeMapping = buildMenuProfileRuntimeMapping({ menuProfile: profile });
  return buildProviderMenuRuntimeMappingProposal({
    menuProfile: profile,
    runtimeMapping,
    currency:
      profileId === "german_business_lunch" || profileId === "italian_office_lunch" ? "EUR" : "NOK",
  });
}

function buildShadowInputFromProposal(
  proposal: ProviderMenuRuntimeMappingProposal,
  menuProfileId: string,
  draftId = "draft-shadow-test",
): RuntimeMappingPublishShadowInput {
  const unmapped = proposal.categories
    .filter((c) => c.status !== "mapped_existing_no_runtime" && c.status !== "enterprise_upgrade")
    .map((c) => c.profileCategoryKey);

  return {
    draftId,
    menuProfileId,
    mappingVersion: proposal.mappingVersion,
    mappingJson: { ...proposal },
    unmappedCategoriesJson: unmapped,
    warmDishPreviewJson: [...proposal.warmDishPreview],
    validationSummaryJson: { validatedAt: "2026-06-27T12:00:00.000Z", errorCount: 0 },
    evaluatedAt: "2026-06-27T12:00:00.000Z",
  };
}

function buildDraftValidationInputFromShadow(
  input: RuntimeMappingPublishShadowInput,
): RuntimeMappingDraftValidationInput {
  return {
    providerId: "11111111-1111-1111-1111-111111111111",
    menuProfileId: input.menuProfileId,
    mappingVersion: input.mappingVersion,
    sourceProfileVersion: input.sourceProfileVersion ?? null,
    draftStatus: input.draftStatus ?? "draft",
    mappingJson: input.mappingJson,
    unmappedCategoriesJson: input.unmappedCategoriesJson,
    warmDishPreviewJson: input.warmDishPreviewJson,
    validationSummaryJson: input.validationSummaryJson,
    notes: null,
    archivedAt: null,
  };
}

describe("G5d.4c — builds valid shadow evaluation from valid market drafts", () => {
  test("NO norwegian_company_lunch", () => {
    const input = buildShadowInputFromProposal(
      proposalForProfile("norwegian_company_lunch"),
      "norwegian_company_lunch",
    );
    const dto = buildRuntimeMappingPublishShadowEvaluation(input);
    expect(dto.menuProfileId).toBe("norwegian_company_lunch");
    expect(dto.wouldMapCategories.length).toBeGreaterThan(0);
  });

  test("IT italian_office_lunch", () => {
    const input = buildShadowInputFromProposal(
      proposalForProfile("italian_office_lunch"),
      "italian_office_lunch",
    );
    const dto = buildRuntimeMappingPublishShadowEvaluation(input);
    expect(dto.menuProfileId).toBe("italian_office_lunch");
  });

  test("DE german_business_lunch", () => {
    const input = buildShadowInputFromProposal(
      proposalForProfile("german_business_lunch"),
      "german_business_lunch",
    );
    const dto = buildRuntimeMappingPublishShadowEvaluation(input);
    expect(dto.menuProfileId).toBe("german_business_lunch");
  });
});

describe("G5d.4c — rejects invalid draft via G5d.3c validation", () => {
  const base = buildShadowInputFromProposal(
    proposalForProfile("norwegian_company_lunch"),
    "norwegian_company_lunch",
  );

  test("rejects runtime-enabled draft", () => {
    expect(() =>
      buildRuntimeMappingPublishShadowEvaluation({
        ...base,
        mappingJson: {
          ...(base.mappingJson as Record<string, unknown>),
          isRuntimeEnabled: true,
        },
      }),
    ).toThrow(/Invalid runtime mapping draft for shadow evaluation/);
  });

  test("rejects employeeVisible", () => {
    expect(() =>
      buildRuntimeMappingPublishShadowEvaluation({
        ...base,
        mappingJson: {
          ...(base.mappingJson as object),
          employeeVisible: true,
        },
      }),
    ).toThrow(/employee_visible_not_allowed|Invalid runtime mapping draft/);
  });

  test("rejects publish/order activation flags", () => {
    for (const field of ["publishEnabled", "orderEnabled"] as const) {
      expect(() =>
        buildRuntimeMappingPublishShadowEvaluation({
          ...base,
          mappingJson: { ...(base.mappingJson as object), [field]: true },
        }),
      ).toThrow(/Invalid runtime mapping draft for shadow evaluation/);
    }
  });

  test("rejects Sanity document fields", () => {
    expect(() =>
      buildRuntimeMappingPublishShadowEvaluation({
        ...base,
        mappingJson: {
          ...(base.mappingJson as object),
          sanityDocumentId: "doc-123",
        },
      }),
    ).toThrow(/sanity_document_id_not_allowed|Invalid runtime mapping draft/);
  });

  test("rejects price/currency mutation", () => {
    expect(() =>
      buildRuntimeMappingPublishShadowEvaluation({
        ...base,
        mappingJson: {
          ...(base.mappingJson as object),
          price: 99,
        },
      }),
    ).toThrow(/price_or_currency_mutation_not_allowed|Invalid runtime mapping draft/);
  });

  test("rejects invalid JSON shape", () => {
    expect(() =>
      buildRuntimeMappingPublishShadowEvaluation({
        ...base,
        mappingJson: null,
      }),
    ).toThrow(/Invalid publish shadow input|mappingJson must be a JSON object/);
  });
});

describe("G5d.4c — output invariants", () => {
  test("shadowOnly, zero publishImpact, currentPublishUnchanged", () => {
    const dto = buildRuntimeMappingPublishShadowEvaluation(
      buildShadowInputFromProposal(
        proposalForProfile("norwegian_company_lunch"),
        "norwegian_company_lunch",
      ),
    );

    expect(dto.shadowOnly).toBe(true);
    expect(dto.publishImpact.runtimeWrites).toBe(0);
    expect(dto.publishImpact.sanityWrites).toBe(0);
    expect(dto.publishImpact.orderChanges).toBe(0);
    expect(dto.publishImpact.weekChanges).toBe(0);
    expect(dto.publishImpact.employeeVisibleChanges).toBe(0);
    expect(dto.comparisonToCurrentPublish.currentPublishUnchanged).toBe(true);
  });

  test("DTO does not include providerId or source-of-truth fields", () => {
    const dto = buildRuntimeMappingPublishShadowEvaluation(
      buildShadowInputFromProposal(
        proposalForProfile("norwegian_company_lunch"),
        "norwegian_company_lunch",
      ),
    );

    for (const field of PUBLISH_SHADOW_FORBIDDEN_DTO_FIELDS) {
      expect(Object.keys(dto)).not.toContain(field);
    }
    for (const field of PUBLISH_SHADOW_CLIENT_FORBIDDEN_BODY_FIELDS) {
      if (field === "providerId" || field === "sourceOfTruth" || field === "employeeVisible") {
        expect(Object.keys(dto)).not.toContain(field);
      }
    }
  });

  test("blockedRuntimeActivationReasons includes shadow-only guard reasons", () => {
    const dto = buildRuntimeMappingPublishShadowEvaluation(
      buildShadowInputFromProposal(
        proposalForProfile("norwegian_company_lunch"),
        "norwegian_company_lunch",
      ),
    );

    for (const reason of PUBLISH_SHADOW_BASE_BLOCKED_REASONS) {
      expect(dto.blockedRuntimeActivationReasons).toContain(reason);
    }
  });

  test("assertValidPublishShadowEvaluation throws if publishImpact counter is non-zero", () => {
    const dto = buildRuntimeMappingPublishShadowEvaluation(
      buildShadowInputFromProposal(
        proposalForProfile("norwegian_company_lunch"),
        "norwegian_company_lunch",
      ),
    );

    const tampered = {
      ...dto,
      publishImpact: { ...dto.publishImpact, runtimeWrites: 1 as 0 },
    } as PublishShadowEvaluationDto;

    expect(() => assertValidPublishShadowEvaluation(tampered)).toThrow(
      /publishImpact\.runtimeWrites must remain 0/,
    );
  });
});

describe("G5d.4c — pure extractors", () => {
  test("extractWouldMapCategories reads proposal categories", () => {
    const proposal = proposalForProfile("norwegian_company_lunch");
    const mapped = extractWouldMapCategories(proposal);
    expect(mapped.length).toBe(proposal.categories.length);
    expect(mapped[0]?.profileCategoryKey).toBeTruthy();
  });

  test("extractUnmappedCategories stringifies array entries", () => {
    expect(extractUnmappedCategories(["a", "b"])).toEqual(["a", "b"]);
  });

  test("summarizeWarmDishPreview returns previewOnly summary", () => {
    const proposal = proposalForProfile("norwegian_company_lunch");
    expect(summarizeWarmDishPreview(proposal.warmDishPreview)).toEqual({
      count: proposal.warmDishPreview.length,
      previewOnly: true,
    });
  });

  test("buildBlockedRuntimeActivationReasons merges validation summary extras", () => {
    const reasons = buildBlockedRuntimeActivationReasons(
      { blockedReasons: ["extra_validation_note"] },
      {},
    );
    expect(reasons).toContain("shadow_only_no_runtime_writes");
    expect(reasons).toContain("extra_validation_note");
  });

  test("validatePublishShadowInput catches missing draftId", () => {
    const input = buildShadowInputFromProposal(
      proposalForProfile("norwegian_company_lunch"),
      "norwegian_company_lunch",
    );
    const errors = validatePublishShadowInput({ ...input, draftId: "" });
    expect(errors.some((e) => e.path === "draftId")).toBe(true);
  });
});

describe("G5d.4c — does not mutate input", () => {
  test("input snapshot unchanged after evaluation", () => {
    const input = buildShadowInputFromProposal(
      proposalForProfile("norwegian_company_lunch"),
      "norwegian_company_lunch",
    );
    const before = JSON.stringify(input);
    buildRuntimeMappingPublishShadowEvaluation(input);
    expect(JSON.stringify(input)).toBe(before);
  });
});

describe("G5d.4c — module isolation", () => {
  test("shadow helper source has no Supabase/Sanity/order/week/publish imports", () => {
    const src = fs.readFileSync(path.join(ROOT, SHADOW_HELPER), "utf8");
    expect(src).not.toMatch(/from\s+["']@\/lib\/supabase/);
    expect(src).not.toMatch(/requireSanityWrite|sanityWriteClient|menuCatalogWrite/);
    expect(src).not.toMatch(/lp_order_set|lp_order_advance_status/);
    expect(src).not.toMatch(/syncMenuServiceDay|runMenuWeekRollout|buildMenuDayPayload|tripletex/i);
    expect(src).toContain('"server-only"');
  });

  test("shadow helper uses G5d.3c validation", () => {
    const src = fs.readFileSync(path.join(ROOT, SHADOW_HELPER), "utf8");
    expect(src).toContain("assertValidRuntimeMappingDraft");
    expect(src).toContain("validateRuntimeMappingDraft");
  });
});

describe("G5d.4c — aligns with G5d.4b contract fixture shape", () => {
  test("evaluation DTO matches fixture contract minus providerId", () => {
    const fixture = G5D4_PUBLISH_SHADOW_CONTRACT_FIXTURE;
    const dto = buildRuntimeMappingPublishShadowEvaluation({
      draftId: fixture.draftId,
      menuProfileId: fixture.menuProfileId,
      mappingVersion: fixture.mappingVersion,
      mappingJson: {
        ...proposalForProfile(fixture.menuProfileId),
        categories: fixture.wouldMapCategories.map((c) => ({
          profileCategoryKey: c.profileCategoryKey,
          runtimeCategoryKey: c.runtimeCategoryKey ?? null,
          runtimeLunchCategoryKey: c.runtimeLunchCategoryKey ?? null,
          runtimeOrderChoiceKey: c.runtimeOrderChoiceKey ?? null,
          status: c.status,
          canSaveToMenuDay: false,
          canSaveToCatalog: false,
          canPublish: false,
          canOrder: false,
        })),
        isShadowOnly: true,
        isRuntimeEnabled: false,
        summary: {
          runtimeEnabledCount: 0,
          canSaveCount: 0,
          canPublishCount: 0,
          canOrderCount: 0,
        },
      },
      unmappedCategoriesJson: fixture.unmappedCategories,
      warmDishPreviewJson: Array.from({ length: fixture.warmDishPreviewSummary.count }),
      validationSummaryJson: { validatedAt: fixture.evaluatedAt, errorCount: 0 },
      evaluatedAt: fixture.evaluatedAt,
    });

    expect(dto.shadowOnly).toBe(fixture.shadowOnly);
    expect(dto.publishImpact).toEqual(fixture.publishImpact);
    expect(dto.comparisonToCurrentPublish.currentPublishUnchanged).toBe(
      fixture.comparisonToCurrentPublish.currentPublishUnchanged,
    );
    expect(dto.warmDishPreviewSummary.previewOnly).toBe(fixture.warmDishPreviewSummary.previewOnly);
    expect(dto.unmappedCategories).toEqual(fixture.unmappedCategories);
    expect(Object.keys(dto)).not.toContain("providerId");
  });
});

describe("G5d.4c — draft validation input bridge", () => {
  test("valid shadow input maps to valid G5d.3c draft validation input", () => {
    const input = buildShadowInputFromProposal(
      proposalForProfile("norwegian_company_lunch"),
      "norwegian_company_lunch",
    );
    const draftInput = buildDraftValidationInputFromShadow(input);
    expect(draftInput.menuProfileId).toBe("norwegian_company_lunch");
    expect(draftInput.mappingJson).toEqual(input.mappingJson);
  });
});
