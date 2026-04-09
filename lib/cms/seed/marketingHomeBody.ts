/**
 * Canonical nb/prod body for slug `home`.
 * Shapes match editor persistence + normalizeBlockForRender + renderBlock.
 * Images use `imageId` (registry `cms:*` or media_items UUID); paths live in CMS media layer only.
 */

import type { BlockConfig } from "@/lib/cms/design/designContract";
import type { BlockList, BlockNode } from "@/lib/cms/model/blockTypes";

function block(
  id: string,
  type: string,
  data: Record<string, unknown>,
  config?: BlockConfig
): BlockNode {
  return { id, type, data, ...(config ? { config } : {}) };
}

/** Deterministic 7-block homepage: hero_full → cards → zigzag → pricing → grid → cta → relatedLinks. */
export function buildMarketingHomeBody(): BlockList {
  return {
    version: 1,
    meta: {
      surface: "marketing_home",
      note: "Blocks: content in data; theme/layout in config; images via imageId + CMS registry or media_items.",
    },
    blocks: [
      block(
        "home-hero-full",
        "hero_full",
        {
          title: "Firmalunsj med kontroll — uten unntak.",
          subtitle:
            "Én sannhetskilde for bestilling, produksjon og historikk. Mindre administrasjon, mindre matsvinn, bedre lunsj.",
          imageId: "",
          imageAlt: "",
          ctaLabel: "Se meny",
          ctaHref: "/ukemeny",
          useGradient: true,
        },
        { theme: "default", layout: "full" },
      ),
      block(
        "home-value-cards",
        "cards",
        {
          title: "Dette får dere",
          text: "Rolig drift, tydelige frister og forutsigbar kvalitet — bygget for norske arbeidsplasser.",
          items: [
            {
              title: "Spar tid",
              text: "Slipp manuell koordinering. Ansatte bestiller selv, og admin beholder oversikten.",
            },
            {
              title: "Mindre matsvinn",
              text: "Avbestilling før kl. 08:00 gir mer presis produksjon og mindre svinn.",
            },
            {
              title: "Bedre lunsj",
              text: "Variasjon og kvalitet innenfor avtalen — hver dag, uten støy.",
            },
          ],
          cta: [],
        },
        { theme: "default", layout: "standard" },
      ),
      block(
        "home-zigzag",
        "zigzag",
        {
          title: "Slik fungerer det",
          steps: [
            {
              step: "1",
              title: "Firma oppretter konto",
              text: "Kort onboarding og avtale på plass — dere er i gang med én flyt.",
              imageId: "cms:zigzag-step-1",
            },
            {
              step: "2",
              title: "Ansatte velger lunsj",
              text: "Selvbetjening med tydelig cut-off — alle vet hva som gjelder.",
              imageId: "cms:zigzag-step-2",
            },
            {
              step: "3",
              title: "Vi leverer",
              text: "Produksjon og levering følger planen — sporbarhet og kontroll.",
              imageId: "cms:zigzag-step-3",
            },
          ],
        },
        { theme: "highlight", layout: "standard" },
      ),
      block(
        "home-pricing",
        "pricing",
        {
          title: "To nivå – tydelig avtale",
          intro: "På publisert forside hentes pris og planer automatisk fra produktdata når dette er aktivert.",
          plans: [],
        },
        { theme: "default", layout: "standard" },
      ),
      block(
        "home-trust-grid",
        "grid",
        {
          title: "Kunder, byer og leveranser",
          items: [
            {
              title: "Kunder",
              imageId: "cms:grid-customers",
            },
            {
              title: "Byer",
              imageId: "cms:grid-cities",
            },
            {
              title: "Leveranser",
              imageId: "cms:grid-deliveries",
            },
          ],
        },
        { theme: "highlight", layout: "standard" },
      ),
      block(
        "home-close-cta",
        "cta",
        {
          title: "Kom i gang i dag",
          body: "Registrer firma og få full kontroll på lunsjflyten — rolig, forutsigbart og uten unntak.",
          buttonLabel: "Registrer firma",
          buttonHref: "/registrering",
        },
        { theme: "default", layout: "standard" },
      ),
      block(
        "home-related",
        "relatedLinks",
        {
          currentPath: "/",
          tags: ["core", "seo", "local", "system"],
          title: "Relaterte sider",
          subtitle: "Utforsk lunsjordning, alternativ til kantine, system og lokale sider.",
        },
        { theme: "default", layout: "standard" },
      ),
    ],
  };
}
