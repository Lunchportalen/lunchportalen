/**
 * FAQ generation capability: generateFAQ.
 * Outputs: FAQ JSON (q/a items) + schema.org FAQPage.
 * Import this module to register the capability.
 */

import { faqJsonLd, type JsonLdFaqItem } from "@/lib/seo/jsonld";
import type { Capability } from "../capabilityRegistry";
import { registerCapability } from "../capabilityRegistry";

const CAPABILITY_NAME = "generateFAQ";

const generateFAQCapability: Capability = {
  name: CAPABILITY_NAME,
  description: "Generates FAQ items (question/answer) and schema.org FAQPage JSON-LD for rich snippets and on-page FAQ sections.",
  requiredContext: [],
  inputSchema: {
    type: "object",
    description: "Generate FAQ input",
    properties: {
      topic: { type: "string", description: "Page or product topic for FAQ focus" },
      locale: { type: "string", description: "Locale (nb | en)" },
      count: { type: "number", description: "Max number of FAQ items (default 5)" },
    },
  },
  outputSchema: {
    type: "object",
    description: "FAQ JSON + schema.org FAQPage",
    required: ["faqJson", "schemaOrg"],
    properties: {
      faqJson: {
        type: "array",
        description: "FAQ items [{ q, a }]",
        items: { type: "object", properties: { q: { type: "string" }, a: { type: "string" } } },
      },
      schemaOrg: {
        type: "object",
        description: "schema.org FAQPage JSON-LD (for script tag)",
      },
    },
  },
  safetyConstraints: [
    { code: "plain_text_only", description: "FAQ q/a are plain text; no HTML.", enforce: "hard" },
  ],
  targetSurfaces: ["backoffice", "editor", "api"],
};

registerCapability(generateFAQCapability);

export type GenerateFAQInput = {
  topic?: string | null;
  locale?: "nb" | "en";
  count?: number | null;
};

export type FAQItem = { q: string; a: string };

export type GenerateFAQOutput = {
  /** FAQ items for display or richText body. */
  faqJson: FAQItem[];
  /** schema.org FAQPage JSON-LD (use in <script type="application/ld+json">). */
  schemaOrg: ReturnType<typeof faqJsonLd>;
};

function safeStr(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

const DEFAULT_FAQ_NB: FAQItem[] = [
  { q: "Hva er Lunchportalen?", a: "Lunchportalen er en lunsjordning og leveranseløsning for arbeidsplasser." },
  { q: "Hvordan fungerer leveringen?", a: "Bestillinger leveres til kontoret på avtalt tid." },
  { q: "Hvem passer dette for?", a: "HR og kontoransvarlige som ønsker en enkel lunsjordning." },
  { q: "Kan vi prøve før vi bestiller?", a: "Ja, ta kontakt for en demo eller prøveperiode." },
  { q: "Hvordan bestiller vi?", a: "Registrer bedriften, velg leveringsdager og bestill via portalen eller avtale." },
];

const DEFAULT_FAQ_EN: FAQItem[] = [
  { q: "What is Lunchportalen?", a: "Lunchportalen is a lunch ordering and delivery solution for workplaces." },
  { q: "How does delivery work?", a: "Orders are delivered to your office at the agreed time." },
  { q: "Who is this for?", a: "HR and office managers who want a simple lunch solution." },
  { q: "Can we try before we commit?", a: "Yes, contact us for a demo or trial period." },
  { q: "How do we order?", a: "Register your company, choose delivery days, and order via the portal or agreement." },
];

/**
 * Generates FAQ JSON and schema.org FAQPage from topic and locale.
 * Deterministic; uses default q/a set. Empty or invalid items are filtered before schema.org.
 */
export function generateFAQ(input: GenerateFAQInput): GenerateFAQOutput {
  const topic = safeStr(input.topic);
  const locale = input.locale === "en" ? "en" : "nb";
  const count = typeof input.count === "number" && input.count > 0 ? Math.min(input.count, 10) : 5;

  const base = locale === "en" ? DEFAULT_FAQ_EN : DEFAULT_FAQ_NB;
  const faqJson: FAQItem[] = base.slice(0, count).map((item) => ({
    q: item.q,
    a: item.a,
  }));

  const jsonLdItems: JsonLdFaqItem[] = faqJson.filter((x) => x.q && x.a);
  const schemaOrg = jsonLdItems.length > 0 ? faqJsonLd(jsonLdItems) : faqJsonLd([{ q: base[0].q, a: base[0].a }]);

  return {
    faqJson,
    schemaOrg,
  };
}

export { generateFAQCapability, CAPABILITY_NAME };
