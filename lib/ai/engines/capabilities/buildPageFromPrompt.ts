/**
 * AI page builder capability: buildPageFromPrompt.
 * Builds a full page JSON structure (title, summary, blocks) from topic, audience, and goal.
 * Output is BlockList-compatible (blocks with id, type, data). Deterministic; no LLM.
 * Import this module to register the capability.
 */

import type { BlockNode } from "@/lib/cms/model/blockTypes";
import { newBlockId } from "@/lib/cms/model/blockId";
import type { Capability } from "../../capabilityRegistry";
import { registerCapability } from "../../capabilityRegistry";

const CAPABILITY_NAME = "buildPageFromPrompt";

const buildPageFromPromptCapability: Capability = {
  name: CAPABILITY_NAME,
  description:
    "Builds a full page JSON structure from prompt inputs: topic, audience, goal. Returns title, summary, and blocks (id, type, data) compatible with BlockList. Page type and copy derived from goal. Deterministic; no LLM.",
  requiredContext: ["topic", "audience", "goal"],
  inputSchema: {
    type: "object",
    description: "Build page from prompt input",
    properties: {
      topic: { type: "string", description: "Page topic or theme" },
      audience: { type: "string", description: "Target audience" },
      goal: { type: "string", description: "Page goal (e.g. lead, contact, signup, info, pricing)" },
      locale: { type: "string", description: "Locale (nb | en) for copy" },
    },
    required: ["topic", "audience", "goal"],
  },
  outputSchema: {
    type: "object",
    description: "Full page JSON structure",
    required: ["title", "summary", "blocks"],
    properties: {
      title: { type: "string", description: "Page title" },
      summary: { type: "string", description: "Short page summary" },
      blocks: {
        type: "array",
        description: "Block list (id, type, data)",
        items: {
          type: "object",
          required: ["id", "type", "data"],
          properties: {
            id: { type: "string" },
            type: { type: "string" },
            data: { type: "object" },
          },
        },
      },
      pageType: { type: "string", description: "Derived page type (landing, contact, info, pricing, generic)" },
    },
  },
  safetyConstraints: [
    { code: "no_user_content_injection", description: "Topic, audience, goal used for copy only; no raw HTML.", enforce: "hard" },
  ],
  targetSurfaces: ["backoffice", "editor", "api"],
};

registerCapability(buildPageFromPromptCapability);

export type BuildPageFromPromptInput = {
  topic: string;
  audience: string;
  goal: string;
  locale?: "nb" | "en" | null;
};

export type BuildPageFromPromptOutput = {
  title: string;
  summary: string;
  blocks: BlockNode[];
  pageType?: string;
};

type PageType = "landing" | "contact" | "info" | "pricing" | "generic";

function derivePageType(goal: string): PageType {
  const g = goal.trim().toLowerCase();
  if (/\b(kontakt|contact|henvendelse|melding)\b/.test(g)) return "contact";
  if (/\b(pris|prising|priser|pakker|pakke|abonnement|quote|tilbud)\b/.test(g)) return "pricing";
  if (/\b(info|hvordan|how|om\s+oss|about|slik\s+fungerer|forklaring)\b/.test(g)) return "info";
  if (/\b(lead|forespørsel|signup|registrer|demo|kampanje|landing|konvertering)\b/.test(g)) return "landing";
  return "generic";
}

