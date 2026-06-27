/**
 * G5d.3e — mapping draft save payload builder tests.
 */
import { describe, expect, test } from "vitest";

import { getMenuProfile } from "@/lib/menu-profile/registry";
import { buildMenuProfileRuntimeMapping } from "@/lib/menu-profile/runtimeMapping";
import { buildProviderMenuRuntimeMappingProposal } from "@/lib/provider-menu/providerMenuRuntimeMappingProposal";
import { buildRuntimeMappingDraftSaveRequestBody } from "@/lib/provider-menu/providerMenuRuntimeMappingDraftSavePayload";

function proposalForProfile(profileId: string) {
  const profile = getMenuProfile(profileId as Parameters<typeof getMenuProfile>[0]);
  const runtimeMapping = buildMenuProfileRuntimeMapping({ menuProfile: profile });
  return buildProviderMenuRuntimeMappingProposal({
    menuProfile: profile,
    runtimeMapping,
    currency: "NOK",
  });
}

describe("buildRuntimeMappingDraftSaveRequestBody", () => {
  test("builds draft POST body without providerId", () => {
    const proposal = proposalForProfile("norwegian_company_lunch");
    const body = buildRuntimeMappingDraftSaveRequestBody(proposal);
    expect(body.menuProfileId).toBe("norwegian_company_lunch");
    expect(body.draftStatus).toBe("draft");
    expect(body.mappingVersion).toBe(proposal.mappingVersion);
    expect(Object.keys(body)).not.toContain("providerId");
    expect(body.mappingJson.isShadowOnly).toBe(true);
    expect(body.mappingJson.isRuntimeEnabled).toBe(false);
  });

  test("unmapped categories exclude mapped NO runtime and enterprise upgrade", () => {
    const proposal = proposalForProfile("norwegian_company_lunch");
    const body = buildRuntimeMappingDraftSaveRequestBody(proposal);
    expect(Array.isArray(body.unmappedCategoriesJson)).toBe(true);
    expect(body.unmappedCategoriesJson).not.toContain("enterprise_upgrade");
  });
});
