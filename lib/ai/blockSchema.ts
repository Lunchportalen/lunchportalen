/**
 * AI page-builder: JSON blocks only — no JSX/HTML. Validates against `COMPONENT_REGISTRY` via {@link validateComponents};
 * maps AI component names → editor `type` + flat fields in {@link normalizeValidatedBlocksToCmsFlat}.
 */

import { newBlockId } from "@/lib/cms/model/blockId";
import { COMPONENTS } from "@/lib/cms/blocks/componentRegistry";
import { rejectAiHardcodedMarkup, validateComponents } from "@/lib/ai/validateComponentOutput";

/** @deprecated Use COMPONENTS from componentRegistry (tests). */
export const BLOCK_SCHEMA = COMPONENTS;

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return Boolean(v && typeof v === "object" && !Array.isArray(v));
}

function str(v: unknown): string {
  return typeof v === "string" ? String(v).trim() : "";
}

/** Maps AI `minimal` → persisted `center` where editor only supports tri-align. */
function persistTriVariant(v: unknown, fallback: "left" | "center" | "right"): "left" | "center" | "right" {
  const s = str(v).toLowerCase();
  if (s === "minimal") return "center";
  if (s === "left" || s === "right" || s === "center") return s;
  return fallback;
}

/**
 * Reject markup tokens in serialized model output.
 */
export function rejectRawMarkupInModelResponse(response: string): void {
  rejectAiHardcodedMarkup(response);
}

/** @deprecated Alias for {@link validateComponents}. */
export function validateBlocks(blocks: unknown): Array<Record<string, unknown>> {
  return validateComponents(blocks);
}

export { validateComponents };

/**
 * Maps validated AI components to flat editor blocks with stable ids.
 */
