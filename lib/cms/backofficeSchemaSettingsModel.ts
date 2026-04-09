/**
 * U23/U36 — Read-only schema governance model for Settings-flater (ingen ny sannhetsmotor).
 * Kobler document types, property editor kinds, configured instances, UI-mapping og presets til én delt read-model.
 */

import {
  getBlockDefaultValuesForType,
  getBlockFieldSchema,
  hasSchemaForBlockType,
  isFieldRequiredForBlockType,
  type EditorFieldKind,
} from "@/app/(backoffice)/backoffice/content/_components/blockFieldSchemas";
import { documentTypes, type DocumentTypeEntry } from "@/lib/cms/contentDocumentTypes";
import { EDITOR_BLOCK_CREATE_OPTIONS, type EditorBlockCreateOption } from "@/lib/cms/editorBlockCreateOptions";

/** Speiler Umbraco «data type» / property editor kind — forklaring for redaktør/forvalter. */
export type EditorFieldKindGovernance = {
  kind: EditorFieldKind;
  labelNb: string;
  contractRoleNb: string;
};

export type PropertyEditorUiMapping = {
  id: string;
  labelNb: string;
  descriptionNb: string;
  schemaSourcePath: string;
  formSourcePath: string;
  rendererSourcePath: string;
  supportedKinds: readonly EditorFieldKind[];
};

export type PropertyEditorConfiguredInstance = {
  id: string;
  blockType: string;
  blockLabel: string;
  fieldKey: string;
  fieldLabel: string;
  kind: EditorFieldKind;
  required: boolean;
  optionCount: number;
  defaultValue: string | number | boolean | null;
  defaultValueLabel: string | null;
  documentTypeAliases: string[];
  uiMappingId: string;
  uiLabelNb: string;
};

export type PropertyEditorPresetSummary = {
  id: string;
  blockType: string;
  blockLabel: string;
  defaultValueCount: number;
  defaults: readonly {
    key: string;
    value: string | number | boolean | null;
    valueLabel: string;
  }[];
  fieldKinds: readonly EditorFieldKind[];
  documentTypeAliases: readonly string[];
};

export type PropertyEditorCoverageGap = {
  id: string;
  blockType: string;
  blockLabel: string;
  documentTypeAliases: readonly string[];
  reasonNb: string;
};

export type PropertyEditorKindUsageSummary = EditorFieldKindGovernance & {
  configuredInstanceCount: number;
  blockTypes: readonly string[];
  documentTypeAliases: readonly string[];
  presetCount: number;
  uiMappings: readonly string[];
};

export type DocumentTypeGovernanceSummary = DocumentTypeEntry & {
  allowedBlockTypeCount: number;
  configuredInstanceCount: number;
  fieldKinds: readonly EditorFieldKind[];
  presetBlockTypes: readonly string[];
  unsupportedBlockTypes: readonly string[];
};

export type DocumentTypePropertyEditorFlow = {
  documentType: DocumentTypeGovernanceSummary | null;
  configuredInstances: readonly PropertyEditorConfiguredInstance[];
  presets: readonly PropertyEditorPresetSummary[];
  coverageGaps: readonly PropertyEditorCoverageGap[];
  uiMappings: readonly PropertyEditorUiMapping[];
};

export type PropertyEditorKindFlow = {
  kind: PropertyEditorKindUsageSummary | null;
  configuredInstances: readonly PropertyEditorConfiguredInstance[];
  presets: readonly PropertyEditorPresetSummary[];
  uiMappings: readonly PropertyEditorUiMapping[];
  documentTypes: readonly DocumentTypeGovernanceSummary[];
};

export type PropertyEditorSystemModel = {
  documentTypes: readonly DocumentTypeGovernanceSummary[];
  fieldKinds: readonly PropertyEditorKindUsageSummary[];
  configuredInstances: readonly PropertyEditorConfiguredInstance[];
  presets: readonly PropertyEditorPresetSummary[];
  uiMappings: readonly PropertyEditorUiMapping[];
  unsupportedCreateOptions: readonly PropertyEditorCoverageGap[];
};

/**
 * Må synkroniseres med `EditorFieldKind` i `blockFieldSchemas.ts` (UX-paritet).
 * Endringer i felt-union bør speiles her.
 */
