/**
 * Block schema generator capability: generateBlockSchema.
 * Returns canonical schema (type, label, description, fields) for one or all block types
 * compatible with BlockNode (id, type, data). Deterministic; no LLM.
 * Import this module to register the capability.
 */

import type { Capability } from "../capabilityRegistry";
import { registerCapability } from "../capabilityRegistry";

const CAPABILITY_NAME = "generateBlockSchema";

/** Block types that have a defined data schema (align with renderBlock and generateBlock). */
export const BLOCK_SCHEMA_TYPES = [
  "hero",
  "richText",
  "cta",
  "image",
  "divider",
  "form",
] as const;

export type BlockSchemaType = (typeof BLOCK_SCHEMA_TYPES)[number];

function isBlockSchemaType(s: string): s is BlockSchemaType {
  return (BLOCK_SCHEMA_TYPES as readonly string[]).includes(s);
}

const generateBlockSchemaCapability: Capability = {
  name: CAPABILITY_NAME,
  description:
    "Generates canonical block schema(s): type, label, description, and fields (name, dataType, required, description) for BlockNode data. Supports hero, richText, cta, image, divider, form. Deterministic; no LLM.",
  requiredContext: [],
  inputSchema: {
    type: "object",
    description: "Generate block schema input",
    properties: {
      blockType: {
        type: "string",
        description: "Optional: single block type (hero, richText, cta, image, divider, form). Omit for all.",
      },
      locale: { type: "string", description: "Locale for labels/descriptions (nb | en)" },
    },
    required: [],
  },
  outputSchema: {
    type: "object",
    description: "Block schema(s) result",
    required: ["schemas", "summary"],
    properties: {
      schemas: {
        type: "array",
        description: "One or more block schemas",
        items: {
          type: "object",
          required: ["type", "label", "description", "fields"],
          properties: {
            type: { type: "string" },
            label: { type: "string" },
            description: { type: "string" },
            fields: {
              type: "array",
              items: {
                type: "object",
                required: ["name", "dataType", "required"],
                properties: {
                  name: { type: "string" },
                  dataType: { type: "string" },
                  required: { type: "boolean" },
                  description: { type: "string" },
                  label: { type: "string" },
                },
              },
            },
          },
        },
      },
      summary: { type: "string", description: "Short summary" },
    },
  },
  safetyConstraints: [
    { code: "read_only", description: "Output is schema definition only; no content or system mutation.", enforce: "hard" },
  ],
  targetSurfaces: ["backoffice", "editor", "api"],
};

registerCapability(generateBlockSchemaCapability);

export type BlockSchemaField = {
  name: string;
  dataType: string;
  required: boolean;
  description?: string;
  label?: string;
};

export type BlockSchemaItem = {
  type: string;
  label: string;
  description: string;
  fields: BlockSchemaField[];
};

export type GenerateBlockSchemaInput = {
  blockType?: string | null;
  locale?: "nb" | "en" | null;
};

export type GenerateBlockSchemaOutput = {
  schemas: BlockSchemaItem[];
  summary: string;
};

type FieldDef = {
  name: string;
  dataType: "string" | "number" | "boolean";
  required: boolean;
  descriptionNb: string;
  descriptionEn: string;
  labelNb: string;
  labelEn: string;
};

function buildBlockDef(
  type: BlockSchemaType,
  labelNb: string,
  labelEn: string,
  descNb: string,
  descEn: string,
  fields: FieldDef[]
): (locale: "nb" | "en") => BlockSchemaItem {
  return (locale) => {
    const isEn = locale === "en";
    return {
      type,
      label: isEn ? labelEn : labelNb,
      description: isEn ? descEn : descNb,
      fields: fields.map((f) => ({
        name: f.name,
        dataType: f.dataType,
        required: f.required,
        description: isEn ? f.descriptionEn : f.descriptionNb,
        label: isEn ? f.labelEn : f.labelNb,
      })),
    };
  };
}