export function normalizeValidatedBlocksToCmsFlat(
  blocks: Array<Record<string, unknown>>,
): Array<Record<string, unknown>> {
  return blocks.map((block) => {
    const type = str(block.type);
    const id = newBlockId();

    if (type === "hero_bleed") {
      const v = persistTriVariant(block.variant, "center");
      return {
        id,
        type: "hero_bleed",
        title: str(block.title),
        subtitle: str(block.subtitle),
        ctaPrimary: str(block.ctaPrimary),
        ctaSecondary: "",
        ctaPrimaryHref: str(block.ctaPrimaryHref),
        ctaSecondaryHref: "",
        backgroundImageId: str(block.backgroundImage) || str(block.backgroundImageId),
        overlayImageId: "",
        overlayImageAlt: "",
        variant: v,
        textAlign: v,
        textPosition: v,
        overlayPosition: v,
      };
    }

    if (type === "hero_split") {
      return {
        id,
        type: "hero_full",
        title: str(block.title),
        subtitle: str(block.subtitle),
        imageId: str(block.image) || str(block.imageId),
        imageAlt: "",
        ctaLabel: str(block.ctaLabel),
        ctaHref: str(block.ctaHref),
        useGradient: true,
      };
    }

    if (type === "banner") {
      return {
        id,
        type: "banner",
        text: str(block.text),
        ctaLabel: str(block.ctaLabel),
        ctaHref: str(block.ctaHref),
        backgroundImageId: str(block.backgroundImage) || str(block.backgroundImageId),
        variant: "center",
      };
    }

    if (type === "text_block") {
      return {
        id,
        type: "richText",
        heading: str(block.title),
        body: str(block.body),
      };
    }

    if (type === "split_block") {
      return {
        id,
        type: "cards",
        title: str(block.title),
        text: "",
        items: [
          { title: str(block.leftTitle), text: str(block.leftBody) },
          { title: str(block.rightTitle), text: str(block.rightBody) },
        ],
      };
    }

    if (type === "image_block") {
      return {
        id,
        type: "image",
        imageId: str(block.image) || str(block.imageId),
        alt: str(block.alt),
        caption: str(block.caption),
      };
    }

    if (type === "cta_block") {
      return {
        id,
        type: "cta",
        title: str(block.title),
        body: "",
        buttonLabel: str(block.ctaLabel),
        buttonHref: str(block.ctaHref),
      };
    }

    if (type === "grid_2") {
      const v = persistTriVariant(block.variant, "center");
      const sub = str(block.subtitle);
      const title = sub ? `${sub} – ${str(block.title)}`.trim() : str(block.title);
      return {
        id,
        type: "grid",
        title,
        items: [
          { title: str(block.card1Title), imageId: str(block.card1Image) },
          { title: str(block.card2Title), imageId: str(block.card2Image) },
        ],
        variant: v,
      };
    }

    if (type === "grid_3") {
      const v = persistTriVariant(block.variant, "center");
      const sub = str(block.subtitle);
      const title = sub ? `${sub} – ${str(block.title)}`.trim() : str(block.title);
      return {
        id,
        type: "grid",
        title,
        items: [
          { title: str(block.card1Title), imageId: str(block.card1Image) },
          { title: str(block.card2Title), imageId: str(block.card2Image) },
          { title: str(block.card3Title), imageId: str(block.card3Image) },
        ],
        variant: v,
      };
    }

    if (type === "feature_grid") {
      const mode = str(block.cardMode).toLowerCase();
      const presentation = mode === "plain" ? "" : "feature";
      const cta: { label: string; href: string; variant?: string }[] = [];
      if (str(block.c1Label) && str(block.c1Href)) {
        cta.push({ label: str(block.c1Label), href: str(block.c1Href) });
      }
      if (str(block.c2Label) && str(block.c2Href)) {
        cta.push({ label: str(block.c2Label), href: str(block.c2Href) });
      }
      return {
        id,
        type: "cards",
        title: str(block.title),
        text: str(block.subtitle),
        ...(presentation ? { presentation } : {}),
        items: [
          { title: str(block.f1Title), text: str(block.f1Body) },
          { title: str(block.f2Title), text: str(block.f2Body) },
          { title: str(block.f3Title), text: str(block.f3Body) },
        ],
        ...(cta.length > 0 ? { cta } : {}),
      };
    }

    if (type === "faq_block") {
      return {
        id,
        type: "zigzag",
        title: str(block.sectionTitle),
        steps: [
          { step: "1", title: str(block.q1), text: str(block.a1), imageId: "" },
          { step: "2", title: str(block.q2), text: str(block.a2), imageId: "" },
          { step: "3", title: str(block.q3), text: str(block.a3), imageId: "" },
        ],
      };
    }

    if (type === "testimonial_block") {
      const v = persistTriVariant(block.variant, "center");
      const dens = str(block.density).toLowerCase();
      const density = dens === "compact" || dens === "airy" ? dens : "comfortable";
      const tj = str(block.testimonialsJson);
      if (tj) {
        return {
          id,
          type: "testimonial_block",
          sectionTitle: str(block.sectionTitle),
          testimonialsJson: tj,
          density,
          variant: v,
        };
      }
      const quote = str(block.quote);
      const author = str(block.author);
      const role = str(block.role);
      const image = str(block.image) || str(block.imageUrl) || str(block.src);
      const row = {
        id: "t-1",
        quote,
        author,
        role,
        company: str(block.company) || str(block.source),
        image,
        alt: str(block.alt),
        logo: str(block.logo) || str(block.logoUrl),
      };
      return {
        id,
        type: "testimonial_block",
        sectionTitle: str(block.sectionTitle),
        testimonialsJson: JSON.stringify([row]),
        density,
        variant: v,
      };
    }

    if (type === "pricing_table") {
      return {
        id,
        type: "pricing",
        title: str(block.title),
        intro: str(block.subtitle),
        plans: [
          {
            name: str(block.p1Name),
            price: str(block.p1Price),
            featured: str(block.p1Highlight).toLowerCase() === "yes",
            features: str(block.p1Bullets)
              .split("\n")
              .map((line) => line.trim())
              .filter(Boolean),
            ctaLabel: str(block.p1CtaLabel),
            ctaHref: str(block.p1CtaHref),
          },
          {
            name: str(block.p2Name),
            price: str(block.p2Price),
            featured: str(block.p2Highlight).toLowerCase() === "yes",
            features: str(block.p2Bullets)
              .split("\n")
              .map((line) => line.trim())
              .filter(Boolean),
            ctaLabel: str(block.p2CtaLabel),
            ctaHref: str(block.p2CtaHref),
          },
        ],
      };
    }

    if (type === "newsletter_signup") {
      const v = persistTriVariant(block.variant, "center");
      const cw = str(block.contentWidth).toLowerCase();
      const contentWidth = cw === "wide" || cw === "normal" ? cw : "narrow";
      const sm = str(block.submitMethod).toLowerCase();
      const submitMethod = sm === "post" ? "post" : "get";
      const lede = str(block.lede) || str(block.body);
      return {
        id,
        type: "newsletter_signup",
        eyebrow: str(block.eyebrow),
        title: str(block.title),
        lede,
        ctaLabel: str(block.ctaLabel),
        ctaHref: str(block.ctaHref),
        disclaimer: str(block.disclaimer),
        submitMethod,
        contentWidth,
        variant: v,
      };
    }

    if (type === "quote_block") {
      const v = persistTriVariant(block.variant, "center");
      const cw = str(block.contentWidth).toLowerCase();
      const contentWidth = cw === "wide" || cw === "normal" ? cw : "narrow";
      return {
        id,
        type: "quote_block",
        quote: str(block.quote),
        author: str(block.author),
        role: str(block.role),
        source: str(block.source),
        contentWidth,
        variant: v,
      };
    }

    if (type === "form_embed") {
      const v = persistTriVariant(block.variant, "center");
      const cw = str(block.contentWidth).toLowerCase();
      const contentWidth = cw === "wide" || cw === "narrow" ? cw : "normal";
      return {
        id,
        type: "form_embed",
        formId: str(block.formId),
        iframeSrc: str(block.iframeSrc),
        title: str(block.title),
        lede: str(block.lede),
        embedHtml: str(block.embedHtml),
        contentWidth,
        variant: v,
      };
    }

    if (type === "related_links") {
      return {
        id,
        type: "relatedLinks",
        title: str(block.title),
        subtitle: str(block.subtitle),
        currentPath: str(block.currentPath) || "/",
        tags: str(block.tagLines)
          .split("\n")
          .map((t) => t.trim())
          .filter(Boolean),
      };
    }

    if (type === "section_divider") {
      return { id, type: "divider" };
    }

    if (type === "zigzag_block") {
      let steps: Array<{ step: string; title: string; text: string; imageId: string }> = [];
      try {
        const raw = str(block.zigzagSteps);
        if (raw) {
          const parsed = JSON.parse(raw) as unknown;
          if (Array.isArray(parsed)) {
            steps = parsed.map((item, idx) => {
              const o =
                item && typeof item === "object" && !Array.isArray(item)
                  ? (item as Record<string, unknown>)
                  : {};
              const step =
                typeof o.step === "string" || typeof o.step === "number" ? String(o.step) : String(idx + 1);
              const imageSrc =
                typeof o.imageSrc === "string" && o.imageSrc.trim() ? o.imageSrc.trim() : "";
              return {
                step,
                title: typeof o.title === "string" ? o.title : "",
                text: typeof o.text === "string" ? o.text : "",
                imageId: imageSrc,
              };
            });
          }
        }
      } catch {
        steps = [];
      }
      return {
        id,
        type: "zigzag",
        title: str(block.title),
        steps,
      };
    }

    return { ...block, id, type };
  });
}

/**
 * Accepts root JSON from the model: either a bare array or `{ blocks: [...] }`.
 */
export function extractBlocksArrayFromModelJson(parsed: unknown): unknown[] {
  if (Array.isArray(parsed)) {
    return parsed;
  }
  if (isPlainObject(parsed) && Array.isArray(parsed.blocks)) {
    return parsed.blocks;
  }
  throw new Error("Ugyldig rot: forventet { blocks: [...] } eller en liste.");
}
