import "server-only";

import {
  mergeAllDocumentTypesWithOverrides,
  parseDocumentTypeOverridesFromSettingsRoot,
  type DocumentTypeOverridesFile,
} from "@/lib/cms/schema/documentTypeDefinitionMerge";
import { expandDocumentTypeWithCompositions } from "@/lib/cms/schema/documentTypeCompositionExpand";
import type { DocumentTypeDefinition } from "@/lib/cms/schema/documentTypeDefinitions";
import { listBaselineDocumentTypeDefinitions } from "@/lib/cms/schema/documentTypeDefinitions";
import { getMergedCompositionDefinitionsRecord } from "@/lib/cms/schema/compositionDefinitionMerged.server";
import { getLocalCmsPublishedGlobal } from "@/lib/localRuntime/cmsProvider";
import { getCmsRuntimeStatus } from "@/lib/localRuntime/runtime";

function baselineCoreRecord(): Record<string, DocumentTypeDefinition> {
  const out: Record<string, DocumentTypeDefinition> = {};
  for (const b of listBaselineDocumentTypeDefinitions()) {
    out[b.alias] = {
      ...b,
      allowedChildTypes: [...b.allowedChildTypes],
      compositionAliases: [...b.compositionAliases],
      templates: [...b.templates],
      groups: b.groups.map((g) => ({ ...g })),
      properties: b.properties.map((p) => ({
        ...p,
        validation: p.validation ? { ...p.validation } : undefined,
        editorHints: p.editorHints ? { ...p.editorHints } : undefined,
      })),
    };
  }
  return out;
}

/** U97 — Kjerne document types (uten composition-ekspansjon). */
export function getMergedDocumentTypeDefinitionsCoreRecord(): Record<string, DocumentTypeDefinition> {
  const rt = getCmsRuntimeStatus();
  if (!rt.usesLocalProvider) {
    return baselineCoreRecord();
  }
  try {
    const { data } = getLocalCmsPublishedGlobal("settings");
    const overrides: DocumentTypeOverridesFile = parseDocumentTypeOverridesFromSettingsRoot(data);
    return mergeAllDocumentTypesWithOverrides(overrides);
  } catch {
    return baselineCoreRecord();
  }
}

/**
 * U96/U97 — Effektive document types for editor/runtime (composition-properties injisert).
 */
export function getMergedDocumentTypeDefinitionsRecord(): Record<string, DocumentTypeDefinition> {
  const core = getMergedDocumentTypeDefinitionsCoreRecord();
  let compositions: ReturnType<typeof getMergedCompositionDefinitionsRecord>;
  try {
    compositions = getMergedCompositionDefinitionsRecord();
  } catch {
    compositions = {};
  }
  const out: Record<string, DocumentTypeDefinition> = {};
  for (const k of Object.keys(core)) {
    out[k] = expandDocumentTypeWithCompositions(core[k], compositions);
  }
  return out;
}
