/**
 * Title/meta generation capability: generateMeta.
 * Outputs: title, meta description, og:title, og:description.
 * Import this module to register the capability.
 */

import type { Capability } from "../../capabilityRegistry";
import { registerCapability } from "../../capabilityRegistry";

const CAPABILITY_NAME = "generateMeta";

const TITLE_MAX = 60;
const META_DESC_MAX = 160;
const OG_DESC_MAX = 200;

const generateMetaCapability: Capability = {
  name: CAPABILITY_NAME,
  description: "Generates SEO and Open Graph meta: title, meta description, og:title, og:description. Suitable for <title>, meta name=\"description\", and og tags.",
  requiredContext: [],
  inputSchema: {
    type: "object",
    description: "Generate meta input",
    required: ["topic"],
    properties: {
      topic: { type: "string", description: "Page topic or title seed" },
      audience: { type: "string", description: "Target audience" },
      intent: { type: "string", description: "Intent (e.g. inform, convert, signup)" },
      locale: { type: "string", description: "Locale (nb | en)" },
      brand: { type: "string", description: "Brand name for description" },
    },
  },
  outputSchema: {
    type: "object",
    description: "Generated meta fields",
    required: ["title", "metaDescription", "ogTitle", "ogDescription"],
    properties: {
      title: { type: "string", description: "SEO title (<title>)" },
      metaDescription: { type: "string", description: "Meta description" },
      ogTitle: { type: "string", description: "og:title" },
      ogDescription: { type: "string", description: "og:description" },
    },
  },
  safetyConstraints: [
    { code: "length_limits", description: "Title and descriptions respect recommended length limits.", enforce: "hard" },
  ],
  targetSurfaces: ["backoffice", "editor", "api"],
};

registerCapability(generateMetaCapability);

export type GenerateMetaInput = {
  topic: string;
  audience?: string | null;
  intent?: string | null;
  locale?: "nb" | "en";
  brand?: string | null;
};

export type GenerateMetaOutput = {
  title: string;
  metaDescription: string;
  ogTitle: string;
  ogDescription: string;
};

function safeStr(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function truncate(s: string, max: number): string {
  const t = s.trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max - 3).trim();
  const lastSpace = cut.lastIndexOf(" ");
  if (lastSpace > max * 0.6) return cut.slice(0, lastSpace) + "...";
  return cut + "...";
}

/**
 * Generates title, meta description, og:title, and og:description from topic and optional context.
 * Deterministic; lengths capped for SEO (title ≤60, meta description ≤160, og description ≤200).
 */
export function generateMeta(input: GenerateMetaInput): GenerateMetaOutput {
  const topic = safeStr(input.topic) || (input.locale === "en" ? "Page" : "Side");
  const audience = safeStr(input.audience);
  const intent = safeStr(input.intent);
  const locale = input.locale === "en" ? "en" : "nb";
  const brand = safeStr(input.brand) || "Lunchportalen";
  const isEn = locale === "en";

  const titleSeed = audience ? `${topic} – ${audience}` : topic;
  const title = truncate(titleSeed, TITLE_MAX);

  const intentPhrase = isEn
    ? intent === "signup"
      ? "sign up"
      : intent === "convert"
        ? "leads"
        : "information"
    : intent === "signup"
      ? "registrering"
      : intent === "convert"
        ? "forespørsler"
        : "informasjon";

  const metaDescBase = isEn
    ? `${brand} helps workplaces with lunch ordering and delivery. ${topic}. Get ${intentPhrase}, request a demo, or contact us.`
    : `${brand} hjelper arbeidsplasser med lunsjbestilling og levering. ${topic}. Få ${intentPhrase}, be om demo eller ta kontakt.`;
  const metaDescription = truncate(metaDescBase, META_DESC_MAX);

  const ogTitle = truncate(titleSeed, TITLE_MAX);
  const ogDescBase = isEn
    ? `${topic}. ${brand} – lunch ordering and delivery for workplaces.`
    : `${topic}. ${brand} – lunsjbestilling og levering for arbeidsplasser.`;
  const ogDescription = truncate(ogDescBase, OG_DESC_MAX);

  return {
    title,
    metaDescription,
    ogTitle,
    ogDescription,
  };
}

export { generateMetaCapability, CAPABILITY_NAME };
