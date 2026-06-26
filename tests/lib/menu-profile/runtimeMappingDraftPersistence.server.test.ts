/**
 * G5d.3d — Runtime mapping draft persistence server helper tests (unit).
 */
import { describe, expect, test } from "vitest";

import { getMenuProfile } from "@/lib/menu-profile/registry";
import { buildMenuProfileRuntimeMapping } from "@/lib/menu-profile/runtimeMapping";
import {
  mapDbRowToRuntimeMappingDraftDto,
  parseRuntimeMappingDraftRequest,
} from "@/lib/menu-profile/runtimeMappingDraftPersistence.server";
import { buildProviderMenuRuntimeMappingProposal } from "@/lib/provider-menu/providerMenuRuntimeMappingProposal";

function sampleDbRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    provider_id: "11111111-1111-1111-1111-111111111111",
    menu_profile_id: "norwegian_company_lunch",
    mapping_version: "g5d.1",
    source_profile_version: null,
    draft_status: "draft",
    mapping_json: { isRuntimeEnabled: false, isShadowOnly: true },
    unmapped_categories_json: [],
    warm_dish_preview_json: [],
    validation_summary_json: { ok: true },
    notes: null,
    created_by: "user-1",
    updated_by: "user-1",
    created_at: "2026-06-26T00:00:00.000Z",
    updated_at: "2026-06-26T00:00:00.000Z",
    archived_at: null,
    ...overrides,
  };
}

function validWriteBody() {
  const profile = getMenuProfile("norwegian_company_lunch");
  const runtimeMapping = buildMenuProfileRuntimeMapping({ menuProfile: profile });
  const proposal = buildProviderMenuRuntimeMappingProposal({
    menuProfile: profile,
    runtimeMapping,
    currency: "NOK",
  });
  return {
    menuProfileId: "norwegian_company_lunch",
    mappingVersion: proposal.mappingVersion,
    draftStatus: "draft" as const,
    mappingJson: { ...proposal },
    unmappedCategoriesJson: [],
    warmDishPreviewJson: [...proposal.warmDishPreview],
    validationSummaryJson: { errorCount: 0 },
  };
}

describe("mapDbRowToRuntimeMappingDraftDto", () => {
  test("maps snake_case DB row to camelCase DTO", () => {
    const dto = mapDbRowToRuntimeMappingDraftDto(sampleDbRow() as any);
    expect(dto.providerId).toBe("11111111-1111-1111-1111-111111111111");
    expect(dto.menuProfileId).toBe("norwegian_company_lunch");
    expect(dto.draftStatus).toBe("draft");
    expect(dto.archivedAt).toBeNull();
  });
});

describe("parseRuntimeMappingDraftRequest", () => {
  test("accepts valid write payload", () => {
    const parsed = parseRuntimeMappingDraftRequest(validWriteBody());
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.value.menuProfileId).toBe("norwegian_company_lunch");
    expect(parsed.value.draftStatus).toBe("draft");
  });

  test("rejects client-supplied providerId", () => {
    const parsed = parseRuntimeMappingDraftRequest({
      ...validWriteBody(),
      providerId: "22222222-2222-2222-2222-222222222222",
    });
    expect(parsed.ok).toBe(false);
  });

  test("rejects archived draftStatus on create", () => {
    const parsed = parseRuntimeMappingDraftRequest({
      ...validWriteBody(),
      draftStatus: "archived",
    });
    expect(parsed.ok).toBe(false);
  });

  test("rejects missing mappingJson", () => {
    const body = validWriteBody();
    delete (body as { mappingJson?: unknown }).mappingJson;
    const parsed = parseRuntimeMappingDraftRequest(body);
    expect(parsed.ok).toBe(false);
  });
});
