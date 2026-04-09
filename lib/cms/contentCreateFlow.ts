import { serializeBodyEnvelope } from "@/lib/cms/bodyEnvelopeContract";
import type { DocumentTypeDefinition } from "@/lib/cms/schema/documentTypeDefinitions";

export type CreateDialogOption = {
  alias: string;
  title: string;
  description: string;
  icon: string;
  templateBindingAlias: string | null;
};

export function resolveAllowedChildAliasesForParent(
  parentDocumentTypeAlias: string | null,
  merged: Record<string, DocumentTypeDefinition>,
): string[] {
  if (!parentDocumentTypeAlias) return [];
  const parent = merged[parentDocumentTypeAlias];
  if (!parent) return [];
  return [...parent.allowedChildTypes];
}

export function resolveRootCreateAliases(
  merged: Record<string, DocumentTypeDefinition>,
): string[] {
  return Object.values(merged)
    .filter((doc) => doc.allowAtRoot)
    .map((doc) => doc.alias);
}

export function resolveCreateDialogOptions(
  allowedAliases: string[],
  merged: Record<string, DocumentTypeDefinition>,
): CreateDialogOption[] {
  return allowedAliases
    .map((alias) => merged[alias])
    .filter((doc): doc is DocumentTypeDefinition => Boolean(doc))
    .map((doc) => ({
      alias: doc.alias,
      title: doc.title,
      description: doc.description,
      icon: doc.icon,
      templateBindingAlias: doc.defaultTemplate ?? doc.templates[0] ?? null,
    }));
}

export function buildCreatePayloadForDocumentType(documentTypeAlias: string): Record<string, unknown> {
  return {
    body: serializeBodyEnvelope({
      documentType: documentTypeAlias,
      fields: {},
      blocksBody: { version: 1, blocks: [] },
    }),
  };
}