const BLOCK_DEFS: Record<BlockSchemaType, (locale: "nb" | "en") => BlockSchemaItem> = {
  hero: buildBlockDef(
    "hero",
    "Hero",
    "Hero",
    "Stor toppseksjon med overskrift, tekst, bilde og CTA.",
    "Top section with headline, text, image and CTA.",
    [
      { name: "title", dataType: "string", required: true, descriptionNb: "Hovedoverskrift", descriptionEn: "Headline", labelNb: "Tittel", labelEn: "Title" },
      { name: "subtitle", dataType: "string", required: false, descriptionNb: "Undertekst", descriptionEn: "Subtitle", labelNb: "Undertekst", labelEn: "Subtitle" },
      { name: "imageUrl", dataType: "string", required: false, descriptionNb: "Bilde-URL", descriptionEn: "Image URL", labelNb: "Bilde-URL", labelEn: "Image URL" },
      { name: "imageAlt", dataType: "string", required: false, descriptionNb: "Alt-tekst for bilde", descriptionEn: "Image alt text", labelNb: "Alt", labelEn: "Alt" },
      { name: "ctaLabel", dataType: "string", required: false, descriptionNb: "Knappetekst", descriptionEn: "Button label", labelNb: "Knapp", labelEn: "Button" },
      { name: "ctaHref", dataType: "string", required: false, descriptionNb: "Lenke for knapp", descriptionEn: "Button link", labelNb: "Lenke", labelEn: "Link" },
    ]
  ),
  richText: buildBlockDef(
    "richText",
    "Tekstseksjon",
    "Text section",
    "Vanlig brødtekst med overskrift.",
    "Body text with heading.",
    [
      { name: "heading", dataType: "string", required: false, descriptionNb: "Seksjonsoverskrift", descriptionEn: "Section heading", labelNb: "Overskrift", labelEn: "Heading" },
      { name: "body", dataType: "string", required: true, descriptionNb: "Brødtekst", descriptionEn: "Body text", labelNb: "Brødtekst", labelEn: "Body" },
    ]
  ),
  cta: buildBlockDef(
    "cta",
    "CTA / Knappe-seksjon",
    "CTA / Button section",
    "Kort seksjon med tittel, tekst og knapp.",
    "Short section with title, text and button.",
    [
      { name: "title", dataType: "string", required: false, descriptionNb: "Tittel", descriptionEn: "Title", labelNb: "Tittel", labelEn: "Title" },
      { name: "body", dataType: "string", required: false, descriptionNb: "Brødtekst", descriptionEn: "Body text", labelNb: "Brødtekst", labelEn: "Body" },
      { name: "buttonLabel", dataType: "string", required: false, descriptionNb: "Knappetekst", descriptionEn: "Button label", labelNb: "Knapp", labelEn: "Button" },
      { name: "buttonHref", dataType: "string", required: false, descriptionNb: "Lenke (brukes også som href)", descriptionEn: "Link (also used as href)", labelNb: "Lenke", labelEn: "Link" },
    ]
  ),
  image: buildBlockDef(
    "image",
    "Bilde",
    "Image",
    "Enkelt bilde fra mediearkivet.",
    "Single image from media library.",
    [
      { name: "src", dataType: "string", required: false, descriptionNb: "Bilde-URL eller sti", descriptionEn: "Image URL or path", labelNb: "Kilde", labelEn: "Source" },
      { name: "alt", dataType: "string", required: false, descriptionNb: "Alt-tekst", descriptionEn: "Alt text", labelNb: "Alt", labelEn: "Alt" },
      { name: "caption", dataType: "string", required: false, descriptionNb: "Bildetekst", descriptionEn: "Caption", labelNb: "Bildetekst", labelEn: "Caption" },
    ]
  ),
  divider: buildBlockDef(
    "divider",
    "Skillelinje",
    "Divider",
    "Visuell inndeling mellom seksjoner.",
    "Visual separator between sections.",
    []
  ),
  form: buildBlockDef(
    "form",
    "Skjema",
    "Form",
    "Innbyggingsblokk for skjema (formId fra backoffice).",
    "Embed block for form (formId from backoffice).",
    [
      { name: "formId", dataType: "string", required: true, descriptionNb: "ID til skjemaet", descriptionEn: "Form ID", labelNb: "Skjema-ID", labelEn: "Form ID" },
      { name: "title", dataType: "string", required: false, descriptionNb: "Valgfri tittel over skjema", descriptionEn: "Optional title above form", labelNb: "Tittel", labelEn: "Title" },
    ]
  ),
};

/**
 * Generates block schema(s) for the given type or all types. Deterministic; no external calls.
 */
export function generateBlockSchema(input: GenerateBlockSchemaInput = {}): GenerateBlockSchemaOutput {
  const locale = input.locale === "en" ? "en" : "nb";
  const requestedType = (input.blockType ?? "").trim();

  const typesToEmit: BlockSchemaType[] = requestedType
    ? isBlockSchemaType(requestedType)
      ? [requestedType]
      : []
    : [...BLOCK_SCHEMA_TYPES];

  const schemas: BlockSchemaItem[] = typesToEmit.map((t) => BLOCK_DEFS[t](locale));

  const summary =
    locale === "en"
      ? `Generated ${schemas.length} block schema(s).`
      : `Genererte ${schemas.length} blokkskjema(er).`;

  return {
    schemas,
    summary,
  };
}

export { generateBlockSchemaCapability, CAPABILITY_NAME };
