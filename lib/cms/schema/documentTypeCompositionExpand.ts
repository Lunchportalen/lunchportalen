/**
 * U97 — Slår compositions inn i effektiv Document Type (grupper + properties).
 */

import type { CompositionDefinition } from "@/lib/cms/schema/compositionDefinitions";
import type { DocumentTypeDefinition } from "@/lib/cms/schema/documentTypeDefinitions";
import { cloneDocumentTypeDefinition } from "@/lib/cms/schema/documentTypeDefinitions";

export function expandDocumentTypeWithCompositions(
  doc: DocumentTypeDefinition,
  compositionsByAlias: Record<string, CompositionDefinition>,
): DocumentTypeDefinition {
  const out = cloneDocumentTypeDefinition(doc);
  const seenGroups = new Set(out.groups.map((g) => g.id));
  const seenPropAliases = new Set(out.properties.map((p) => p.alias));

  for (const cAlias of out.compositionAliases) {
    const comp = compositionsByAlias[cAlias];
    if (!comp) continue;
    if (!comp.allowedDocumentTypeAliases.includes(out.alias)) continue;

    for (const g of comp.groups) {
      if (!seenGroups.has(g.id)) {
        out.groups.push({ ...g });
        seenGroups.add(g.id);
      }
    }
    for (const p of comp.properties) {
      if (!seenPropAliases.has(p.alias)) {
        out.properties.push({
          ...p,
          validation: p.validation ? { ...p.validation } : undefined,
          editorHints: p.editorHints ? { ...p.editorHints } : undefined,
        });
        seenPropAliases.add(p.alias);
      }
    }
  }
  return out;
}
