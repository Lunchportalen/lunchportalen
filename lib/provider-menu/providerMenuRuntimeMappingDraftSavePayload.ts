/**
 * G5d.3e — Pure client/server payload builder for mapping draft save (no I/O).
 */

import type { ProviderMenuRuntimeMappingProposal } from "@/lib/provider-menu/providerMenuRuntimeMappingProposal";

export type RuntimeMappingDraftSaveRequestBody = {
  menuProfileId: string;
  mappingVersion: string;
  sourceProfileVersion?: string | null;
  draftStatus: "draft";
  mappingJson: ProviderMenuRuntimeMappingProposal;
  unmappedCategoriesJson: string[];
  warmDishPreviewJson: ProviderMenuRuntimeMappingProposal["warmDishPreview"];
  validationSummaryJson: Record<string, unknown>;
  notes?: string | null;
};

export function buildRuntimeMappingDraftSaveRequestBody(
  proposal: ProviderMenuRuntimeMappingProposal,
): RuntimeMappingDraftSaveRequestBody {
  const unmappedCategoriesJson = proposal.categories
    .filter(
      (category) =>
        category.status !== "mapped_existing_no_runtime" &&
        category.status !== "enterprise_upgrade",
    )
    .map((category) => category.profileCategoryKey);

  return {
    menuProfileId: proposal.profileId,
    mappingVersion: proposal.mappingVersion,
    draftStatus: "draft",
    mappingJson: proposal,
    unmappedCategoriesJson,
    warmDishPreviewJson: [...proposal.warmDishPreview],
    validationSummaryJson: {
      clientPreparedAt: new Date().toISOString(),
      errorCount: 0,
    },
  };
}
