import "server-only";

import {
  mergeAllElementTypeRuntimeWithOverrides,
  parseElementTypeRuntimeOverridesFromSettingsRoot,
  type ElementTypeRuntimeMergedEntry,
  type ElementTypeRuntimeOverridesFile,
} from "@/lib/cms/schema/elementTypeRuntimeMerge";
import { BLOCK_TYPE_DEFINITION_BY_ALIAS } from "@/lib/cms/blocks/blockTypeDefinitions";
import { getLocalCmsPublishedGlobal } from "@/lib/localRuntime/cmsProvider";
import { getCmsRuntimeStatus } from "@/lib/localRuntime/runtime";

function baselineOnlyRecord(): Record<string, ElementTypeRuntimeMergedEntry> {
  return mergeAllElementTypeRuntimeWithOverrides({ version: 1, byAlias: {} });
}

export function getMergedElementTypeRuntimeRecord(): Record<string, ElementTypeRuntimeMergedEntry> {
  const rt = getCmsRuntimeStatus();
  if (!rt.usesLocalProvider) {
    return baselineOnlyRecord();
  }
  try {
    const { data } = getLocalCmsPublishedGlobal("settings");
    const overrides: ElementTypeRuntimeOverridesFile = parseElementTypeRuntimeOverridesFromSettingsRoot(data);
    return mergeAllElementTypeRuntimeWithOverrides(overrides);
  } catch {
    return baselineOnlyRecord();
  }
}

export function listElementTypeRuntimeAliases(): string[] {
  return [...Object.keys(BLOCK_TYPE_DEFINITION_BY_ALIAS)].sort((a, b) => a.localeCompare(b, "nb"));
}
