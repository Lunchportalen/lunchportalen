import { newBlockId } from "@/lib/cms/model/blockId";

export type PageBuilderDraftBlock = Record<string, unknown>;

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

const DEFAULT_HERO_TITLE = "Lunsj med kontroll og forutsigbarhet";
const DEFAULT_BANNER_TEXT = "Bedre lunsj — mindre administrasjon";
const DEFAULT_CTA_TITLE = "Neste steg";
const DEFAULT_CTA_BODY = "Ta kontakt for en uforpliktende prat om lunsjløsning på arbeidsplassen.";
const DEFAULT_CTA_LABEL = "Kontakt oss";

/**
 * Ensures page-builder output is publish-ready: strong opener + closing CTA when the model omits them.
 */
export function enrichPageBuilderBlocks(blocks: PageBuilderDraftBlock[]): PageBuilderDraftBlock[] {
  if (!Array.isArray(blocks) || blocks.length === 0) return Array.isArray(blocks) ? blocks : [];
  const out = blocks.map((b) => ({ ...b }));

  const hasDedicatedCta = out.some((b) => str(b.type).toLowerCase() === "cta");
  const hasCtaBannerOrHero =
    !hasDedicatedCta &&
    out.some((b) => {
      const t = str(b.type).toLowerCase();
      if (t === "banner") return Boolean(str(b.ctaLabel) && str(b.ctaHref));
      if (t === "hero_bleed") return Boolean(str(b.ctaPrimary) && str(b.ctaPrimaryHref));
      if (t === "hero_full")
        return Boolean((str(b.ctaPrimary) && str(b.ctaPrimaryHref)) || (str(b.ctaLabel) && str(b.ctaHref)));
      return false;
    });

  for (let i = 0; i < out.length; i++) {
    const b = out[i];
    const t = str(b.type).toLowerCase();
    if (t === "hero_bleed" && !str(b.title)) {
      out[i] = { ...b, title: DEFAULT_HERO_TITLE };
    }
    if (t === "hero_full" && !str(b.title)) {
      out[i] = { ...b, title: DEFAULT_HERO_TITLE };
    }
    if (t === "hero" && !str((b as { title?: unknown }).title)) {
      out[i] = { ...b, title: DEFAULT_HERO_TITLE };
    }
    if (t === "banner" && !str(b.text)) {
      out[i] = { ...b, text: DEFAULT_BANNER_TEXT };
    }
    if (t === "richText" && !str(b.heading) && str(b.body)) {
      out[i] = { ...b, heading: "Kort og tydelig verdiforslag" };
    }
  }

  if (!hasDedicatedCta && !hasCtaBannerOrHero) {
    out.push({
      id: newBlockId(),
      type: "cta",
      title: DEFAULT_CTA_TITLE,
      body: DEFAULT_CTA_BODY,
      buttonLabel: DEFAULT_CTA_LABEL,
      buttonHref: "/kontakt",
    });
  }

  return out;
}