export const EDITOR_FIELD_KIND_GOVERNANCE: readonly EditorFieldKindGovernance[] = [
  { kind: "text", labelNb: "Tekst", contractRoleNb: "Kort streng; maxLength der satt." },
  { kind: "textarea", labelNb: "Lang tekst", contractRoleNb: "Flerlinje brødtekst." },
  {
    kind: "url",
    labelNb: "URL / sti / mediareferanse",
    contractRoleNb: "http(s), /sti, cms:* eller media-ID etter kontrakt.",
  },
  { kind: "link", labelNb: "Lenke (intern/ekstern)", contractRoleNb: "href + valgfri linkKindKey i editor." },
  { kind: "number", labelNb: "Tall", contractRoleNb: "Numerisk verdi der felt krever det." },
  { kind: "select", labelNb: "Valg", contractRoleNb: "options-map: verdi -> etikett." },
  { kind: "media", labelNb: "Media", contractRoleNb: "Kobling til mediearkiv / picker-rolle." },
];

const PROPERTY_EDITOR_UI_MAPPINGS: readonly PropertyEditorUiMapping[] = [
  {
    id: "schema-driven-block-form",
    labelNb: "Schema-driven blokkform",
    descriptionNb:
      "Samme UI-surface som content editor bruker i blokkredigering. Schema bestemmer felt, FieldRenderer bestemmer kontrollen.",
    schemaSourcePath: "app/(backoffice)/backoffice/content/_components/blockFieldSchemas.ts",
    formSourcePath: "app/(backoffice)/backoffice/content/_components/SchemaDrivenBlockForm.tsx",
    rendererSourcePath: "components/backoffice/FieldRenderer.tsx",
    supportedKinds: EDITOR_FIELD_KIND_GOVERNANCE.map((entry) => entry.kind),
  },
] as const;

const ALL_EDITOR_BLOCK_TYPES: readonly string[] = EDITOR_BLOCK_CREATE_OPTIONS.map((option) => option.type);

function formatScalarValue(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined) return "Tom";
  if (typeof value === "boolean") return value ? "true" : "false";
  return String(value);
}

function getBlockLabel(blockType: string): string {
  return EDITOR_BLOCK_CREATE_OPTIONS.find((option) => option.type === blockType)?.label ?? blockType;
}

function documentTypesForBlockType(blockType: string): DocumentTypeEntry[] {
  return documentTypes.filter((documentType) => {
    if (documentType.allowedBlockTypes === undefined) {
      return ALL_EDITOR_BLOCK_TYPES.includes(blockType);
    }
    return documentType.allowedBlockTypes.includes(blockType);
  });
}

function configuredInstancesInternal(): PropertyEditorConfiguredInstance[] {
  const instances: PropertyEditorConfiguredInstance[] = [];
  for (const blockOption of EDITOR_BLOCK_CREATE_OPTIONS) {
    const schema = getBlockFieldSchema(blockOption.type);
    if (schema.length === 0) continue;
    const defaults = getBlockDefaultValuesForType(blockOption.type);
    const docTypeAliases = documentTypesForBlockType(blockOption.type).map((documentType) => documentType.alias);
    for (const field of schema) {
      const defaultValue = (defaults[field.key] ?? null) as string | number | boolean | null;
      instances.push({
        id: `${blockOption.type}.${field.key}`,
        blockType: blockOption.type,
        blockLabel: blockOption.label,
        fieldKey: field.key,
        fieldLabel: field.label,
        kind: field.kind,
        required: isFieldRequiredForBlockType(blockOption.type, field.key, field),
        optionCount: Object.keys(field.options ?? {}).length,
        defaultValue,
        defaultValueLabel: defaults[field.key] === undefined ? null : formatScalarValue(defaultValue),
        documentTypeAliases: docTypeAliases,
        uiMappingId: PROPERTY_EDITOR_UI_MAPPINGS[0]!.id,
        uiLabelNb: PROPERTY_EDITOR_UI_MAPPINGS[0]!.labelNb,
      });
    }
  }
  return instances;
}

function presetsInternal(): PropertyEditorPresetSummary[] {
  return EDITOR_BLOCK_CREATE_OPTIONS.map((option) => {
    const defaults = getBlockDefaultValuesForType(option.type);
    const defaultEntries = Object.entries(defaults).map(([key, value]) => ({
      key,
      value: (value ?? null) as string | number | boolean | null,
      valueLabel: formatScalarValue(value as string | number | boolean | null | undefined),
    }));
    const fieldKinds = Array.from(new Set(getBlockFieldSchema(option.type).map((field) => field.kind)));
    return {
      id: option.type,
      blockType: option.type,
      blockLabel: option.label,
      defaultValueCount: defaultEntries.length,
      defaults: defaultEntries,
      fieldKinds,
      documentTypeAliases: documentTypesForBlockType(option.type).map((documentType) => documentType.alias),
    };
  }).filter((preset) => preset.defaultValueCount > 0);
}

