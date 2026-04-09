/**
 * Schema-driven block form layouts: fields, groups, defaults, validation keys.
 * Preserves persisted block shape (flat strings + optional editor hints like ctaPrimaryHrefKind).
 * U91: validering leser flat projeksjon for entry-blokker (content/settings/structure).
 */

import { expandRawBlockRowToFlatRenderFields } from "@/lib/cms/blocks/blockEntryContract";

export type EditorFieldKind =
  | "text"
  | "textarea"
  | "url"
  | "link"
  | "number"
  | "select"
  | "media";

/** Maps editor media fields to the same picker contract as ContentWorkspace. */
export type EditorMediaPickerRole = "heroBleedBackground" | "heroBleedOverlay";

export type EditorBlockFieldSchema = {
  key: string;
  label: string;
  kind: EditorFieldKind;
  required?: boolean;
  maxLength?: number;
  /** For kind "select": { value: label } */
  options?: Record<string, string>;
  placeholder?: string;
  /** For kind "media": which picker branch applies (hero bleed → archive id + resolved URL). */
  mediaRole?: EditorMediaPickerRole;
  /** For kind "link": internal vs external UX (still stores href string + optional linkKindKey). */
  linkVariant?: "dual";
  /** Block key for editor-only internal/external hint (ignored by public render). */
  linkKindKey?: string;
};

export type EditorBlockFieldGroup = {
  name: string;
  /** Umbraco-style bucket: redaksjonelt innhold vs presentasjon vs samlinger. */
  section?: "content" | "settings" | "structure";
  /** Field keys as stored on the block (e.g. backgroundImageId). */
  fields: string[];
};

export type EditorBlockTypeLayout = {
  fields: EditorBlockFieldSchema[];
  groups?: EditorBlockFieldGroup[];
  defaultValues?: Record<string, string | number | boolean>;
  /** Required non-empty keys in addition to per-field `required`. */
  requiredKeys?: string[];
};

/** Canonical copy for empty required fields (Norwegian, enterprise tone). */
export const REQUIRED_FIELD_MESSAGE = "Dette feltet er påkrevd";

/** URL, path, or CMS media key — matches inline inspector placeholders. */
export function looksLikeLinkOrUrl(s: string): boolean {
  const t = s.trim();
  if (!t) return true;
  if (t.startsWith("http://") || t.startsWith("https://")) return true;
  if (t.startsWith("/")) return true;
  if (t.startsWith("cms:")) return true;
  if (t.startsWith("mailto:") || t.startsWith("tel:")) return true;
  return false;
}

export type BlockType = string;

const HERO_FIELDS: EditorBlockFieldSchema[] = [
  {
    key: "title",
    label: "Hovedbudskap (tittel)",
    kind: "text",
    required: true,
    maxLength: 120,
    placeholder: "Kort, tydelig lovnad til leseren",
  },
  {
    key: "subtitle",
    label: "Støttetekst",
    kind: "text",
    maxLength: 200,
    placeholder: "Presiser kontekst eller målgruppe (valgfritt)",
  },
  {
    key: "imageId",
    label: "Bilde (ID / URL)",
    kind: "url",
    placeholder: "cms:*, media-ID eller https://…",
  },
  {
    key: "imageAlt",
    label: "Alt-tekst for bilde",
    kind: "text",
    maxLength: 250,
    placeholder: "Kort beskrivelse for skjermlesere",
  },
  { key: "ctaLabel", label: "Primærknapp · tekst", kind: "text", maxLength: 60, placeholder: "F.eks. Se meny" },
  { key: "ctaHref", label: "Primærknapp · lenke", kind: "url", placeholder: "/sti eller https://…" },
];

const HERO_FULL_FIELDS: EditorBlockFieldSchema[] = [
  ...HERO_FIELDS,
  {
    key: "useGradient",
    label: "Gradient over bilde",
    kind: "select",
    options: { true: "På (bedre lesbarhet)", false: "Av" },
  },
];

const RICH_TEXT_FIELDS: EditorBlockFieldSchema[] = [
  { key: "heading", label: "Overskrift", kind: "text", maxLength: 120 },
  { key: "body", label: "Brødtekst", kind: "textarea", placeholder: "Innhold (kan være tomt hvis kun overskrift)." },
];

const IMAGE_FIELDS: EditorBlockFieldSchema[] = [
  { key: "imageId", label: "Bilde (ID / URL)", kind: "url", required: true, placeholder: "cms:*, media-ID eller https://…" },
  { key: "alt", label: "Alt-tekst", kind: "text", required: true, maxLength: 250 },
  { key: "caption", label: "Bildetekst", kind: "text", maxLength: 200 },
];

