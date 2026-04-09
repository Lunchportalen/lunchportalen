import "server-only";

import {
  cloneCompositionDefinition,
  listBaselineCompositionDefinitions,
} from "@/lib/cms/schema/compositionDefinitions";
import type { CompositionDefinition } from "@/lib/cms/schema/compositionDefinitions";
import {
  mergeAllCompositionsWithOverrides,
  parseCompositionOverridesFromSettingsRoot,
} from "@/lib/cms/schema/compositionDefinitionMerge";
import { getLocalCmsPublishedGlobal } from "@/lib/localRuntime/cmsProvider";
import { getCmsRuntimeStatus } from "@/lib/localRuntime/runtime";

function baselineOnlyRecord(): Record<string, CompositionDefinition> {
  const out: Record<string, CompositionDefinition> = {};
  for (const c of listBaselineCompositionDefinitions()) {
    out[c.alias] = cloneCompositionDefinition(c);
  }
  return out;
}

export function getMergedCompositionDefinitionsRecord(): Record<string, CompositionDefinition> {
  const rt = getCmsRuntimeStatus();
  if (!rt.usesLocalProvider) {
    return baselineOnlyRecord();
  }
  try {
    const { data } = getLocalCmsPublishedGlobal("settings");
    const overrides = parseCompositionOverridesFromSettingsRoot(data);
    return mergeAllCompositionsWithOverrides(overrides);
  } catch {
    return baselineOnlyRecord();
  }
}
