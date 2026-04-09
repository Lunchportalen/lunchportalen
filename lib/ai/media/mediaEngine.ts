// STATUS: KEEP

/**
 * AI MEDIA ENGINE
 * Håndterer: bilder, video, alt-tekst, visuell konsistens.
 * Samler generateAltText, generateImagePrompt, generateHeroVisual, generateThumbnail,
 * optimizeThumbnail, generateVideoStoryboard, checkVisualConsistency, checkImageStyleConsistency.
 * Kun generering/sjekk; ingen mutasjon.
 */

import { generateAltText } from "@/lib/ai/engines/capabilities/generateAltText";
import type {
  GenerateAltTextInput,
  GenerateAltTextOutput,
  ImageMetadataInput,
} from "@/lib/ai/engines/capabilities/generateAltText";
import { generateImagePrompt } from "@/lib/ai/engines/capabilities/generateImagePrompt";
import type {
  GenerateImagePromptInput,
  GenerateImagePromptOutput,
} from "@/lib/ai/engines/capabilities/generateImagePrompt";
import { generateHeroVisual } from "@/lib/ai/engines/capabilities/generateHeroVisual";
import type {
  GenerateHeroVisualInput,
  GenerateHeroVisualOutput,
} from "@/lib/ai/engines/capabilities/generateHeroVisual";
import { generateThumbnail } from "@/lib/ai/engines/capabilities/generateThumbnail";
import type {
  GenerateThumbnailInput,
  GenerateThumbnailOutput,
} from "@/lib/ai/engines/capabilities/generateThumbnail";
import { optimizeThumbnail } from "@/lib/ai/engines/capabilities/optimizeThumbnail";
import type {
  OptimizeThumbnailInput,
  OptimizeThumbnailOutput,
} from "@/lib/ai/engines/capabilities/optimizeThumbnail";
import { generateVideoStoryboard } from "@/lib/ai/engines/capabilities/generateVideoStoryboard";
import type {
  GenerateVideoStoryboardInput,
  GenerateVideoStoryboardOutput,
} from "@/lib/ai/engines/capabilities/generateVideoStoryboard";
import { checkVisualConsistency } from "@/lib/ai/engines/capabilities/checkVisualConsistency";
import type {
  CheckVisualConsistencyInput,
  CheckVisualConsistencyOutput,
  ImageDescriptor,
} from "@/lib/ai/engines/capabilities/checkVisualConsistency";
import { checkImageStyleConsistency } from "@/lib/ai/engines/capabilities/checkImageStyleConsistency";
import type {
  CheckImageStyleConsistencyInput,
  CheckImageStyleConsistencyOutput,
  ImageStyleDescriptor,
} from "@/lib/ai/engines/capabilities/checkImageStyleConsistency";

export type { ImageMetadataInput, ImageDescriptor, ImageStyleDescriptor };

/** Genererer alt-tekst fra bildemetadata. */
export function generateAltTextForImage(input: GenerateAltTextInput): GenerateAltTextOutput {
  return generateAltText(input);
}

/** Genererer bilde-prompt fra subject, style, mood, aspect ratio. */
export function generateImagePrompts(input: GenerateImagePromptInput): GenerateImagePromptOutput {
  return generateImagePrompt(input);
}

/** Genererer hero-visual prompt og spec (layout, dimensjoner, negative prompt). */
export function generateHeroVisualSpec(input: GenerateHeroVisualInput): GenerateHeroVisualOutput {
  return generateHeroVisual(input);
}

/** Genererer thumbnail-prompt og spec (card, list, social, og, avatar). */
export function generateThumbnailSpec(input: GenerateThumbnailInput): GenerateThumbnailOutput {
  return generateThumbnail(input);
}

/** Optimaliserer thumbnail (dimensjoner, crop, format, filstørrelse) etter kontekst. */
export function optimizeThumbnailSpec(input: OptimizeThumbnailInput): OptimizeThumbnailOutput {
  return optimizeThumbnail(input);
}

/** Genererer video-storyboard (scener, varighet, shot type, copy). */
export function generateVideoStoryboardSpec(input: GenerateVideoStoryboardInput): GenerateVideoStoryboardOutput {
  return generateVideoStoryboard(input);
}

/** Sjekker visuell konsistens på tvers av bilder (stil, aspekt, formål). */
export function checkVisualConsistencyAcrossImages(input: CheckVisualConsistencyInput): CheckVisualConsistencyOutput {
  return checkVisualConsistency(input);
}

/** Sjekker bilde-stilkonsistens: score, dominant stil, anbefalinger. */
export function checkImageStyleConsistencyAcrossImages(
  input: CheckImageStyleConsistencyInput
): CheckImageStyleConsistencyOutput {
  return checkImageStyleConsistency(input);
}

/** Type for dispatch. */
export type MediaEngineKind =
  | "alt_text"
  | "image_prompt"
  | "hero_visual"
  | "thumbnail"
  | "optimize_thumbnail"
  | "video_storyboard"
  | "visual_consistency"
  | "image_style_consistency";

export type MediaEngineInput =
  | { kind: "alt_text"; input: GenerateAltTextInput }
  | { kind: "image_prompt"; input: GenerateImagePromptInput }
  | { kind: "hero_visual"; input: GenerateHeroVisualInput }
  | { kind: "thumbnail"; input: GenerateThumbnailInput }
  | { kind: "optimize_thumbnail"; input: OptimizeThumbnailInput }
  | { kind: "video_storyboard"; input: GenerateVideoStoryboardInput }
  | { kind: "visual_consistency"; input: CheckVisualConsistencyInput }
  | { kind: "image_style_consistency"; input: CheckImageStyleConsistencyInput };

export type MediaEngineResult =
  | { kind: "alt_text"; data: GenerateAltTextOutput }
  | { kind: "image_prompt"; data: GenerateImagePromptOutput }
  | { kind: "hero_visual"; data: GenerateHeroVisualOutput }
  | { kind: "thumbnail"; data: GenerateThumbnailOutput }
  | { kind: "optimize_thumbnail"; data: OptimizeThumbnailOutput }
  | { kind: "video_storyboard"; data: GenerateVideoStoryboardOutput }
  | { kind: "visual_consistency"; data: CheckVisualConsistencyOutput }
  | { kind: "image_style_consistency"; data: CheckImageStyleConsistencyOutput };

/**
 * Samlet dispatch: bilder, video, alt-tekst, visuell konsistens.
 */
export function runMediaEngine(req: MediaEngineInput): MediaEngineResult {
  switch (req.kind) {
    case "alt_text":
      return { kind: "alt_text", data: generateAltTextForImage(req.input) };
    case "image_prompt":
      return { kind: "image_prompt", data: generateImagePrompts(req.input) };
    case "hero_visual":
      return { kind: "hero_visual", data: generateHeroVisualSpec(req.input) };
    case "thumbnail":
      return { kind: "thumbnail", data: generateThumbnailSpec(req.input) };
    case "optimize_thumbnail":
      return { kind: "optimize_thumbnail", data: optimizeThumbnailSpec(req.input) };
    case "video_storyboard":
      return { kind: "video_storyboard", data: generateVideoStoryboardSpec(req.input) };
    case "visual_consistency":
      return { kind: "visual_consistency", data: checkVisualConsistencyAcrossImages(req.input) };
    case "image_style_consistency":
      return { kind: "image_style_consistency", data: checkImageStyleConsistencyAcrossImages(req.input) };
    default:
      throw new Error(`Unknown media engine kind: ${(req as MediaEngineInput).kind}`);
  }
}