const CTA_FIELDS: EditorBlockFieldSchema[] = [
  {
    key: "eyebrow",
    label: "Etikett over tittel",
    kind: "text",
    maxLength: 80,
    placeholder: "Valgfri kontekstlinje (f.eks. Neste steg)",
  },
  { key: "title", label: "Overskrift", kind: "text", required: true, maxLength: 120 },
  {
    key: "body",
    label: "Støttende tekst",
    kind: "textarea",
    maxLength: 600,
    placeholder: "Forklar verdien før leseren klikker.",
  },
  { key: "buttonLabel", label: "Primærknapp · tekst", kind: "text", maxLength: 60, required: true },
  { key: "buttonHref", label: "Primærknapp · lenke", kind: "url", required: true, placeholder: "/registrering eller https://…" },
  { key: "secondaryButtonLabel", label: "Sekundærknapp · tekst", kind: "text", maxLength: 60 },
  { key: "secondaryButtonHref", label: "Sekundærknapp · lenke", kind: "url", placeholder: "/kontakt …" },
];

const DIVIDER_FIELDS: EditorBlockFieldSchema[] = [
  {
    key: "style",
    label: "Utseende",
    kind: "select",
    options: { line: "Linje", space: "Mellomrom" },
  },
];

const CARDS_SCALAR_FIELDS: EditorBlockFieldSchema[] = [
  {
    key: "title",
    label: "Seksjonstittel",
    kind: "text",
    required: true,
    maxLength: 120,
    placeholder: "H2 over kortene",
  },
  {
    key: "text",
    label: "Ingress under tittel",
    kind: "textarea",
    maxLength: 600,
    placeholder: "Kort kontekst før kortene",
  },
  {
    key: "presentation",
    label: "Kortuttrykk",
    kind: "select",
    options: { feature: "Ikonring (verdiforslag)", plain: "Rolige kort uten ikon" },
  },
];

const ZIGZAG_SCALAR_FIELDS: EditorBlockFieldSchema[] = [
  {
    key: "title",
    label: "Seksjonstittel",
    kind: "text",
    required: true,
    maxLength: 120,
  },
  {
    key: "intro",
    label: "Ingress",
    kind: "textarea",
    maxLength: 500,
    placeholder: "Valgfri linje under H2",
  },
  {
    key: "presentation",
    label: "Modus på nettstedet",
    kind: "select",
    options: { process: "Prosess (steg for steg)", faq: "Spørsmål og svar" },
  },
];

const PRICING_SCALAR_FIELDS: EditorBlockFieldSchema[] = [
  { key: "title", label: "Overskrift", kind: "text", required: true, maxLength: 120 },
  {
    key: "intro",
    label: "Ingress (over prisruten)",
    kind: "textarea",
    maxLength: 600,
    placeholder: "Tom planliste = live priser på publisert side",
  },
  { key: "footnote", label: "Fotnote under prisruten", kind: "textarea", maxLength: 400 },
];

const GRID_SCALAR_FIELDS: EditorBlockFieldSchema[] = [
  { key: "title", label: "Seksjonstittel", kind: "text", required: true, maxLength: 120 },
  {
    key: "intro",
    label: "Ingress",
    kind: "textarea",
    maxLength: 500,
  },
  {
    key: "variant",
    label: "Justering av seksjon",
    kind: "select",
    options: { left: "Venstre", center: "Midt", right: "Høyre" },
  },
];

const RELATED_SCALAR_FIELDS: EditorBlockFieldSchema[] = [
  { key: "title", label: "Overskrift (valgfri)", kind: "text", maxLength: 120 },
  { key: "subtitle", label: "Undertekst / ingress", kind: "textarea", maxLength: 400 },
  {
    key: "currentPath",
    label: "Skjul aktiv side (sti)",
    kind: "url",
    placeholder: "/ eller /underside",
  },
  {
    key: "maxSuggestions",
    label: "Maks antall lenker (1–12)",
    kind: "text",
    placeholder: "6",
  },
  {
    key: "emptyFallbackText",
    label: "Tekst ved ingen treff",
    kind: "textarea",
    maxLength: 300,
    placeholder: "Valgfri egen tomtilstand",
  },
];

const FORM_SCALAR_FIELDS: EditorBlockFieldSchema[] = [
  { key: "formId", label: "Skjema-ID", kind: "text", required: true, placeholder: "Ekstern skjemareferanse" },
  { key: "title", label: "Tittel over innebygging", kind: "text", maxLength: 120 },
];

