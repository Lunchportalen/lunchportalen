/**
 * Generates prioritized, explainable improvements (CRO → SEO → UX).
 * Pure suggestions: `apply` returns new block arrays — no in-place mutation.
 */

import type { Block, CtaBlock, HeroBlock, RichTextBlock } from "@/app/(backoffice)/backoffice/content/_components/editorBlockTypes";
import { getBlockEntryFlatForRender } from "@/lib/cms/blocks/blockEntryContract";
import { newBlockId } from "@/lib/cms/model/blockId";

import { evaluatePage, hasEffectiveCta, type PageScoreInput } from "@/lib/ai/pageScore";

export type ImprovementKind = "seo" | "cro" | "ux";

export type BlockImprovement = {
  id: string;
  type: ImprovementKind;
  description: string;
  /** Shown in UI: "AI foreslår dette fordi …" */
  because: string;
  safe: boolean;
  /** When absent, the item is advisory only (no "Anvend") */
  apply?: (blocks: Block[]) => Block[];
};

const TYPE_RANK: Record<ImprovementKind, number> = { cro: 0, seo: 1, ux: 2 };

function hasStandaloneCta(blocks: Block[]): boolean {
  return blocks.some((b) => b.type === "cta");
}

function heroNeedsCta(blocks: Block[]): HeroBlock | null {
  for (const b of blocks) {
    if (b.type !== "hero") continue;
    const f = getBlockEntryFlatForRender(b);
    const has =
      Boolean(String(f.ctaLabel ?? "").trim()) && Boolean(String(f.ctaHref ?? "").trim());
    if (!has) return b;
  }
  return null;
}

function metaDescription(meta: PageScoreInput["meta"]): string {
  if (!meta || typeof meta !== "object") return "";
  if ("description" in meta && typeof meta.description === "string") return meta.description.trim();
  const seo = (meta as { seo?: unknown }).seo;
  if (seo && typeof seo === "object" && "description" in seo && typeof (seo as { description?: unknown }).description === "string") {
    return String((seo as { description: string }).description).trim();
  }
  return "";
}

/**
 * Returns improvements sorted CRO first, then SEO, then UX.
 */
export function generateImprovements(page: PageScoreInput): BlockImprovement[] {
  const { title, blocks, meta } = page;
  const score = evaluatePage(page);
  const improvements: BlockImprovement[] = [];

  const hero = heroNeedsCta(blocks);
  if (hero) {
    improvements.push({
      id: `hero-cta-${hero.id}`,
      type: "cro",
      description: "Legg til knapp i hero",
      because: "Hero mangler synlig knapp og lenke.",
      safe: true,
      apply: (prev) =>
        prev.map((b) => {
          if (b.id !== hero.id || b.type !== "hero") return b;
          return {
            ...b,
            contentData: {
              ...b.contentData,
              ctaLabel: String(b.contentData.ctaLabel ?? "").trim() || "Kom i gang",
              ctaHref: String(b.contentData.ctaHref ?? "").trim() || "#",
            },
          };
        }),
    });
  }

  if (!hasEffectiveCta(blocks)) {
    const cta: CtaBlock = {
      id: newBlockId(),
      type: "cta",
      contentData: {
        title: "Klar for bedre lunsj?",
        body: "Ta kontakt — vi hjelper dere i gang.",
      },
      settingsData: {},
      structureData: {
        buttonLabel: "Kontakt oss",
        buttonHref: "#",
      },
    };
    improvements.push({
      id: "add-cta-block",
      type: "cro",
      description: "Legg til CTA-blokk",
      because: "Siden mangler en dedikert handlingsblokk (CTA).",
      safe: true,
      apply: (prev) => [...prev, cta],
    });
  }

  const desc = metaDescription(meta);
  if (!desc) {
    improvements.push({
      id: "seo-meta-desc",
      type: "seo",
      description: "Optimaliser SEO (meta-beskrivelse)",
      because: "Mangler meta-beskrivelse under Egenskaper → SEO — viktig for SERP og CTR.",
      safe: false,
    });
  } else if (desc.length < 80) {
    improvements.push({
      id: "seo-meta-desc-short",
      type: "seo",
      description: "Utvid meta-beskrivelse",
      because: "Meta-beskrivelsen er kort; mer kontekst kan forbedre klikkrate.",
      safe: false,
    });
  }

  const t = String(title ?? "").trim();
  if (t.length > 0 && t.length < 10) {
    improvements.push({
      id: "seo-title-short",
      type: "seo",
      description: "Forbedre sidetittel",
      because: "Sidetittelen er for kort for tydelig relevans i søk og deling.",
      safe: false,
    });
  }

  if (blocks.length < 3 || score.issues.includes("Lite tekstinnhold for søk og konvertering")) {
    const section: RichTextBlock = {
      id: newBlockId(),
      type: "richText",
      heading: "Ny seksjon",
      body: "Skriv 2–3 avsnitt som forklarer verdien for leseren. Bruk konkrete fordeler og et tydelig neste steg.",
    };
    improvements.push({
      id: "ux-add-section",
      type: "ux",
      description: "Forbedre tekst (ny seksjon)",
      because: "Siden har lite tekstinnhold — en ekstra seksjon gjør budskapet sterkere.",
      safe: true,
      apply: (prev) => [...prev, section],
    });
  }

  improvements.sort((a, b) => {
    const d = TYPE_RANK[a.type] - TYPE_RANK[b.type];
    if (d !== 0) return d;
    return a.id.localeCompare(b.id);
  });

  return improvements;
}