function safeStr(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

/**
 * Builds a full page JSON structure from topic, audience, goal. Deterministic; no external calls.
 */
export function buildPageFromPrompt(input: BuildPageFromPromptInput): BuildPageFromPromptOutput {
  const topic = safeStr(input.topic) || (input.locale === "en" ? "Overview" : "Oversikt");
  const audience = safeStr(input.audience) || (input.locale === "en" ? "Visitors" : "Besøkende");
  const goal = safeStr(input.goal) || (input.locale === "en" ? "Inform" : "Informere");
  const locale = input.locale === "en" ? "en" : "nb";
  const isEn = locale === "en";
  const pageType = derivePageType(goal);

  const title =
    topic.length > 0
      ? (topic.length <= 70 ? topic : topic.slice(0, 67) + "...")
      : isEn
        ? `Page for ${audience}`
        : `Side for ${audience}`;

  const blocks: BlockNode[] = [];
  const mk = (type: string, data: Record<string, unknown>): BlockNode => ({
    id: newBlockId(),
    type,
    data,
  });

  const heroTitle = isEn ? `${topic} – for ${audience}` : `${topic} – for ${audience}`;
  const heroSubtitle = isEn
    ? "Full control, predictable delivery. Edit blocks to match your message."
    : "Full kontroll, forutsigbar levering. Rediger blokkene til budskapet ditt.";
  const ctaHref = pageType === "contact" ? "#kontakt" : "/kontakt";

  switch (pageType) {
    case "contact": {
      blocks.push(
        mk("hero", {
          title: isEn ? "Contact us" : "Kontakt oss",
          subtitle: heroSubtitle,
          ctaLabel: isEn ? "Send message" : "Send melding",
          ctaHref,
          imageUrl: "",
          imageAlt: "",
        })
      );
      blocks.push(
        mk("richText", {
          heading: isEn ? "How to reach us" : "Slik når du oss",
          body: isEn ? "Email, phone or form below." : "E-post, telefon eller skjema nedenfor.",
        })
      );
      blocks.push(
        mk("cta", {
          title: isEn ? "Get in touch" : "Ta kontakt",
          body: isEn ? "We'll get back to you." : "Vi kommer tilbake til deg.",
          buttonLabel: isEn ? "Contact us" : "Kontakt oss",
          buttonHref: ctaHref,
        })
      );
      break;
    }
    case "info": {
      blocks.push(
        mk("hero", {
          title: heroTitle,
          subtitle: heroSubtitle,
          ctaLabel: isEn ? "Learn more" : "Les mer",
          ctaHref,
          imageUrl: "",
          imageAlt: "",
        })
      );
      blocks.push(
        mk("richText", {
          heading: isEn ? "Step 1" : "Steg 1",
          body: isEn ? `About ${topic} – first step.` : `Om ${topic} – første steg.`,
        })
      );
      blocks.push(
        mk("richText", {
          heading: isEn ? "Step 2" : "Steg 2",
          body: isEn ? "Second step." : "Andre steg.",
        })
      );
      blocks.push(
        mk("richText", {
          heading: isEn ? "Step 3" : "Steg 3",
          body: isEn ? "Third step." : "Tredje steg.",
        })
      );
      blocks.push(
        mk("cta", {
          title: isEn ? "Ready to start?" : "Klar for å starte?",
          body: isEn ? "Contact us." : "Ta kontakt.",
          buttonLabel: isEn ? "Contact" : "Kontakt",
          buttonHref: ctaHref,
        })
      );
      break;
    }
    case "pricing": {
      blocks.push(
        mk("hero", {
          title: isEn ? "Plans and pricing" : "Pakker og priser",
          subtitle: heroSubtitle,
          ctaLabel: isEn ? "See plans" : "Se pakker",
          ctaHref: "#pakker",
          imageUrl: "",
          imageAlt: "",
        })
      );
      blocks.push(
        mk("richText", {
          heading: isEn ? "Options" : "Alternativer",
          body: isEn ? "- Option A\n- Option B\n- Option C" : "- Alternativ A\n- Alternativ B\n- Alternativ C",
        })
      );
      blocks.push(
        mk("cta", {
          title: isEn ? "Get a quote" : "Få tilbud",
          body: isEn ? "We'll tailor an offer." : "Vi tilpasser et tilbud.",
          buttonLabel: isEn ? "Request quote" : "Be om tilbud",
          buttonHref: ctaHref,
        })
      );
      break;
    }
    case "landing":
    case "generic":
    default: {
      blocks.push(
        mk("hero", {
          title: heroTitle,
          subtitle: heroSubtitle,
          ctaLabel: isEn ? "Get in touch" : "Ta kontakt",
          ctaHref,
          imageUrl: "",
          imageAlt: "",
        })
      );
      blocks.push(
        mk("richText", {
          heading: isEn ? "Introduction" : "Introduksjon",
          body: isEn
            ? `This page is about ${topic}, for ${audience}. Goal: ${goal}. Edit to match your message.`
            : `Denne siden handler om ${topic}, for ${audience}. Mål: ${goal}. Rediger til budskapet ditt.`,
        })
      );
      blocks.push(
        mk("richText", {
          heading: isEn ? "Value 1" : "Verdi 1",
          body: isEn ? "Description." : "Beskrivelse.",
        })
      );
      blocks.push(
        mk("richText", {
          heading: isEn ? "Value 2" : "Verdi 2",
          body: isEn ? "Description." : "Beskrivelse.",
        })
      );
      blocks.push(
        mk("richText", {
          heading: isEn ? "Value 3" : "Verdi 3",
          body: isEn ? "Description." : "Beskrivelse.",
        })
      );
      blocks.push(
        mk("cta", {
          title: isEn ? "Ready to get started?" : "Klar for å komme i gang?",
          body: isEn ? "Contact us for more information." : "Kontakt oss for mer informasjon.",
          buttonLabel: isEn ? "Contact" : "Kontakt",
          buttonHref: ctaHref,
        })
      );
      break;
    }
  }

  const summary = isEn
    ? `Page «${title}» (${pageType}): ${blocks.length} block(s). Review and save as draft.`
    : `Side «${title}» (${pageType}): ${blocks.length} blokk(er). Gjennomgå og lagre som kladd.`;

  return {
    title,
    summary,
    blocks,
    pageType,
  };
}

export { buildPageFromPromptCapability, CAPABILITY_NAME };