const HERO_BLEED_FIELDS: EditorBlockFieldSchema[] = [
  { key: "title", label: "Tittel", kind: "text", required: true, maxLength: 120 },
  { key: "subtitle", label: "Undertittel", kind: "textarea", maxLength: 500 },
  {
    key: "backgroundImageId",
    label: "Bakgrunnsbilde",
    kind: "media",
    required: true,
    mediaRole: "heroBleedBackground",
  },
  {
    key: "overlayImageId",
    label: "Overleggsbilde",
    kind: "media",
    mediaRole: "heroBleedOverlay",
  },
  { key: "ctaPrimary", label: "Primærknapp (tekst)", kind: "text", maxLength: 80 },
  {
    key: "ctaPrimaryHref",
    label: "Primærknapp (lenke)",
    kind: "link",
    linkVariant: "dual",
    linkKindKey: "ctaPrimaryHrefKind",
    placeholder: "https://…",
  },
  {
    key: "variant",
    label: "Layout (variant)",
    kind: "select",
    options: { left: "Venstre", center: "Midt", right: "Høyre" },
  },
];

const BANNER_FIELDS: EditorBlockFieldSchema[] = [
  { key: "text", label: "Tekst", kind: "textarea", required: true, maxLength: 500 },
  {
    key: "backgroundImageId",
    label: "Bakgrunnsbilde",
    kind: "media",
    required: true,
    mediaRole: "heroBleedBackground",
  },
  { key: "ctaLabel", label: "Knappetekst", kind: "text", maxLength: 60 },
  {
    key: "ctaHref",
    label: "Knappelenke",
    kind: "link",
    linkVariant: "dual",
    linkKindKey: "ctaHrefKind",
    placeholder: "https://…",
  },
];

const BLOCK_FORM_LAYOUTS: Record<string, EditorBlockTypeLayout> = {
  hero: {
    fields: HERO_FIELDS,
    groups: [
      { name: "Innhold", section: "content", fields: ["title", "subtitle"] },
      { name: "Handling (CTA)", section: "settings", fields: ["ctaLabel", "ctaHref"] },
      { name: "Media og tilgjengelighet", section: "settings", fields: ["imageId", "imageAlt"] },
    ],
    requiredKeys: ["title"],
  },
  hero_full: {
    fields: HERO_FULL_FIELDS,
    groups: [
      { name: "Innhold", section: "content", fields: ["title", "subtitle"] },
      { name: "Handling (CTA)", section: "settings", fields: ["ctaLabel", "ctaHref"] },
      { name: "Presentasjon", section: "settings", fields: ["useGradient"] },
      { name: "Media og tilgjengelighet", section: "settings", fields: ["imageId", "imageAlt"] },
    ],
    defaultValues: { useGradient: "true" },
    requiredKeys: ["title"],
  },
  hero_bleed: {
    fields: HERO_BLEED_FIELDS,
    groups: [
      { name: "Innhold", section: "content", fields: ["title", "subtitle"] },
      { name: "CTA", section: "settings", fields: ["ctaPrimary", "ctaPrimaryHref"] },
      { name: "Design", section: "settings", fields: ["variant"] },
      { name: "Media", section: "settings", fields: ["backgroundImageId", "overlayImageId"] },
    ],
    defaultValues: {
      variant: "center",
    },
    requiredKeys: ["title", "backgroundImageId"],
  },
  banner: {
    fields: BANNER_FIELDS,
    groups: [
      { name: "Innhold", section: "content", fields: ["text"] },
      { name: "CTA", section: "settings", fields: ["ctaLabel", "ctaHref"] },
      { name: "Media", section: "settings", fields: ["backgroundImageId"] },
    ],
    defaultValues: { variant: "center" },
    requiredKeys: ["text", "backgroundImageId"],
  },
  richText: {
    fields: RICH_TEXT_FIELDS,
    groups: [{ name: "Innhold", section: "content", fields: ["heading", "body"] }],
  },
  image: {
    fields: IMAGE_FIELDS,
    groups: [
      { name: "Redaksjonell bildetekst", section: "content", fields: ["caption"] },
      { name: "Kilde og tilgjengelighet", section: "settings", fields: ["imageId", "alt"] },
    ],
  },
  cta: {
    fields: CTA_FIELDS,
    groups: [
      { name: "Innhold", section: "content", fields: ["eyebrow", "title", "body"] },
      { name: "Primær handling", section: "settings", fields: ["buttonLabel", "buttonHref"] },
      { name: "Sekundær handling (valgfri)", section: "settings", fields: ["secondaryButtonLabel", "secondaryButtonHref"] },
    ],
    requiredKeys: ["title", "buttonLabel", "buttonHref"],
  },
  divider: {
    fields: DIVIDER_FIELDS,
    groups: [{ name: "Presentasjon", section: "settings", fields: ["style"] }],
  },
  cards: {
    fields: CARDS_SCALAR_FIELDS,
    groups: [
      { name: "Innhold", section: "content", fields: ["title", "text"] },
      { name: "Presentasjon", section: "settings", fields: ["presentation"] },
      { name: "Kort i seksjonen", section: "structure", fields: [] },
    ],
    requiredKeys: ["title"],
  },
  zigzag: {
    fields: ZIGZAG_SCALAR_FIELDS,
    groups: [
      { name: "Innhold", section: "content", fields: ["title", "intro"] },
      { name: "Modus", section: "settings", fields: ["presentation"] },
      { name: "Steg i samlingen", section: "structure", fields: [] },
    ],
    requiredKeys: ["title"],
  },
  pricing: {
    fields: PRICING_SCALAR_FIELDS,
    groups: [
      { name: "Innhold", section: "content", fields: ["title", "intro"] },
      { name: "Fotnote", section: "settings", fields: ["footnote"] },
      { name: "Pakker", section: "structure", fields: [] },
    ],
    requiredKeys: ["title"],
  },
  grid: {
    fields: GRID_SCALAR_FIELDS,
    groups: [
      { name: "Innhold", section: "content", fields: ["title", "intro"] },
      { name: "Presentasjon", section: "settings", fields: ["variant"] },
      { name: "Celler", section: "structure", fields: [] },
    ],
    requiredKeys: ["title"],
  },
  relatedLinks: {
    fields: RELATED_SCALAR_FIELDS,
    groups: [
      { name: "Kuratering · overskrift", section: "content", fields: ["title", "subtitle"] },
      {
        name: "Utvalg, regler og tomtilstand",
        section: "settings",
        fields: ["currentPath", "maxSuggestions", "emptyFallbackText"],
      },
      { name: "Stikkord (liste)", section: "structure", fields: [] },
    ],
  },
  form: {
    fields: FORM_SCALAR_FIELDS,
    groups: [
      { name: "Innbygging", section: "content", fields: ["formId", "title"] },
    ],
    requiredKeys: ["formId"],
  },
};

