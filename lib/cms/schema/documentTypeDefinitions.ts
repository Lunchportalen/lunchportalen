/**
 * U96 — Kanonisk Document Type / Property Type schema (Umbraco-lignende).
 * U97 — Struktur: allowAtRoot, allowedChildTypes, compositions, templates / rendering-binding.
 * Runtime merge (admin overrides) skjer i documentTypeDefinitionMerge + API.
 */

import type { SemanticIconKey } from "@/lib/iconRegistry";

export type DocumentTypeGroupDefinition = {
  id: string;
  title: string;
  description?: string;
};

export type PropertyTypeValidationHint = {
  required?: boolean;
  min?: number;
  max?: number;
};

/** U98 — Umbraco-lignende variation: delt på tvers av språk vs per kultur. */
export type PropertyVariation = "invariant" | "culture";

export type PropertyTypeDefinition = {
  alias: string;
  title: string;
  description?: string;
  groupId: string;
  /** Block Editor Data Type alias eller CMS scalar (cms_text_line / cms_text_area). */
  dataTypeAlias: string;
  /** U98 — default culture (per variant-rad / språk). */
  variation?: PropertyVariation;
  validation?: PropertyTypeValidationHint;
  defaultHint?: string;
  editorHints?: Record<string, unknown>;
};

export type DocumentTypeDefinition = {
  alias: string;
  title: string;
  description: string;
  icon: SemanticIconKey;
  /**
   * U97 — Tillatte barn-Document Types under denne noden (content tree / create-flow).
   */
  allowedChildTypes: string[];
  /** U97 — Når true: dokumenttypen kan velges ved root-opprettelse (ingen forelder). */
  allowAtRoot: boolean;
  /**
   * U97 — Composition-alias injisert i effektiv type (grupper + delte properties).
   */
  compositionAliases: string[];
  /** U97 — Tillatte rendering-maler / profiler (alias fra documentTemplateDefinitions). */
  templates: string[];
  /** U97 — Standard mal ved nye sider av denne typen (må finnes i `templates`). */
  defaultTemplate: string | null;
  /** U97 — Valgfritt: innholdstype fungerer som liste/container i tre-policy. */
  isCollection?: boolean;
  groups: DocumentTypeGroupDefinition[];
  properties: PropertyTypeDefinition[];
  workspaceHint?: string;
  createPolicyNote?: string;
};

