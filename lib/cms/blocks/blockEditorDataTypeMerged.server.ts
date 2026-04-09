import "server-only";

import type { BlockEditorDataTypeDefinition } from "@/lib/cms/blocks/blockEditorDataTypes";
import { listBlockEditorDataTypeDefinitions } from "@/lib/cms/blocks/blockEditorDataTypes";
import {
  mergeAllBlockEditorDataTypesWithOverrides,
  parseOverridesFromSettingsRoot,
  type BlockEditorDataTypeOverridesFile,
} from "@/lib/cms/blocks/blockEditorDataTypeMerge";
import { getLocalCmsPublishedGlobal } from "@/lib/localRuntime/cmsProvider";
import { getCmsRuntimeStatus } from "@/lib/localRuntime/runtime";

function baselineOnlyRecord(): Record<string, BlockEditorDataTypeDefinition> {
  const out: Record<string, BlockEditorDataTypeDefinition> = {};
  for (const b of listBlockEditorDataTypeDefinitions()) {
    out[b.alias] = {
      ...b,
      allowedBlockAliases: [...b.allowedBlockAliases],
      groups: b.groups.map((g) => ({ ...g, blockAliases: [...g.blockAliases] })),
      editorOptions: { ...b.editorOptions },
    };
  }
  return out;
}

/** Leser publisert settings-dokument (local_provider) og merger inn baseline. Uten local_provider: kun baseline-kopi. */
export function getMergedBlockEditorDataTypesRecord(): Record<string, BlockEditorDataTypeDefinition> {
  const rt = getCmsRuntimeStatus();
  if (!rt.usesLocalProvider) {
    return baselineOnlyRecord();
  }
  try {
    const { data } = getLocalCmsPublishedGlobal("settings");
    const overrides: BlockEditorDataTypeOverridesFile = parseOverridesFromSettingsRoot(data);
    return mergeAllBlockEditorDataTypesWithOverrides(overrides);
  } catch {
    return baselineOnlyRecord();
  }
}

export function getMergedBlockEditorDataType(alias: string): BlockEditorDataTypeDefinition | undefined {
  const k = String(alias ?? "").trim();
  if (!k) return undefined;
  return getMergedBlockEditorDataTypesRecord()[k];
}
