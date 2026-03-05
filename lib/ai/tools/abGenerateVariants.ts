/**
 * Phase 32: A/B variant generator – deterministic hero/CTA copy variants as AIPatchV1.
 * Each variant stored as separate ai_suggestions row; shared experimentId for grouping.
 */

import type { AIPatchV1 } from "@/lib/cms/model/aiPatch";
import { newBlockId } from "@/lib/cms/model/blockId";

export type AbVariantInput = {
  locale: string;
  variantCount: 2 | 3;
  target: "hero_cta" | "hero_only" | "cta_only";
  goal?: "lead" | "info" | "signup";
  brand?: string;
  mode?: "safe" | "strict";
};

export type AbVariantContext = {
  blocks: Array<{ id: string; type: string; data?: Record<string, unknown> }>;
  meta?: { description?: string };
  pageTitle?: string;
};

export type AbVariantOutput = {
  summary: string;
  experiment: {
    id: string;
    variantIndex: number;
    variantCount: number;
    label: string;
    target: string;
  };
  patch?: AIPatchV1;
  metaSuggestion?: { title?: string; description?: string };
};

const MAX_OPS_PER_VARIANT = 10;

function newExperimentId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `exp_${crypto.randomUUID()}`;
  }
  return `exp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

type HeroCtaCopy = {
  hero: { title: string; subtitle: string; ctaLabel: string };
  cta: { title: string; body: string; buttonLabel: string };
};

const TEMPLATES_NB: Record<"A" | "B" | "C", HeroCtaCopy> = {
  A: {
    hero: {
      title: "Enklere lunsj for bedrifter",
      subtitle: "Full kontroll, mindre matsvinn, null kantinedrift.",
      ctaLabel: "Be om demo",
    },
    cta: {
      title: "Klar for å teste?",
      body: "Få en kort gjennomgang og et konkret oppsett for din bedrift.",
      buttonLabel: "Be om demo",
    },
  },
  B: {
    hero: {
      title: "Forutsigbar lunsj – uten kantine",
      subtitle: "Standardisert modell. Enkel administrasjon. Levering som bare fungerer.",
      ctaLabel: "Se hvordan det virker",
    },
    cta: {
      title: "Se et eksempeloppsett",
      body: "Vi viser deg hvordan ukesmeny, bestilling og drift henger sammen.",
      buttonLabel: "Se demo",
    },
  },
  C: {
    hero: {
      title: "Kom i gang på 10 minutter",
      subtitle: "Sett rammer én gang. La ansatte bestille selv – innenfor avtalen.",
      ctaLabel: "Kom i gang",
    },
    cta: {
      title: "Få oppsettet klart",
      body: "Vi hjelper deg i gang med riktig nivå, dager og leveringsvindu.",
      buttonLabel: "Start nå",
    },
  },
};

const TEMPLATES_EN: Record<"A" | "B" | "C", HeroCtaCopy> = {
  A: {
    hero: {
      title: "Simpler lunch for businesses",
      subtitle: "Full control, less waste, no canteen operations.",
      ctaLabel: "Request a demo",
    },
    cta: {
      title: "Ready to try?",
      body: "Get a short walkthrough and a concrete setup for your company.",
      buttonLabel: "Request a demo",
    },
  },
  B: {
    hero: {
      title: "Predictable lunch – without a canteen",
      subtitle: "Standardized model. Simple administration. Delivery that just works.",
      ctaLabel: "See how it works",
    },
    cta: {
      title: "See an example setup",
      body: "We show you how weekly menu, ordering and operations fit together.",
      buttonLabel: "See demo",
    },
  },
  C: {
    hero: {
      title: "Get started in 10 minutes",
      subtitle: "Set the rules once. Let employees order themselves – within the agreement.",
      ctaLabel: "Get started",
    },
    cta: {
      title: "Get the setup ready",
      body: "We help you get started with the right level, days and delivery window.",
      buttonLabel: "Start now",
    },
  },
};

function getTemplates(locale: string): Record<"A" | "B" | "C", HeroCtaCopy> {
  return locale === "en" ? TEMPLATES_EN : TEMPLATES_NB;
}

export function generateAbVariants(args: {
  input: AbVariantInput;
  context: AbVariantContext;
}): {
  experimentId: string;
  variants: Array<{
    label: string;
    output: Omit<AbVariantOutput, "experiment"> & { experiment: Omit<AbVariantOutput["experiment"], "id"> };
    patch?: AIPatchV1;
    metaSuggestion?: { title?: string; description?: string };
  }>;
} {
  const { input, context } = args;
  const locale = (input.locale || "nb").toLowerCase().startsWith("en") ? "en" : "nb";
  const variantCount = input.variantCount === 3 ? 3 : 2;
  const target = input.target === "hero_only" || input.target === "cta_only" ? input.target : "hero_cta";
  const blocks = context.blocks.slice(0, 100);

  const heroBlock = blocks.find((b) => b.type === "hero");
  const ctaBlock = blocks.find((b) => b.type === "cta");
  const templates = getTemplates(locale);
  const labels: ("A" | "B" | "C")[] = variantCount === 3 ? ["A", "B", "C"] : ["A", "B"];
  const experimentId = newExperimentId();

  const variants: Array<{
    label: string;
    output: Omit<AbVariantOutput, "experiment"> & { experiment: Omit<AbVariantOutput["experiment"], "id"> };
    patch?: AIPatchV1;
    metaSuggestion?: { title?: string; description?: string };
  }> = [];

  for (let i = 0; i < labels.length; i++) {
    const key = labels[i];
    const t = templates[key];
    const ops: AIPatchV1["ops"] = [];
    const label = "Variant " + key;

    if (target === "hero_cta" || target === "hero_only") {
      if (heroBlock) {
        ops.push({
          op: "updateBlockData",
          id: heroBlock.id,
          data: {
            title: t.hero.title,
            subtitle: t.hero.subtitle,
            ctaLabel: t.hero.ctaLabel,
          },
        });
      } else {
        const id = newBlockId();
        ops.push({
          op: "insertBlock",
          index: 0,
          block: {
            id,
            type: "hero",
            data: {
              title: t.hero.title,
              subtitle: t.hero.subtitle,
              ctaLabel: t.hero.ctaLabel,
              ctaHref: "#kontakt",
            },
          },
        });
      }
    }

    if (target === "hero_cta" || target === "cta_only") {
      if (ctaBlock) {
        ops.push({
          op: "updateBlockData",
          id: ctaBlock.id,
          data: {
            title: t.cta.title,
            body: t.cta.body,
            buttonLabel: t.cta.buttonLabel,
          },
        });
      } else {
        const id = newBlockId();
        ops.push({
          op: "insertBlock",
          index: blocks.length,
          block: {
            id,
            type: "cta",
            data: {
              title: t.cta.title,
              body: t.cta.body,
              buttonLabel: t.cta.buttonLabel,
              buttonHref: "#kontakt",
            },
          },
        });
      }
    }

    if (ops.length > MAX_OPS_PER_VARIANT) {
      ops.length = MAX_OPS_PER_VARIANT;
    }

    const patch: AIPatchV1 = { version: 1, ops };
    const summary =
      locale === "en"
        ? "A/B " + label + ": hero/CTA copy variant."
        : "A/B " + label + ": hero/CTA-kopivariant.";

    variants.push({
      label,
      output: {
        summary,
        experiment: {
          variantIndex: i + 1,
          variantCount,
          label,
          target,
        },
        patch,
      },
      patch,
    });
  }

  return { experimentId, variants };
}