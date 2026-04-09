/**
 * AI microcopy generator capability: generateMicrocopy.
 * Suggests short UI copy (buttons, placeholders, errors, tooltips, labels) by element type and intent.
 * Deterministic; no LLM. Import this module to register the capability.
 */

import type { Capability } from "../../capabilityRegistry";
import { registerCapability } from "../../capabilityRegistry";

const CAPABILITY_NAME = "generateMicrocopy";

const generateMicrocopyCapability: Capability = {
  name: CAPABILITY_NAME,
  description:
    "Generates microcopy for UI elements: button labels, placeholders, error messages, tooltips, and labels. Uses element type, intent, and locale. Returns one or more variants with character count.",
  requiredContext: ["elementType", "intent"],
  inputSchema: {
    type: "object",
    description: "Generate microcopy input",
    properties: {
      elementType: {
        type: "string",
        description: "button | placeholder | error | tooltip | label | link",
      },
      intent: {
        type: "string",
        description: "e.g. submit, cancel, save, email, required_field, loading, delete, back",
      },
      context: { type: "string", description: "Optional context (e.g. form name)" },
      maxLength: { type: "number", description: "Optional max characters; variants may be truncated" },
      locale: { type: "string", description: "Locale (nb | en)" },
    },
    required: ["elementType", "intent"],
  },
  outputSchema: {
    type: "object",
    description: "Generated microcopy",
    required: ["variants", "recommended", "elementType", "intent"],
    properties: {
      variants: {
        type: "array",
        items: {
          type: "object",
          required: ["text", "characterCount"],
          properties: {
            text: { type: "string" },
            characterCount: { type: "number" },
          },
        },
      },
      recommended: { type: "string", description: "Single best-fit variant" },
      elementType: { type: "string" },
      intent: { type: "string" },
    },
  },
  safetyConstraints: [
    { code: "plain_text_only", description: "Output is plain text only; no HTML or scripts.", enforce: "hard" },
  ],
  targetSurfaces: ["backoffice", "editor", "api"],
};

registerCapability(generateMicrocopyCapability);

export type GenerateMicrocopyInput = {
  elementType: string;
  intent: string;
  context?: string | null;
  maxLength?: number | null;
  locale?: "nb" | "en" | null;
};

export type MicrocopyVariant = {
  text: string;
  characterCount: number;
};

export type GenerateMicrocopyOutput = {
  variants: MicrocopyVariant[];
  recommended: string;
  elementType: string;
  intent: string;
};

type MicrocopyEntry = { nb: string[]; en: string[] };

const MICROCOPY: Record<string, Record<string, MicrocopyEntry>> = {
  button: {
    submit: { nb: ["Send inn", "Fullfør", "Bekreft"], en: ["Submit", "Complete", "Confirm"] },
    cancel: { nb: ["Avbryt", "Lukk"], en: ["Cancel", "Close"] },
    save: { nb: ["Lagre", "Lagre endringer"], en: ["Save", "Save changes"] },
    delete: { nb: ["Slett", "Fjern"], en: ["Delete", "Remove"] },
    back: { nb: ["Tilbake", "Gå tilbake"], en: ["Back", "Go back"] },
    next: { nb: ["Neste", "Fortsett"], en: ["Next", "Continue"] },
    loading: { nb: ["Vennligst vent...", "Laster..."], en: ["Please wait...", "Loading..."] },
    close: { nb: ["Lukk"], en: ["Close"] },
    search: { nb: ["Søk"], en: ["Search"] },
    default: { nb: ["OK", "Gå videre"], en: ["OK", "Continue"] },
  },
  placeholder: {
    email: { nb: ["f.eks. navn@firma.no"], en: ["e.g. name@company.com"] },
    name: { nb: ["Ditt navn"], en: ["Your name"] },
    phone: { nb: ["Telefonnummer"], en: ["Phone number"] },
    search: { nb: ["Søk..."], en: ["Search..."] },
    message: { nb: ["Skriv meldingen din"], en: ["Type your message"] },
    default: { nb: ["Skriv her..."], en: ["Type here..."] },
  },
  error: {
    required_field: { nb: ["Dette feltet er påkrevd.", "Vennligst fyll ut."], en: ["This field is required.", "Please fill in."] },
    invalid_email: { nb: ["Oppgi en gyldig e-postadresse."], en: ["Enter a valid email address."] },
    generic: { nb: ["Noe gikk galt. Prøv igjen."], en: ["Something went wrong. Please try again."] },
    default: { nb: ["Vennligst rett feilen."], en: ["Please correct the error."] },
  },
  tooltip: {
    save: { nb: ["Lagrer endringene dine"], en: ["Saves your changes"] },
    delete: { nb: ["Fjerner dette permanent"], en: ["Removes this permanently"] },
    required: { nb: ["Påkrevd felt"], en: ["Required field"] },
    default: { nb: ["Mer info"], en: ["More info"] },
  },
  label: {
    email: { nb: ["E-post"], en: ["Email"] },
    name: { nb: ["Navn"], en: ["Name"] },
    phone: { nb: ["Telefon"], en: ["Phone"] },
    message: { nb: ["Melding"], en: ["Message"] },
    default: { nb: ["Felt"], en: ["Field"] },
  },
  link: {
    learn_more: { nb: ["Les mer", "Mer informasjon"], en: ["Learn more", "More information"] },
    skip: { nb: ["Hopp over"], en: ["Skip"] },
    default: { nb: ["Åpne"], en: ["Open"] },
  },
};

function normalizeKey(s: string): string {
  return (s ?? "").trim().toLowerCase().replace(/\s+/g, "_");
}

function truncate(text: string, maxLen: number): string {
  if (maxLen <= 0) return text;
  return text.length <= maxLen ? text : text.slice(0, maxLen - 1).trim() + (text.length > maxLen ? "…" : "");
}

/**
 * Generates microcopy variants for the given element type and intent. Deterministic; no external calls.
 */
export function generateMicrocopy(input: GenerateMicrocopyInput): GenerateMicrocopyOutput {
  const isEn = input.locale === "en";
  const elementType = normalizeKey(input.elementType) || "button";
  const intent = normalizeKey(input.intent) || "default";
  const maxLength = typeof input.maxLength === "number" && !Number.isNaN(input.maxLength) ? Math.max(1, Math.floor(input.maxLength)) : 0;

  const typeMap = MICROCOPY[elementType] ?? MICROCOPY.button;
  const entry: MicrocopyEntry = typeMap[intent] ?? typeMap.default ?? { nb: ["..."], en: ["..."] };
  const raw = isEn ? entry.en : entry.nb;

  const variants: MicrocopyVariant[] = raw.map((text) => {
    const t = maxLength > 0 ? truncate(text, maxLength) : text;
    return { text: t, characterCount: t.length };
  });

  const recommended = variants[0]?.text ?? (isEn ? "Submit" : "Send inn");

  return {
    variants,
    recommended,
    elementType,
    intent,
  };
}

export { generateMicrocopyCapability, CAPABILITY_NAME };
