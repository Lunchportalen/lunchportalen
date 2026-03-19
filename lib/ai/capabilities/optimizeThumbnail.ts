/**
 * AI thumbnail optimizer capability: optimizeThumbnail.
 * Suggests optimal thumbnail dimensions, aspect ratio, crop strategy, and format by context (card, list, social, og, avatar).
 * Deterministic; no LLM. Import this module to register the capability.
 */

import type { Capability } from "../capabilityRegistry";
import { registerCapability } from "../capabilityRegistry";

const CAPABILITY_NAME = "optimizeThumbnail";

const optimizeThumbnailCapability: Capability = {
  name: CAPABILITY_NAME,
  description:
    "Suggests optimal thumbnail settings by context: dimensions, aspect ratio, crop strategy, format, and max file size. Uses context (card, list, social, og, avatar) and optional source dimensions.",
  requiredContext: ["context"],
  inputSchema: {
    type: "object",
    description: "Optimize thumbnail input",
    properties: {
      context: {
        type: "string",
        description: "card | list | social | og | avatar",
      },
      sourceWidth: { type: "number", description: "Optional source image width" },
      sourceHeight: { type: "number", description: "Optional source image height" },
      currentWidth: { type: "number", description: "Optional current thumbnail width" },
      currentHeight: { type: "number", description: "Optional current thumbnail height" },
      preferFormat: { type: "string", description: "Optional: webp | jpeg | png" },
      locale: { type: "string", description: "Locale (nb | en)" },
    },
    required: ["context"],
  },
  outputSchema: {
    type: "object",
    description: "Thumbnail optimization result",
    required: ["recommended", "suggestions", "summary"],
    properties: {
      recommended: {
        type: "object",
        required: ["width", "height", "aspectRatio", "cropStrategy", "format", "maxFileSizeKb"],
        properties: {
          width: { type: "number" },
          height: { type: "number" },
          aspectRatio: { type: "number", description: "width/height" },
          aspectLabel: { type: "string", description: "e.g. 16:9" },
          cropStrategy: { type: "string", description: "center | cover | contain | face" },
          format: { type: "string", description: "webp | jpeg | png" },
          maxFileSizeKb: { type: "number" },
        },
      },
      suggestions: {
        type: "array",
        items: { type: "string" },
      },
      summary: { type: "string" },
    },
  },
  safetyConstraints: [
    { code: "suggestions_only", description: "Output is recommendations only; no image mutation.", enforce: "hard" },
  ],
  targetSurfaces: ["backoffice", "editor", "api"],
};

registerCapability(optimizeThumbnailCapability);

export type OptimizeThumbnailInput = {
  context: string;
  sourceWidth?: number | null;
  sourceHeight?: number | null;
  currentWidth?: number | null;
  currentHeight?: number | null;
  preferFormat?: string | null;
  locale?: "nb" | "en" | null;
};

export type ThumbnailRecommendation = {
  width: number;
  height: number;
  aspectRatio: number;
  aspectLabel: string;
  cropStrategy: "center" | "cover" | "contain" | "face";
  format: "webp" | "jpeg" | "png";
  maxFileSizeKb: number;
};

export type OptimizeThumbnailOutput = {
  recommended: ThumbnailRecommendation;
  suggestions: string[];
  summary: string;
};

type ContextPreset = {
  width: number;
  height: number;
  aspectLabel: string;
  cropStrategy: ThumbnailRecommendation["cropStrategy"];
  format: ThumbnailRecommendation["format"];
  maxFileSizeKb: number;
};