const BASELINE: DocumentTypeDefinition[] = [
  {
    alias: "page",
    title: "Page",
    description: "Kanonisk dokumenttype for redaksjonelle sider i content-seksjonen.",
    icon: "content",
    allowedChildTypes: ["compact_page", "micro_landing"],
    allowAtRoot: true,
    compositionAliases: ["seo_metadata", "page_intro"],
    templates: ["marketing_page_default", "marketing_page_minimal"],
    defaultTemplate: "marketing_page_default",
    isCollection: false,
    workspaceHint:
      "Brukes av den ordinære sideeditoren og styrer body-envelope, blokkallowlist og tree-opprettelse.",
    createPolicyNote: "Kan opprettes i rot; undernoder begrenses til kompakt/micro-landing.",
    groups: [
      { id: "structure", title: "Struktur", description: "Felter som er felles for alle språkvarianter." },
      { id: "content", title: "Innhold", description: "Hovedinnhold og blokker på siden." },
      { id: "meta", title: "Meta", description: "Metadata og strukturhint (utvidbart)." },
    ],
    properties: [
      {
        alias: "structure_key",
        title: "Struktur-nøkkel (invariant)",
        description: "Internt strukturflagg — samme verdi på alle språk for denne noden.",
        groupId: "structure",
        dataTypeAlias: "cms_text_line",
        variation: "invariant",
        validation: { required: false },
        editorHints: { kind: "scalar_text", propertyEditor: "TextLinePropertyEditor" },
      },
      {
        alias: "body",
        title: "Blokker på siden",
        description: "Sidens hovedinnhold som blokker (block list editor).",
        groupId: "content",
        dataTypeAlias: "page_marketing_blocks",
        variation: "culture",
        validation: { required: false },
        editorHints: { kind: "block_list", propertyEditor: "BlockListPropertyEditor" },
      },
    ],
  },
  {
    alias: "compact_page",
    title: "Kompakt side",
    description: "Redusert blokkspektrum for enkle landingsstriper (samme editor, annen data type).",
    icon: "template",
    allowedChildTypes: ["micro_landing"],
    allowAtRoot: true,
    compositionAliases: ["seo_metadata"],
    templates: ["compact_landing_default"],
    defaultTemplate: "compact_landing_default",
    workspaceHint: "Brukes av seed-sider — library og allowlist følger data type `compact_page_blocks`.",
    createPolicyNote: "Kan stå i rot; under micro-landing tillatt.",
    groups: [
      { id: "structure", title: "Struktur", description: "Felter som er felles for alle språkvarianter." },
      { id: "content", title: "Innhold", description: "Kompakt blokkspektrum." },
    ],
    properties: [
      {
        alias: "structure_key",
        title: "Struktur-nøkkel (invariant)",
        description: "Internt strukturflagg — samme verdi på alle språk for denne noden.",
        groupId: "structure",
        dataTypeAlias: "cms_text_line",
        variation: "invariant",
        validation: { required: false },
        editorHints: { kind: "scalar_text", propertyEditor: "TextLinePropertyEditor" },
      },
      {
        alias: "body",
        title: "Kompakte blokker",
        description: "Smalt blokkspektrum for enkle landingsstriper.",
        groupId: "content",
        dataTypeAlias: "compact_page_blocks",
        variation: "culture",
        validation: { required: false },
        editorHints: { kind: "block_list", propertyEditor: "BlockListPropertyEditor" },
      },
    ],
  },
  {
    alias: "micro_landing",
    title: "Micro landing",
    description: "Minimal allowlist og hard tak på antall blokker.",
    icon: "ai",
    allowedChildTypes: [],
    allowAtRoot: false,
    compositionAliases: ["seo_metadata"],
    templates: ["micro_landing_default"],
    defaultTemplate: "micro_landing_default",
    workspaceHint: "Seed for grenseverifikasjon av data type `page_micro_blocks`.",
    createPolicyNote: "Kun under tillatte foreldre — ikke root.",
    groups: [
      { id: "structure", title: "Struktur", description: "Felter som er felles for alle språkvarianter." },
      { id: "content", title: "Micro-innhold", description: "Maksimalt antall blokker begrenset av data type." },
    ],
    properties: [
      {
        alias: "structure_key",
        title: "Struktur-nøkkel (invariant)",
        description: "Internt strukturflagg — samme verdi på alle språk for denne noden.",
        groupId: "structure",
        dataTypeAlias: "cms_text_line",
        variation: "invariant",
        validation: { required: false },
        editorHints: { kind: "scalar_text", propertyEditor: "TextLinePropertyEditor" },
      },
      {
        alias: "body",
        title: "Micro-blokker",
        description: "Opp til tre blokker — allowlist fra data type.",
        groupId: "content",
        dataTypeAlias: "page_micro_blocks",
        variation: "culture",
        validation: { required: true, min: 1, max: 3 },
        editorHints: { kind: "block_list", propertyEditor: "BlockListPropertyEditor", enforceHardCap: true },
      },
    ],
  },
];

const BY_ALIAS = new Map(BASELINE.map((d) => [d.alias, d]));

export function listBaselineDocumentTypeDefinitions(): readonly DocumentTypeDefinition[] {
  return BASELINE;
}

export function listDocumentTypeAliases(): string[] {
  return BASELINE.map((d) => d.alias);
}

export function getBaselineDocumentTypeDefinition(alias: string): DocumentTypeDefinition | undefined {
  const k = String(alias ?? "").trim();
  if (!k) return undefined;
  const d = BY_ALIAS.get(k);
  return d ? cloneDocumentTypeDefinition(d) : undefined;
}

export function getBodyPropertyDefinition(doc: DocumentTypeDefinition | undefined): PropertyTypeDefinition | undefined {
  if (!doc) return undefined;
  return doc.properties.find((p) => p.alias === "body");
}

export function cloneDocumentTypeDefinition(d: DocumentTypeDefinition): DocumentTypeDefinition {
  return {
    ...d,
    allowedChildTypes: [...d.allowedChildTypes],
    compositionAliases: [...d.compositionAliases],
    templates: [...d.templates],
    groups: d.groups.map((g) => ({ ...g })),
    properties: d.properties.map((p) => ({
      ...p,
      variation: p.variation,
      validation: p.validation ? { ...p.validation } : undefined,
      editorHints: p.editorHints ? { ...p.editorHints } : undefined,
    })),
  };
}
