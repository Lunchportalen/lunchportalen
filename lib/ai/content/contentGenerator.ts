/**
 * Genererer: artikler, seksjoner, blokker, FAQ, meta.
 * Samlet inngang for innholdsgenerering; bruker eksisterende capabilities og modeller.
 */

import type { BlockNode } from "@/lib/cms/model/blockTypes";
import type { PageAiSeo, PageAiIntent } from "@/lib/cms/model/pageAiContract";
import { autoGenerateArticle } from "@/lib/ai/capabilities/autoGenerateArticle";
import type { AutoGenerateArticleInput, AutoGenerateArticleOutput } from "@/lib/ai/capabilities/autoGenerateArticle";
import { generateBlock } from "@/lib/ai/capabilities/generateBlock";
import type { GenerateBlockInput } from "@/lib/ai/capabilities/generateBlock";
import { generateFAQ } from "@/lib/ai/capabilities/generateFAQ";
import type { GenerateFAQInput, GenerateFAQOutput, FAQItem } from "@/lib/ai/capabilities/generateFAQ";
import { generateInterface } from "@/lib/ai/ui/generateInterface";
import type { GenerateInterfaceInput, UILayoutSpecification, SectionSpec } from "@/lib/ai/ui/generateInterface";

export type { AutoGenerateArticleInput, AutoGenerateArticleOutput, ArticleOutlineSection } from "@/lib/ai/capabilities/autoGenerateArticle";
export type { GenerateBlockInput };
export type { GenerateFAQInput, GenerateFAQOutput, FAQItem };
export type { GenerateInterfaceInput, UILayoutSpecification, SectionSpec };

/** Genererer artikkel: outline + blokker (hero, richText-seksjoner, CTA). */
export function generateArticle(input: AutoGenerateArticleInput): AutoGenerateArticleOutput {
  return autoGenerateArticle(input);
}

/** Genererer én blokk (hero, richText, cta, image, divider, form). */
export function generateBlocks(input: GenerateBlockInput): BlockNode {
  return generateBlock(input);
}

/** Genererer flere blokker fra en liste av (blockType, context, tone). */
export function generateBlocksBatch(
  items: Array<Pick<GenerateBlockInput, "blockType" | "context" | "tone">>,
  options?: Pick<GenerateBlockInput, "locale">
): BlockNode[] {
  return items.map((item) =>
    generateBlock({
      ...item,
      locale: options?.locale,
    })
  );
}

/** Genererer FAQ: q/a-liste + schema.org FAQPage. */
export function generateFaq(input: GenerateFAQInput): GenerateFAQOutput {
  return generateFAQ(input);
}

/** Genererer seksjoner (layout-spesifikasjon) fra sideformål og publikum. */
export function generateSections(input: GenerateInterfaceInput): UILayoutSpecification {
  return generateInterface(input);
}

/** Input for meta-generering (SEO + intent). */
export type GenerateMetaInput = {
  title?: string | null;
  description?: string | null;
  canonical?: string | null;
  noIndex?: boolean | null;
  noFollow?: boolean | null;
  ogImage?: string | null;
  intent?: string | null;
  audience?: string | null;
  primaryKeyword?: string | null;
  secondaryKeywords?: string[] | null;
  contentGoals?: string[] | null;
  brandTone?: string | null;
};

/** Generert meta (body.meta-kompatibel: seo + intent). */
export type GeneratedMeta = {
  seo: PageAiSeo;
  intent: PageAiIntent;
};

function safeStr(v: unknown): string | undefined {
  if (v == null) return undefined;
  const s = typeof v === "string" ? v.trim() : String(v).trim();
  return s || undefined;
}

/** Genererer meta-objekt (SEO + intent) for side/variant. */
export function generateMeta(input: GenerateMetaInput = {}): GeneratedMeta {
  const seo: PageAiSeo = {};
  const title = safeStr(input.title);
  const description = safeStr(input.description);
  const canonical = safeStr(input.canonical);
  const ogImage = safeStr(input.ogImage);
  if (title !== undefined) seo.title = title;
  if (description !== undefined) seo.description = description;
  if (canonical !== undefined) seo.canonical = canonical;
  if (input.noIndex === true) seo.noIndex = true;
  if (input.noFollow === true) seo.noFollow = true;
  if (ogImage !== undefined) seo.ogImage = ogImage;

  const intent: PageAiIntent = {};
  const intentVal = safeStr(input.intent);
  const audience = safeStr(input.audience);
  const primaryKeyword = safeStr(input.primaryKeyword);
  const secondaryKeywords = Array.isArray(input.secondaryKeywords)
    ? (input.secondaryKeywords as unknown[]).filter((k) => typeof k === "string").map((k) => String(k).trim())
    : undefined;
  const contentGoals = Array.isArray(input.contentGoals)
    ? (input.contentGoals as unknown[]).filter((g) => typeof g === "string").map((g) => String(g).trim())
    : undefined;
  const brandTone = safeStr(input.brandTone);
  if (intentVal !== undefined) intent.intent = intentVal;
  if (audience !== undefined) intent.audience = audience;
  if (primaryKeyword !== undefined) intent.primaryKeyword = primaryKeyword;
  if (secondaryKeywords !== undefined && secondaryKeywords.length > 0) intent.secondaryKeywords = secondaryKeywords;
  if (contentGoals !== undefined && contentGoals.length > 0) intent.contentGoals = contentGoals;
  if (brandTone !== undefined) intent.brandTone = brandTone;

  return { seo, intent };
}

/** Type for dispatch: hva som skal genereres. */
export type ContentGenerateKind = "article" | "sections" | "blocks" | "faq" | "meta";

export type GenerateContentInput =
  | { kind: "article"; input: AutoGenerateArticleInput }
  | { kind: "sections"; input: GenerateInterfaceInput }
  | { kind: "blocks"; input: GenerateBlockInput }
  | { kind: "blocks_batch"; items: Array<Pick<GenerateBlockInput, "blockType" | "context" | "tone">>; locale?: "nb" | "en" }
  | { kind: "faq"; input: GenerateFAQInput }
  | { kind: "meta"; input: GenerateMetaInput };

export type GenerateContentResult =
  | { kind: "article"; data: AutoGenerateArticleOutput }
  | { kind: "sections"; data: UILayoutSpecification }
  | { kind: "blocks"; data: BlockNode }
  | { kind: "blocks_batch"; data: BlockNode[] }
  | { kind: "faq"; data: GenerateFAQOutput }
  | { kind: "meta"; data: GeneratedMeta };

/**
 * Samlet dispatch: generer artikler, seksjoner, blokker, FAQ eller meta.
 */
export function generateContent(req: GenerateContentInput): GenerateContentResult {
  switch (req.kind) {
    case "article":
      return { kind: "article", data: generateArticle(req.input) };
    case "sections":
      return { kind: "sections", data: generateSections(req.input) };
    case "blocks":
      return { kind: "blocks", data: generateBlocks(req.input) };
    case "blocks_batch":
      return {
        kind: "blocks_batch",
        data: generateBlocksBatch(req.items, req.locale ? { locale: req.locale } : undefined),
      };
    case "faq":
      return { kind: "faq", data: generateFaq(req.input) };
    case "meta":
      return { kind: "meta", data: generateMeta(req.input) };
    default:
      throw new Error(`Unknown generate kind: ${(req as GenerateContentInput).kind}`);
  }
}