const CONTEXT_PRESETS: Record<string, ContextPreset> = {
  card: {
    width: 400,
    height: 225,
    aspectLabel: "16:9",
    cropStrategy: "cover",
    format: "webp",
    maxFileSizeKb: 80,
  },
  list: {
    width: 320,
    height: 180,
    aspectLabel: "16:9",
    cropStrategy: "cover",
    format: "webp",
    maxFileSizeKb: 50,
  },
  social: {
    width: 1200,
    height: 630,
    aspectLabel: "1.91:1",
    cropStrategy: "cover",
    format: "webp",
    maxFileSizeKb: 300,
  },
  og: {
    width: 1200,
    height: 630,
    aspectLabel: "1.91:1",
    cropStrategy: "cover",
    format: "jpeg",
    maxFileSizeKb: 300,
  },
  avatar: {
    width: 96,
    height: 96,
    aspectLabel: "1:1",
    cropStrategy: "face",
    format: "webp",
    maxFileSizeKb: 20,
  },
};

function normalizeContext(ctx: string): string {
  const c = (ctx ?? "").trim().toLowerCase();
  if (CONTEXT_PRESETS[c]) return c;
  if (c === "opengraph" || c === "open_graph") return "og";
  return "card";
}

/**
 * Suggests optimal thumbnail dimensions, crop, format, and file size by context. Deterministic; no external calls.
 */
export function optimizeThumbnail(input: OptimizeThumbnailInput): OptimizeThumbnailOutput {
  const isEn = input.locale === "en";
  const context = normalizeContext(input.context ?? "");
  const preset = CONTEXT_PRESETS[context] ?? CONTEXT_PRESETS.card;

  const preferFormat = (input.preferFormat ?? "").trim().toLowerCase();
  const format: ThumbnailRecommendation["format"] =
    preferFormat === "jpeg" || preferFormat === "jpg"
      ? "jpeg"
      : preferFormat === "png"
        ? "png"
        : preset.format;

  const width = preset.width;
  const height = preset.height;
  const aspectRatio = Math.round((width / height) * 100) / 100;

  const suggestions: string[] = [];
  const srcW = typeof input.sourceWidth === "number" && input.sourceWidth > 0 ? input.sourceWidth : null;
  const srcH = typeof input.sourceHeight === "number" && input.sourceHeight > 0 ? input.sourceHeight : null;
  if (srcW != null && srcH != null) {
    if (srcW < width || srcH < height) {
      suggestions.push(
        isEn
          ? `Source is smaller than recommended ${width}×${height}; use for low-DPI only or upscale with care.`
          : `Kilden er mindre enn anbefalt ${width}×${height}; bruk for lav DPI eller skaler opp med forsiktighet.`
      );
    } else {
      suggestions.push(
        isEn
          ? `Resize to ${width}×${height} and use "${preset.cropStrategy}" crop for best result.`
          : `Skaler til ${width}×${height} og bruk «${preset.cropStrategy}»-beskjæring for best resultat.`
      );
    }
  }
  suggestions.push(
    isEn
      ? `Prefer ${format} for smaller size; keep under ${preset.maxFileSizeKb} KB.`
      : `Foretrekk ${format} for mindre filstørrelse; hold under ${preset.maxFileSizeKb} KB.`
  );
  if (preset.cropStrategy === "face" && context === "avatar") {
    suggestions.push(
      isEn ? "Center crop on face when possible for avatars." : "Sentrér beskjæring på ansikt når mulig for avatars."
    );
  }

  const recommended: ThumbnailRecommendation = {
    width,
    height,
    aspectRatio,
    aspectLabel: preset.aspectLabel,
    cropStrategy: preset.cropStrategy,
    format,
    maxFileSizeKb: preset.maxFileSizeKb,
  };

  const summary = isEn
    ? `Thumbnail (${context}): ${width}×${height} (${preset.aspectLabel}), ${preset.cropStrategy} crop, ${format}, ≤${preset.maxFileSizeKb} KB.`
    : `Miniatyr (${context}): ${width}×${height} (${preset.aspectLabel}), ${preset.cropStrategy}-beskjæring, ${format}, ≤${preset.maxFileSizeKb} KB.`;

  return {
    recommended,
    suggestions,
    summary,
  };
}

export { optimizeThumbnailCapability, CAPABILITY_NAME };
