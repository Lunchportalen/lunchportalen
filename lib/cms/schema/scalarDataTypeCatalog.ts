/**
 * U97 — CMS scalar property data types (non–block-editor), for composition / shared fields i envelope.fields.
 */

export const CMS_SCALAR_DATA_TYPE_ALIASES = ["cms_text_line", "cms_text_area"] as const;

export type CmsScalarDataTypeAlias = (typeof CMS_SCALAR_DATA_TYPE_ALIASES)[number];

const SET = new Set<string>(CMS_SCALAR_DATA_TYPE_ALIASES);

export function isCmsScalarDataTypeAlias(alias: string): boolean {
  return SET.has(String(alias ?? "").trim());
}

export function listCmsScalarDataTypeAliases(): readonly string[] {
  return CMS_SCALAR_DATA_TYPE_ALIASES;
}
