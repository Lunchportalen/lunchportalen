/**
 * U97 — Kanonisk Composition-kilde (Umbraco-lignende gjenbruk av grupper + properties).
 * Injiseres i effektive Document Types via expandDocumentTypeWithCompositions.
 */

import type { DocumentTypeGroupDefinition, PropertyTypeDefinition } from "@/lib/cms/schema/documentTypeDefinitions";

export type CompositionDefinition = {
  alias: string;
  title: string;
  description: string;
  /** Hvilke dokumenttyper som kan referere composition i schema. */
  allowedDocumentTypeAliases: readonly string[];
  groups: DocumentTypeGroupDefinition[];
  properties: PropertyTypeDefinition[];
};

const BASELINE: readonly CompositionDefinition[] = [
  {
    alias: "seo_metadata",
    title: "SEO / metadata",
    description: "Delt søk og synlighet — felter lagres per språkvariant (cultureFields / seo_title, seo_description).",
    allowedDocumentTypeAliases: ["page", "compact_page", "micro_landing"],
    groups: [{ id: "seo", title: "SEO", description: "Søk og deling" }],
    properties: [
      {
        alias: "seo_title",
        title: "SEO-tittel",
        description: "Tittel for søk og deling (fallback til sidetittel).",
        groupId: "seo",
        dataTypeAlias: "cms_text_line",
        variation: "culture",
        validation: { required: false },
        editorHints: { kind: "scalar_text", propertyEditor: "TextLinePropertyEditor" },
      },
      {
        alias: "seo_description",
        title: "SEO-beskrivelse",
        description: "Kort beskrivelse i søkeresultater og deling.",
        groupId: "seo",
        dataTypeAlias: "cms_text_area",
        variation: "culture",
        validation: { required: false },
        editorHints: { kind: "scalar_text", propertyEditor: "TextAreaPropertyEditor" },
      },
    ],
  },
  {
    alias: "page_intro",
    title: "Sideintro",
    description: "Kort ingress over blokker — gjenbrukes på marketing- og kompaktsider.",
    allowedDocumentTypeAliases: ["page", "compact_page"],
    groups: [{ id: "intro", title: "Intro", description: "Ingress og kontekst" }],
    properties: [
      {
        alias: "intro_kicker",
        title: "Ingress / kicker",
        description: "Valgfri kort linje over hovedinnhold.",
        groupId: "intro",
        dataTypeAlias: "cms_text_line",
        variation: "culture",
        validation: { required: false },
        editorHints: { kind: "scalar_text", propertyEditor: "TextLinePropertyEditor" },
      },
    ],
  },
];

const BY_ALIAS = new Map(BASELINE.map((c) => [c.alias, c]));

export function listBaselineCompositionDefinitions(): readonly CompositionDefinition[] {
  return BASELINE;
}

export function listCompositionAliases(): string[] {
  return BASELINE.map((c) => c.alias);
}

export function getBaselineCompositionDefinition(alias: string): CompositionDefinition | undefined {
  const k = String(alias ?? "").trim();
  return k ? structuredClone(BY_ALIAS.get(k)) : undefined;
}

export function cloneCompositionDefinition(c: CompositionDefinition): CompositionDefinition {
  return {
    ...c,
    allowedDocumentTypeAliases: [...c.allowedDocumentTypeAliases],
    groups: c.groups.map((g) => ({ ...g })),
    properties: c.properties.map((p) => ({
      ...p,
      variation: p.variation,
      validation: p.validation ? { ...p.validation } : undefined,
      editorHints: p.editorHints ? { ...p.editorHints } : undefined,
    })),
  };
}
