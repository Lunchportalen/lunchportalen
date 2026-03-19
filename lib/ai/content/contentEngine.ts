/**
 * AI CONTENT ENGINE
 * Motoren som genererer: sider, blokker, artikler, FAQ, seksjoner, meta.
 * Dette er selve produksjonsmotoren.
 */

import { generateFullPageBlocks } from "@/lib/ai/capabilities/generateFullPage";
import type {
  GenerateFullPageInput,
  GenerateFullPageOutput,
} from "@/lib/ai/capabilities/generateFullPage";
import { generateBlock } from "@/lib/ai/capabilities/generateBlock";
import type { GenerateBlockInput } from "@/lib/ai/capabilities/generateBlock";
import { autoGenerateArticle } from "@/lib/ai/capabilities/autoGenerateArticle";
import type {
  AutoGenerateArticleInput,
  AutoGenerateArticleOutput,
} from "@/lib/ai/capabilities/autoGenerateArticle";
import { generateFAQ } from "@/lib/ai/capabilities/generateFAQ";
import type {
  GenerateFAQInput,
  GenerateFAQOutput,
  FAQItem,
} from "@/lib/ai/capabilities/generateFAQ";
import { generateInterface } from "@/lib/ai/ui/generateInterface";
import type {
  GenerateInterfaceInput,
  UILayoutSpecification,
  SectionSpec,
} from "@/lib/ai/ui/generateInterface";
import { generateMeta } from "@/lib/ai/capabilities/generateMeta";
import type {
  GenerateMetaInput as CapabilityGenerateMetaInput,
  GenerateMetaOutput,
} from "@/lib/ai/capabilities/generateMeta";
import type { BlockNode } from "@/lib/cms/model/blockTypes";

export type { FAQItem, SectionSpec };

/** Genererer full side: hero, intro, seksjoner, CTA som blokkstruktur. */
export function generatePage(input: GenerateFullPageInput): GenerateFullPageOutput {
  return generateFullPageBlocks(input);
}

/** Genererer én blokk (hero, richText, cta, image, divider, form). */
export function generateBlockContent(input: GenerateBlockInput): BlockNode {
  return generateBlock(input);
}

/** Genererer artikkel: outline + valgfrie blokker for CMS. */
export function generateArticle(input: AutoGenerateArticleInput): AutoGenerateArticleOutput {
  return autoGenerateArticle(input);
}

/** Genererer FAQ: q/a-liste + schema.org FAQPage. */
export function generateFaq(input: GenerateFAQInput = {}): GenerateFAQOutput {
  return generateFAQ(input);
}

/** Genererer seksjoner: layout-spesifikasjon fra sideformål og publikum. */
export function generateSections(input: GenerateInterfaceInput): UILayoutSpecification {
  return generateInterface(input);
}

/** Genererer meta: title, meta description, og:title, og:description. */
export function generateMetaContent(input: CapabilityGenerateMetaInput): GenerateMetaOutput {
  return generateMeta(input);
}

/** Type for dispatch. */
export type ContentEngineKind = "page" | "block" | "article" | "faq" | "sections" | "meta";

export type ContentEngineInput =
  | { kind: "page"; input: GenerateFullPageInput }
  | { kind: "block"; input: GenerateBlockInput }
  | { kind: "article"; input: AutoGenerateArticleInput }
  | { kind: "faq"; input?: GenerateFAQInput }
  | { kind: "sections"; input: GenerateInterfaceInput }
  | { kind: "meta"; input: CapabilityGenerateMetaInput };

export type ContentEngineResult =
  | { kind: "page"; data: GenerateFullPageOutput }
  | { kind: "block"; data: BlockNode }
  | { kind: "article"; data: AutoGenerateArticleOutput }
  | { kind: "faq"; data: GenerateFAQOutput }
  | { kind: "sections"; data: UILayoutSpecification }
  | { kind: "meta"; data: GenerateMetaOutput };

/**
 * Samlet dispatch: sider, blokker, artikler, FAQ, seksjoner, meta.
 */
export function runContentEngine(req: ContentEngineInput): ContentEngineResult {
  switch (req.kind) {
    case "page":
      return { kind: "page", data: generatePage(req.input) };
    case "block":
      return { kind: "block", data: generateBlockContent(req.input) };
    case "article":
      return { kind: "article", data: generateArticle(req.input) };
    case "faq":
      return { kind: "faq", data: generateFaq(req.input) };
    case "sections":
      return { kind: "sections", data: generateSections(req.input) };
    case "meta":
      return { kind: "meta", data: generateMetaContent(req.input) };
    default:
      throw new Error(`Unknown content engine kind: ${(req as ContentEngineInput).kind}`);
  }
}
