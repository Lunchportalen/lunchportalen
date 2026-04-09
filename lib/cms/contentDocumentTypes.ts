/**
 * Document type registry for content editor (page kinds, allowedChildTypes, envelope).
 * Baseline kommer fra kanonisk schema (`documentTypeDefinitions`); `DocumentTypeEntry` er tynn adapter for legacy-kall.
 * U97 — Bruk merged definitions fra context der struktur må speile settings.
 */

import {
  getBaselineDocumentTypeDefinition,
  getBodyPropertyDefinition,
  listBaselineDocumentTypeDefinitions,
  type DocumentTypeDefinition,
} from "@/lib/cms/schema/documentTypeDefinitions";

export type DocumentTypeEntry = {
  alias: string;
  name: string;
  description?: string;
  workspaceHint?: string;
  createPolicyNote?: string;
  allowAtRoot?: boolean;
  allowedChildTypes?: string[];
  /**
   * @deprecated U97 compatibility alias.
   * Read-only mirror of `allowedChildTypes` for legacy call-sites.
   * Do not write business logic against this key.
   */
  readonly allowedChildren?: string[];
  compositionAliases?: string[];
  templates?: string[];
  defaultTemplate?: string | null;
  isCollection?: boolean;
  /**
   * U94 — Block Editor Data Type (Umbraco-style) som styrer allowlist, grupper, grenser og create-label.
   * Avledet fra property `body` sin `dataTypeAlias` i kanonisk document type schema.
   */
  blockEditorDataTypeAlias?: string;
  /**
   * Tillatte blokktyper i page body for denne dokumenttypen.
   * Brukes kun når `blockEditorDataTypeAlias` ikke er satt (legacy).
   * - `undefined`: alle editor-typer.
   * - `[]`: ingen blokker tillatt.
   */
  allowedBlockTypes?: string[];
};

function toEntry(def: DocumentTypeDefinition): DocumentTypeEntry {
  const body = getBodyPropertyDefinition(def);
  const entry: DocumentTypeEntry = {
    alias: def.alias,
    name: def.title,
    description: def.description,
    workspaceHint: def.workspaceHint,
    createPolicyNote: def.createPolicyNote,
    allowAtRoot: def.allowAtRoot,
    allowedChildTypes: [...def.allowedChildTypes],
    compositionAliases: [...def.compositionAliases],
    templates: [...def.templates],
    defaultTemplate: def.defaultTemplate,
    isCollection: def.isCollection,
    blockEditorDataTypeAlias: body?.dataTypeAlias,
  };
  Object.defineProperty(entry, "allowedChildren", {
    enumerable: true,
    configurable: false,
    get: () => entry.allowedChildTypes,
  });
  return entry;
}

export const documentTypes: DocumentTypeEntry[] = listBaselineDocumentTypeDefinitions().map(toEntry);

/**
 * @param merged — når satt (f.eks. fra DocumentTypeDefinitionsMergedContext), følger struktur settings/runtime.
 */
export function getDocType(alias: string, merged?: Record<string, DocumentTypeDefinition> | null): DocumentTypeEntry | null {
  const d = merged?.[alias] ?? getBaselineDocumentTypeDefinition(alias);
  return d ? toEntry(d) : null;
}
