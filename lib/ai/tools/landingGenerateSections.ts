/**
 * Phase 28: Landing page section generator (deterministic AIPatchV1).
 * Produces insertBlock ops for hero, value-props (richText), intro (richText), cta.
 * Uses canonical BlockNode shape and newBlockId(); no valueProps3 type (use richText).
 */

import type { AIPatchV1 } from "@/lib/cms/model/aiPatch";
import { newBlockId } from "@/lib/cms/model/blockId";

export type LandingGenerateInput = {
  goal: string;
  audience: string;
  offerName: string;
  proofPoints?: string[];
  tone?: "enterprise" | "warm" | "neutral";
  locale: string;
};

type ExistingBlock = { id: string; type: string };

function safeStr(s: unknown): string {
  return typeof s === "string" ? s.trim() : "";
}

function defaultOfferName(locale: string): string {
  return locale === "en" ? "Lunchportalen" : "Lunchportalen";
}

/**
 * Deterministic landing patch: hero, value-props (richText), intro (richText), cta.
 * existingBlocks: client-provided list of { id, type } only (no content table read).
 */
export function generateLandingPatch(args: {
  input: LandingGenerateInput;
  existingBlocks: ExistingBlock[];
}): { summary: string; patch: AIPatchV1 } {
  const { input, existingBlocks } = args;
  const goal = safeStr(input.goal) || (input.locale === "en" ? "Get demo bookings" : "Få forespørsler");
  const audience = safeStr(input.audience) || (input.locale === "en" ? "HR / Office managers" : "Beslutningstakere");
  const offerName = safeStr(input.offerName) || defaultOfferName(input.locale);
  const tone = input.tone === "warm" || input.tone === "neutral" ? input.tone : "enterprise";
  const proofPoints = Array.isArray(input.proofPoints) ? input.proofPoints.filter((p) => typeof p === "string").slice(0, 3) : [];

  const blocks = existingBlocks.slice(0, 100);
  const ops: AIPatchV1["ops"] = [];

  const hasHero = blocks.some((b) => b.type === "hero");
  const richTextCount = blocks.filter((b) => b.type === "richText").length;
  const hasCta = blocks.some((b) => b.type === "cta");

  const headline =
    input.locale === "en"
      ? `${offerName} – ${audience}`
      : `${offerName} – for ${audience}`;
  const subheadline =
    input.locale === "en"
      ? `Reach your goal: ${goal}`
      : `Nå målet ditt: ${goal}`;
  const ctaLabel = input.locale === "en" ? "Get in touch" : "Ta kontakt";
  const ctaHref = "#kontakt";

  if (!hasHero) {
    const id = newBlockId();
    ops.push({
      op: "insertBlock",
      index: 0,
      block: {
        id,
        type: "hero",
        data: {
          title: headline,
          subtitle: subheadline,
          ctaLabel,
          ctaHref,
          imageUrl: "",
          imageAlt: "",
        },
      },
    });
    blocks.unshift({ id, type: "hero" });
  }

  if (richTextCount < 1) {
    const bullet1 = proofPoints[0] || (input.locale === "en" ? "Simple setup" : "Enkel oppsett");
    const bullet2 = proofPoints[1] || (input.locale === "en" ? "Clear reporting" : "Tydelig rapportering");
    const bullet3 = proofPoints[2] || (input.locale === "en" ? "Support when you need it" : "Support når du trenger det");
    const valuePropsBody = `- ${bullet1}\n- ${bullet2}\n- ${bullet3}`;
    const id = newBlockId();
    ops.push({
      op: "insertBlock",
      index: 1,
      block: {
        id,
        type: "richText",
        data: {
          heading: input.locale === "en" ? "Why choose us" : "Hvorfor velge oss",
          body: valuePropsBody,
        },
      },
    });
    blocks.splice(1, 0, { id, type: "richText" });
  }

  if (richTextCount < 2) {
    const introHeading = input.locale === "en" ? "Introduction" : "Introduksjon";
    const introBody =
      tone === "warm"
        ? input.locale === "en"
          ? `Welcome. We help ${audience} with ${goal}.`
          : `Velkommen. Vi hjelper ${audience} med ${goal}.`
        : input.locale === "en"
          ? `${offerName} supports ${audience} to achieve ${goal}.`
          : `${offerName} hjelper ${audience} med å nå ${goal}.`;
    const id = newBlockId();
    const insertIdx = Math.min(2, blocks.length);
    ops.push({
      op: "insertBlock",
      index: insertIdx,
      block: {
        id,
        type: "richText",
        data: { heading: introHeading, body: introBody },
      },
    });
    blocks.splice(insertIdx, 0, { id, type: "richText" });
  }

  if (!hasCta) {
    const id = newBlockId();
    const ctaTitle = input.locale === "en" ? "Ready to get started?" : "Klar for å komme i gang?";
    const ctaBody = input.locale === "en" ? "Contact us for a demo or more information." : "Kontakt oss for en demo eller mer informasjon.";
    ops.push({
      op: "insertBlock",
      index: blocks.length,
      block: {
        id,
        type: "cta",
        data: {
          title: ctaTitle,
          body: ctaBody,
          buttonLabel: ctaLabel,
          buttonHref: ctaHref,
        },
      },
    });
  }

  const summary =
    input.locale === "en"
      ? `Landing structure: ${ops.length} block(s) (hero, value props, intro, cta).`
      : `Landingsstruktur: ${ops.length} blokk(er) (hero, verdier, intro, cta).`;

  const patch: AIPatchV1 = {
    version: 1,
    ops: ops.length > 20 ? ops.slice(0, 20) : ops,
  };

  return { summary, patch };
}