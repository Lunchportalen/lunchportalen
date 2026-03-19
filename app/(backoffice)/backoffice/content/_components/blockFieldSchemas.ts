/**
 * Schema-driven field definitions for block types.
 * Single source for modal/form rendering; preserves existing block contracts (flat shape).
 * Used by SchemaDrivenBlockForm and BlockEditModal. No DB shape change.
 */

export type EditorFieldKind = "text" | "textarea" | "url" | "number" | "select";

export type EditorBlockFieldSchema = {
  key: string;
  label: string;
  kind: EditorFieldKind;
  required?: boolean;
  maxLength?: number;
  /** For kind "select": { value: label } */
  options?: Record<string, string>;
  placeholder?: string;
};

export type BlockType = string;

const HERO_FIELDS: EditorBlockFieldSchema[] = [
  { key: "title", label: "Tittel", kind: "text", required: true, maxLength: 120 },
  { key: "subtitle", label: "Undertittel", kind: "text", maxLength: 200 },
  { key: "imageUrl", label: "Bilde-URL", kind: "url", placeholder: "https://... eller /path/bilde.jpg" },
  { key: "imageAlt", label: "Alt-tekst (bildet)", kind: "text", maxLength: 250, placeholder: "Beskriv bildet for tilgjengelighet" },
  { key: "ctaLabel", label: "Knappetekst", kind: "text", maxLength: 60 },
  { key: "ctaHref", label: "Knappelenke", kind: "url", placeholder: "https://..." },
];

const RICH_TEXT_FIELDS: EditorBlockFieldSchema[] = [
  { key: "heading", label: "Overskrift", kind: "text", maxLength: 120 },
  { key: "body", label: "Brødtekst", kind: "textarea", placeholder: "Innhold (kan være tomt hvis kun overskrift)." },
];

const IMAGE_FIELDS: EditorBlockFieldSchema[] = [
  { key: "assetPath", label: "Bildebane eller URL", kind: "url", required: true, placeholder: "/images/... eller https://..." },
  { key: "alt", label: "Alt-tekst", kind: "text", required: true, maxLength: 250 },
  { key: "caption", label: "Bildetekst", kind: "text", maxLength: 200 },
];

const CTA_FIELDS: EditorBlockFieldSchema[] = [
  { key: "title", label: "Tittel", kind: "text", maxLength: 120 },
  { key: "body", label: "Brødtekst", kind: "textarea", maxLength: 500 },
  { key: "buttonLabel", label: "Knappetekst", kind: "text", maxLength: 60 },
  { key: "buttonHref", label: "Knappelenke", kind: "url", placeholder: "https://..." },
];

const DIVIDER_FIELDS: EditorBlockFieldSchema[] = [
  {
    key: "style",
    label: "Utseende",
    kind: "select",
    options: { line: "Linje", space: "Mellomrom" },
  },
];

const CODE_FIELDS: EditorBlockFieldSchema[] = [
  { key: "code", label: "Kode", kind: "textarea", required: true, placeholder: "HTML eller annen kode" },
];

const SCHEMAS: Record<string, EditorBlockFieldSchema[]> = {
  hero: HERO_FIELDS,
  richText: RICH_TEXT_FIELDS,
  image: IMAGE_FIELDS,
  cta: CTA_FIELDS,
  divider: DIVIDER_FIELDS,
  code: CODE_FIELDS,
};

/** Returns schema for a block type, or empty array if none (e.g. banners). */
export function getBlockFieldSchema(blockType: string): EditorBlockFieldSchema[] {
  return SCHEMAS[blockType] ?? [];
}

/** True if this type has a schema-driven form (so modal can show form instead of raw JSON). */
export function hasSchemaForBlockType(blockType: string): boolean {
  return getBlockFieldSchema(blockType).length > 0;
}
