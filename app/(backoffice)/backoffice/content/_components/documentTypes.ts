/**
 * Document type registry for content editor (e.g. page, allowedChildren).
 * Used by create panel and envelope handling.
 */

export type DocumentTypeEntry = { alias: string; name: string; allowedChildren?: string[] };

export const documentTypes: DocumentTypeEntry[] = [
  { alias: "page", name: "Page", allowedChildren: ["page"] },
];

export function getDocType(alias: string): DocumentTypeEntry | null {
  return documentTypes.find((d) => d.alias === alias) ?? null;
}
