// STATUS: KEEP

/**
 * AI BLOCK ENGINE
 * Genererer og optimaliserer: CMS-blokker, komponenter.
 * Samler generateBlock, optimizeBlockForConversion, suggestComponents, generateUIComponents.
 * Kun generering/optimalisering; ingen mutasjon uten at kalleren bruker output.
 */

import type { BlockNode } from "@/lib/cms/model/blockTypes";
import { generateBlock } from "@/lib/ai/engines/capabilities/generateBlock";
import type { GenerateBlockInput } from "@/lib/ai/engines/capabilities/generateBlock";
import { optimizeBlockForConversion } from "@/lib/ai/engines/capabilities/optimizeBlockForConversion";
import type {
  OptimizeBlockForConversionInput,
  OptimizeBlockForConversionOutput,
  OptimizeBlockForConversionBlockInput,
} from "@/lib/ai/engines/capabilities/optimizeBlockForConversion";
import { suggestComponents } from "@/lib/ai/engines/capabilities/suggestComponents";
import type {
  SuggestComponentsInput,
  SuggestComponentsOutput,
  ComponentSuggestion,
} from "@/lib/ai/engines/capabilities/suggestComponents";
import { generateUIComponents } from "@/lib/ai/engines/capabilities/generateUIComponents";
import type {
  GenerateUIComponentsInput,
  GenerateUIComponentsOutput,
  GeneratedUIComponent,
} from "@/lib/ai/engines/capabilities/generateUIComponents";

export type { GenerateBlockInput, OptimizeBlockForConversionBlockInput, ComponentSuggestion, GeneratedUIComponent };

/** Genererer én CMS-blokk (hero, richText, cta, image, divider, form). */
export function generateBlocks(input: GenerateBlockInput): BlockNode {
  return generateBlock(input);
}

/** Genererer flere CMS-blokker fra en liste av (blockType, context, tone). */
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

/** Optimaliserer én blokk for konvertering (score, forslag, valgfri optimizedData). */
export function optimizeBlock(input: OptimizeBlockForConversionInput): OptimizeBlockForConversionOutput {
  return optimizeBlockForConversion(input);
}

/** Optimaliserer flere blokker for konvertering. */
export function optimizeBlocksBatch(
  blocks: OptimizeBlockForConversionBlockInput[],
  options?: Pick<OptimizeBlockForConversionInput, "conversionGoal" | "locale">
): OptimizeBlockForConversionOutput[] {
  return blocks.map((block) =>
    optimizeBlockForConversion({
      block,
      conversionGoal: options?.conversionGoal ?? undefined,
      locale: options?.locale ?? undefined,
    })
  );
}

/** Foreslår komponenter etter kontekst (sideformål eller seksjonstype). */
export function suggestComponentsByContext(input: SuggestComponentsInput): SuggestComponentsOutput {
  return suggestComponents(input);
}

/** Genererer komponent-spesifikasjoner (props, variants, a11y) fra typenavn eller seksjonshints. */
export function generateComponentSpecs(input: GenerateUIComponentsInput): GenerateUIComponentsOutput {
  return generateUIComponents(input);
}

/** Type for dispatch: generer blokk(er), optimaliser blokk(er), foreslå komponenter, generer komponent-spes. */
export type BlockEngineKind = "generate_block" | "generate_blocks_batch" | "optimize_block" | "optimize_blocks_batch" | "suggest_components" | "generate_component_specs";

export type BlockEngineInput =
  | { kind: "generate_block"; input: GenerateBlockInput }
  | {
      kind: "generate_blocks_batch";
      items: Array<Pick<GenerateBlockInput, "blockType" | "context" | "tone">>;
      locale?: "nb" | "en" | null;
    }
  | { kind: "optimize_block"; input: OptimizeBlockForConversionInput }
  | {
      kind: "optimize_blocks_batch";
      blocks: OptimizeBlockForConversionBlockInput[];
      conversionGoal?: string | null;
      locale?: "nb" | "en" | null;
    }
  | { kind: "suggest_components"; input: SuggestComponentsInput }
  | { kind: "generate_component_specs"; input: GenerateUIComponentsInput };

export type BlockEngineResult =
  | { kind: "generate_block"; data: BlockNode }
  | { kind: "generate_blocks_batch"; data: BlockNode[] }
  | { kind: "optimize_block"; data: OptimizeBlockForConversionOutput }
  | { kind: "optimize_blocks_batch"; data: OptimizeBlockForConversionOutput[] }
  | { kind: "suggest_components"; data: SuggestComponentsOutput }
  | { kind: "generate_component_specs"; data: GenerateUIComponentsOutput };

/**
 * Samlet dispatch: generer eller optimaliser CMS-blokker, foreslå eller generer komponenter.
 */
export function runBlockEngine(req: BlockEngineInput): BlockEngineResult {
  switch (req.kind) {
    case "generate_block":
      return { kind: "generate_block", data: generateBlocks(req.input) };
    case "generate_blocks_batch":
      return {
        kind: "generate_blocks_batch",
        data: generateBlocksBatch(req.items, req.locale ? { locale: req.locale } : undefined),
      };
    case "optimize_block":
      return { kind: "optimize_block", data: optimizeBlock(req.input) };
    case "optimize_blocks_batch":
      return {
        kind: "optimize_blocks_batch",
        data: optimizeBlocksBatch(req.blocks, {
          conversionGoal: req.conversionGoal ?? undefined,
          locale: req.locale ?? undefined,
        }),
      };
    case "suggest_components":
      return { kind: "suggest_components", data: suggestComponentsByContext(req.input) };
    case "generate_component_specs":
      return { kind: "generate_component_specs", data: generateComponentSpecs(req.input) };
    default:
      throw new Error(`Unknown block engine kind: ${(req as BlockEngineInput).kind}`);
  }
}