function coverageGapsInternal(): PropertyEditorCoverageGap[] {
  return EDITOR_BLOCK_CREATE_OPTIONS.filter((option) => !hasSchemaForBlockType(option.type)).map((option) => ({
    id: option.type,
    blockType: option.type,
    blockLabel: option.label,
    documentTypeAliases: documentTypesForBlockType(option.type).map((documentType) => documentType.alias),
    reasonNb:
      "Ingen schema-driven blokkform registrert for denne create option enda. Objektet finnes i create-listen, men property editor-systemet kan ikke hevde full form-paritet her.",
  }));
}

function kindUsageInternal(
  configuredInstances: readonly PropertyEditorConfiguredInstance[],
  presets: readonly PropertyEditorPresetSummary[],
): PropertyEditorKindUsageSummary[] {
  return EDITOR_FIELD_KIND_GOVERNANCE.map((entry) => {
    const relatedInstances = configuredInstances.filter((instance) => instance.kind === entry.kind);
    const blockTypes = Array.from(new Set(relatedInstances.map((instance) => instance.blockType)));
    const documentTypeAliases = Array.from(
      new Set(relatedInstances.flatMap((instance) => instance.documentTypeAliases)),
    );
    const presetCount = presets.filter((preset) => preset.fieldKinds.includes(entry.kind)).length;
    return {
      ...entry,
      configuredInstanceCount: relatedInstances.length,
      blockTypes,
      documentTypeAliases,
      presetCount,
      uiMappings: Array.from(new Set(relatedInstances.map((instance) => instance.uiLabelNb))),
    };
  });
}

function documentTypeSummariesInternal(
  configuredInstances: readonly PropertyEditorConfiguredInstance[],
  presets: readonly PropertyEditorPresetSummary[],
  gaps: readonly PropertyEditorCoverageGap[],
): DocumentTypeGovernanceSummary[] {
  return documentTypes.map((documentType) => {
    const allowedBlockTypes =
      documentType.allowedBlockTypes === undefined ? [...ALL_EDITOR_BLOCK_TYPES] : [...documentType.allowedBlockTypes];
    const relatedInstances = configuredInstances.filter((instance) =>
      instance.documentTypeAliases.includes(documentType.alias),
    );
    return {
      ...documentType,
      allowedBlockTypeCount: allowedBlockTypes.length,
      configuredInstanceCount: relatedInstances.length,
      fieldKinds: Array.from(new Set(relatedInstances.map((instance) => instance.kind))),
      presetBlockTypes: presets
        .filter((preset) => preset.documentTypeAliases.includes(documentType.alias))
        .map((preset) => preset.blockType),
      unsupportedBlockTypes: gaps
        .filter((gap) => gap.documentTypeAliases.includes(documentType.alias))
        .map((gap) => gap.blockType),
    };
  });
}

export function getDocumentTypesForGovernance(): readonly DocumentTypeEntry[] {
  return documentTypes;
}

export function getBlockCreateOptionsForGovernance(): readonly EditorBlockCreateOption[] {
  return EDITOR_BLOCK_CREATE_OPTIONS;
}

export function getFieldKindGovernance(): readonly EditorFieldKindGovernance[] {
  return EDITOR_FIELD_KIND_GOVERNANCE;
}

export function getPropertyEditorUiMappings(): readonly PropertyEditorUiMapping[] {
  return PROPERTY_EDITOR_UI_MAPPINGS;
}

export function getPropertyEditorConfiguredInstances(): readonly PropertyEditorConfiguredInstance[] {
  return configuredInstancesInternal();
}

export function getPropertyEditorConfiguredInstancesForDocumentType(
  documentTypeAlias: string,
): readonly PropertyEditorConfiguredInstance[] {
  const alias = documentTypeAlias.trim();
  return configuredInstancesInternal().filter((instance) => instance.documentTypeAliases.includes(alias));
}

export function getPropertyEditorConfiguredInstancesForKind(
  kind: EditorFieldKind,
): readonly PropertyEditorConfiguredInstance[] {
  return configuredInstancesInternal().filter((instance) => instance.kind === kind);
}

export function getPropertyEditorPresetSummaries(): readonly PropertyEditorPresetSummary[] {
  return presetsInternal();
}

