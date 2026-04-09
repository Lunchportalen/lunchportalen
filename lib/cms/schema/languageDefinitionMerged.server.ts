import "server-only";

import { getLocalCmsPublishedGlobal } from "@/lib/localRuntime/cmsProvider";
import { getCmsRuntimeStatus } from "@/lib/localRuntime/runtime";
import type { LanguageDefinition } from "@/lib/cms/schema/languageDefinitions";
import { listBaselineLanguageDefinitions, cloneLanguageDefinition } from "@/lib/cms/schema/languageDefinitions";
import {
  mergeAllLanguagesWithOverrides,
  parseLanguageOverridesFromSettingsRoot,
  type LanguageOverridesFile,
} from "@/lib/cms/schema/languageDefinitionMerge";

function baselineOnlyRecord(): Record<string, LanguageDefinition> {
  const out: Record<string, LanguageDefinition> = {};
  for (const b of listBaselineLanguageDefinitions()) {
    out[b.alias] = cloneLanguageDefinition(b);
  }
  return out;
}

export function getMergedLanguageDefinitionsRecord(): Record<string, LanguageDefinition> {
  const rt = getCmsRuntimeStatus();
  if (!rt.usesLocalProvider) {
    return baselineOnlyRecord();
  }
  try {
    const { data } = getLocalCmsPublishedGlobal("settings");
    const overrides: LanguageOverridesFile = parseLanguageOverridesFromSettingsRoot(data);
    return mergeAllLanguagesWithOverrides(overrides);
  } catch {
    return baselineOnlyRecord();
  }
}