export function getBlockFormLayout(blockType: string): EditorBlockTypeLayout | null {
  return BLOCK_FORM_LAYOUTS[blockType] ?? null;
}

/** Default field values for new blocks (merged before explicit empty fields where needed). */
export function getBlockDefaultValuesForType(blockType: string): Record<string, string | number | boolean> {
  const d = getBlockFormLayout(blockType)?.defaultValues;
  return d ? { ...d } : {};
}

export function getBlockFieldSchema(blockType: string): EditorBlockFieldSchema[] {
  return getBlockFormLayout(blockType)?.fields ?? [];
}

export function hasSchemaForBlockType(blockType: string): boolean {
  return getBlockFieldSchema(blockType).length > 0;
}

export function isFieldRequiredForBlockType(
  blockType: string,
  fieldKey: string,
  field?: EditorBlockFieldSchema
): boolean {
  if (field?.required) return true;
  const rk = getBlockFormLayout(blockType)?.requiredKeys;
  return Boolean(rk?.includes(fieldKey));
}

/** Single-field validation for modal + inline forms (deterministic). */
/** Kryssvalidering (CTA-par, hero CTA-par, sekundær CTA-par). */
export function validateBlockEditorCrossFields(
  blockType: string,
  block: Record<string, unknown>
): Record<string, string> {
  const err: Record<string, string> = {};
  const flat = expandRawBlockRowToFlatRenderFields({ ...block, type: blockType });
  if (blockType === "hero" || blockType === "hero_full") {
    const lab = String(flat.ctaLabel ?? "").trim();
    const href = String(flat.ctaHref ?? "").trim();
    if (lab && !href) err.ctaHref = "Lenke kreves når knappetekst er satt.";
    if (href && !lab) err.ctaLabel = "Knappetekst kreves når lenke er satt.";
  }
  if (blockType === "cta") {
    const sl = String(flat.secondaryButtonLabel ?? "").trim();
    const sh = String(flat.secondaryButtonHref ?? "").trim();
    if (sl && !sh) err.secondaryButtonHref = "Lenke kreves når sekundærknapp har tekst.";
    if (sh && !sl) err.secondaryButtonLabel = "Tekst kreves når sekundærknapp har lenke.";
  }
  return err;
}

export function validateEditorField(
  blockType: string,
  field: EditorBlockFieldSchema,
  block: Record<string, unknown>
): string | null {
  const flat = expandRawBlockRowToFlatRenderFields({ ...block, type: blockType });
  const value = String(flat[field.key] ?? "").trim();
  const required = isFieldRequiredForBlockType(blockType, field.key, field);
  if (required && !value) return REQUIRED_FIELD_MESSAGE;
  if (field.maxLength != null && value.length > field.maxLength) {
    return `Maks ${field.maxLength} tegn (${value.length}).`;
  }
  if ((field.kind === "url" || field.kind === "link") && value && !looksLikeLinkOrUrl(value)) {
    return "Skriv en gyldig lenke (https://…, /sti eller cms:…).";
  }
  if (field.kind === "select" && field.options && !(value in field.options)) {
    const first = Object.keys(field.options)[0];
    if (first !== undefined && !value) return null;
    if (value) return "Velg en gyldig verdi.";
  }
  return null;
}