export function getPropertyEditorPresetsForDocumentType(
  documentTypeAlias: string,
): readonly PropertyEditorPresetSummary[] {
  const alias = documentTypeAlias.trim();
  return presetsInternal().filter((preset) => preset.documentTypeAliases.includes(alias));
}

export function getPropertyEditorCoverageGaps(): readonly PropertyEditorCoverageGap[] {
  return coverageGapsInternal();
}

export function getPropertyEditorCoverageGapsForDocumentType(
  documentTypeAlias: string,
): readonly PropertyEditorCoverageGap[] {
  const alias = documentTypeAlias.trim();
  return coverageGapsInternal().filter((gap) => gap.documentTypeAliases.includes(alias));
}

export function getFieldKindUsageSummaries(): readonly PropertyEditorKindUsageSummary[] {
  const configuredInstances = configuredInstancesInternal();
  const presets = presetsInternal();
  return kindUsageInternal(configuredInstances, presets);
}

export function getDocumentTypeGovernanceSummaries(): readonly DocumentTypeGovernanceSummary[] {
  const configuredInstances = configuredInstancesInternal();
  const presets = presetsInternal();
  const gaps = coverageGapsInternal();
  return documentTypeSummariesInternal(configuredInstances, presets, gaps);
}

export function getPropertyEditorFlowForDocumentType(
  documentTypeAlias: string,
): DocumentTypePropertyEditorFlow | null {
  const alias = documentTypeAlias.trim();
  if (!alias) return null;
  const configuredInstances = configuredInstancesInternal();
  const presets = presetsInternal();
  const coverageGaps = coverageGapsInternal();
  const documentType = documentTypeSummariesInternal(configuredInstances, presets, coverageGaps).find(
    (entry) => entry.alias === alias,
  );
  if (!documentType) return null;
  const relatedInstances = configuredInstances.filter((instance) => instance.documentTypeAliases.includes(alias));
  const relatedUiMappingIds = new Set(relatedInstances.map((instance) => instance.uiMappingId));
  return {
    documentType,
    configuredInstances: relatedInstances,
    presets: presets.filter((preset) => preset.documentTypeAliases.includes(alias)),
    coverageGaps: coverageGaps.filter((gap) => gap.documentTypeAliases.includes(alias)),
    uiMappings: PROPERTY_EDITOR_UI_MAPPINGS.filter((mapping) => relatedUiMappingIds.has(mapping.id)),
  };
}

export function getPropertyEditorFlowForKind(kind: EditorFieldKind): PropertyEditorKindFlow | null {
  const configuredInstances = configuredInstancesInternal();
  const presets = presetsInternal();
  const coverageGaps = coverageGapsInternal();
  const fieldKinds = kindUsageInternal(configuredInstances, presets);
  const kindSummary = fieldKinds.find((entry) => entry.kind === kind);
  if (!kindSummary) return null;
  const relatedInstances = configuredInstances.filter((instance) => instance.kind === kind);
  const relatedUiMappingIds = new Set(relatedInstances.map((instance) => instance.uiMappingId));
  const relatedDocumentTypeAliases = new Set(
    relatedInstances.flatMap((instance) => instance.documentTypeAliases),
  );
  return {
    kind: kindSummary,
    configuredInstances: relatedInstances,
    presets: presets.filter((preset) => preset.fieldKinds.includes(kind)),
    uiMappings: PROPERTY_EDITOR_UI_MAPPINGS.filter((mapping) => relatedUiMappingIds.has(mapping.id)),
    documentTypes: documentTypeSummariesInternal(configuredInstances, presets, coverageGaps).filter((documentType) =>
      relatedDocumentTypeAliases.has(documentType.alias),
    ),
  };
}

export function getPropertyEditorSystemModel(): PropertyEditorSystemModel {
  const configuredInstances = configuredInstancesInternal();
  const presets = presetsInternal();
  const gaps = coverageGapsInternal();
  return {
    documentTypes: documentTypeSummariesInternal(configuredInstances, presets, gaps),
    fieldKinds: kindUsageInternal(configuredInstances, presets),
    configuredInstances,
    presets,
    uiMappings: PROPERTY_EDITOR_UI_MAPPINGS,
    unsupportedCreateOptions: gaps,
  };
}

/** Statisk sannhet for tester: antall blokk-create options skal matche modal. */
export function countBlockCreateOptions(): number {
  return EDITOR_BLOCK_CREATE_OPTIONS.length;
}
