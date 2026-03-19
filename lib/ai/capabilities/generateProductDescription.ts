/**
 * Product description AI capability: generateProductDescription.
 * Generates short (tagline), long (paragraph), and optional meta product descriptions
 * from product name, features, category, audience, and tone. Deterministic; no LLM.
 * Import this module to register the capability.
 */

import type { Capability } from "../capabilityRegistry";
import { registerCapability } from "../capabilityRegistry";

const CAPABILITY_NAME = "generateProductDescription";

const generateProductDescriptionCapability: Capability = {
  name: CAPABILITY_NAME,
  description:
    "Product description AI: generates short tagline, long paragraph, and optional meta description from product name, features, category, audience, and tone. Plain text only; deterministic; no LLM.",
  requiredContext: ["productName"],
  inputSchema: {
    type: "object",
    description: "Generate product description input",
    properties: {
      productName: { type: "string", description: "Product name" },
      features: {
        type: "array",
        description: "Optional list of features or benefits",
        items: { type: "string" },
      },
      category: { type: "string", description: "Optional product category" },
      audience: { type: "string", description: "Target audience" },
      tone: { type: "string", description: "Tone (e.g. enterprise, warm, neutral)" },
      locale: { type: "string", description: "Locale (nb | en) for copy" },
      maxShortLength: { type: "number", description: "Max characters for short description (default 160)" },
      maxMetaLength: { type: "number", description: "Max characters for meta description (default 155)" },
    },
    required: ["productName"],
  },
  outputSchema: {
    type: "object",
    description: "Generated product descriptions",
    required: ["shortDescription", "longDescription", "summary"],
    properties: {
      shortDescription: { type: "string", description: "Tagline or one-liner" },
      longDescription: { type: "string", description: "Full paragraph" },
      metaDescription: { type: "string", description: "SEO meta description" },
      summary: { type: "string" },
    },
  },
  safetyConstraints: [
    { code: "plain_text_only", description: "Output is plain text only; no HTML or scripts.", enforce: "hard" },
  ],
  targetSurfaces: ["backoffice", "editor", "api"],
};

registerCapability(generateProductDescriptionCapability);

export type GenerateProductDescriptionInput = {
  productName: string;
  features?: string[] | null;
  category?: string | null;
  audience?: string | null;
  tone?: string | null;
  locale?: "nb" | "en" | null;
  maxShortLength?: number | null;
  maxMetaLength?: number | null;
};

export type GenerateProductDescriptionOutput = {
  shortDescription: string;
  longDescription: string;
  metaDescription: string;
  summary: string;
};

function safeStr(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  const trimmed = s.slice(0, max - 3).trim();
  const lastSpace = trimmed.lastIndexOf(" ");
  if (lastSpace > max / 2) return trimmed.slice(0, lastSpace) + "...";
  return trimmed + "...";
}

/**
 * Generates product descriptions (short, long, meta). Deterministic; no external calls.
 */
export function generateProductDescription(input: GenerateProductDescriptionInput): GenerateProductDescriptionOutput {
  const locale = input.locale === "en" ? "en" : "nb";
  const isEn = locale === "en";
  const productName = safeStr(input.productName) || (isEn ? "Product" : "Produkt");
  const category = safeStr(input.category);
  const audience = safeStr(input.audience) || (isEn ? "customers" : "kunder");
  const tone = safeStr(input.tone).toLowerCase();
  const maxShort = Math.min(300, Math.max(60, Math.floor(Number(input.maxShortLength) ?? 160)));
  const maxMeta = Math.min(200, Math.max(80, Math.floor(Number(input.maxMetaLength) ?? 155)));

  const features = Array.isArray(input.features)
    ? input.features.filter((f) => typeof f === "string" && (f as string).trim()).map((f) => (f as string).trim())
    : [];

  const toneIntro = tone === "warm" ? (isEn ? "A friendly, clear " : "Et vennlig og tydelig ") : tone === "enterprise" ? (isEn ? "A professional " : "Et profesjonelt ") : (isEn ? "A " : "Et ");
  const forAudience = isEn ? ` for ${audience}.` : ` for ${audience}.`;
  const shortSuffix = category ? (isEn ? ` in the ${category} space.` : ` innen ${category}.`) : forAudience;

  let shortDescription = toneIntro + productName + shortSuffix;
  if (features.length > 0) {
    const first = features[0];
    shortDescription = isEn
      ? `${productName}: ${first}. Built for ${audience}.`
      : `${productName}: ${first}. Bygget for ${audience}.`;
  }
  shortDescription = truncate(shortDescription, maxShort);

  const featureList = features.length > 0 ? features.join(", ") : (isEn ? "key benefits" : "viktige fordeler");
  let longDescription = isEn
    ? `${productName} delivers ${featureList}${category ? ` in the ${category} category` : ""}. It is designed for ${audience} and focuses on clear value and ease of use. Edit this description to match your exact offering.`
    : `${productName} leverer ${featureList}${category ? ` innen ${category}` : ""}. Produktet er designet for ${audience} med fokus på tydelig verdi og brukervennlighet. Rediger beskrivelsen til ditt tilbud.`;
  longDescription = longDescription.slice(0, 800);

  let metaDescription = isEn
    ? `${productName} – ${features.length > 0 ? features[0] + ". " : ""}For ${audience}. ${category ? category + ". " : ""}Learn more.`
    : `${productName} – ${features.length > 0 ? features[0] + ". " : ""}For ${audience}. ${category ? category + ". " : ""}Les mer.`;
  metaDescription = truncate(metaDescription, maxMeta);

  const summary = isEn
    ? `Generated short (${shortDescription.length} chars), long (${longDescription.length} chars), and meta (${metaDescription.length} chars) descriptions for «${productName}».`
    : `Genererte kort (${shortDescription.length} tegn), lang (${longDescription.length} tegn) og meta (${metaDescription.length} tegn) beskrivelse for «${productName}».`;

  return {
    shortDescription,
    longDescription,
    metaDescription,
    summary,
  };
}

export { generateProductDescriptionCapability, CAPABILITY_NAME };
