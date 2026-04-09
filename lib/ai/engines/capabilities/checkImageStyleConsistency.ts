/**
 * AI image consistency capability: checkImageStyleConsistency.
 * Checks image style consistency across a set of images: style (photography, illustration, minimal),
 * aspect ratio band, and optional tone. Returns consistency score, dominant style suggestion, and issues.
 * Deterministic; no LLM. Import this module to register the capability.
 */

import type { Capability } from "../../capabilityRegistry";
import { registerCapability } from "../../capabilityRegistry";

const CAPABILITY_NAME = "checkImageStyleConsistency";

const checkImageStyleConsistencyCapability: Capability = {
  name: CAPABILITY_NAME,
  description:
    "Checks image style consistency across images. Evaluates style (photography vs illustration vs minimal), aspect ratio consistency, and recommends a dominant style. Returns a 0–100 consistency score, issues, and recommendations.",
  requiredContext: ["images"],
  inputSchema: {
    type: "object",
    description: "Check image style consistency input",
    properties: {
      images: {
        type: "array",
        description: "Image descriptors: id?, style?, purpose?, aspectRatio?, width?, height?",
        items: { type: "object" },
      },
      locale: { type: "string", description: "Locale (nb | en)" },
    },
    required: ["images"],
  },
  outputSchema: {
    type: "object",
    description: "Image style consistency result",
    required: ["consistent", "styleScore", "dominantStyle", "issues", "recommendations", "summary"],
    properties: {
      consistent: { type: "boolean", description: "True if style and aspect are consistent" },
      styleScore: { type: "number", description: "0-100 consistency score" },
      dominantStyle: { type: "string", description: "Suggested dominant style when mixed" },
      issues: {
        type: "array",
        items: { type: "object", properties: { type: { type: "string" }, message: { type: "string" }, imageIds: { type: "array", items: { type: "string" } } } },
      },
      recommendations: { type: "array", items: { type: "string" } },
      summary: { type: "string" },
    },
  },
  safetyConstraints: [
    { code: "read_only", description: "Check only; no content or system mutation.", enforce: "hard" },
  ],
  targetSurfaces: ["backoffice", "editor", "api"],
};

registerCapability(checkImageStyleConsistencyCapability);

export type ImageStyleDescriptor = {
  id?: string | null;
  style?: string | null;
  purpose?: string | null;
  aspectRatio?: number | string | null;
  width?: number | null;
  height?: number | null;
};

export type CheckImageStyleConsistencyInput = {
  images: ImageStyleDescriptor[] | null | undefined;
  locale?: "nb" | "en" | null;
};

export type StyleConsistencyIssue = {
  type: "mixed_style" | "aspect_variance" | "missing_style";
  message: string;
  imageIds?: string[];
};

export type CheckImageStyleConsistencyOutput = {
  consistent: boolean;
  styleScore: number;
  dominantStyle: string;
  issues: StyleConsistencyIssue[];
  recommendations: string[];
  summary: string;
};

const STYLE_ALIASES: Record<string, string> = {
  photo: "photography",
  photograph: "photography",
  real: "photography",
  photography: "photography",
  illustration: "illustration",
  illustrasjon: "illustration",
  draw: "illustration",
  minimal: "minimal",
  minimalist: "minimal",
  flat: "minimal",
  icon: "minimal",
};

const ASPECT_RATIO_TOLERANCE = 0.3;

function normalizeStyle(s: unknown): string | null {
  if (s == null || typeof s !== "string") return null;
  const t = s.trim().toLowerCase();
  if (!t) return null;
  return STYLE_ALIASES[t] ?? t;
}

function getAspectRatio(img: ImageStyleDescriptor): number | null {
  const ar = img.aspectRatio;
  if (typeof ar === "number" && ar > 0 && !Number.isNaN(ar)) return ar;
  if (ar === "square" || ar === "1:1") return 1;
  const w = typeof img.width === "number" && img.width > 0 ? img.width : null;
  const h = typeof img.height === "number" && img.height > 0 ? img.height : null;
  if (w && h) return w / h;
  return null;
}

/**
 * Checks image style consistency: style uniformity and aspect ratio band. Returns score, dominant style, issues, and recommendations.
 * Deterministic; no external calls.
 */
export function checkImageStyleConsistency(
  input: CheckImageStyleConsistencyInput
): CheckImageStyleConsistencyOutput {
  const isEn = input.locale === "en";
  const images = Array.isArray(input.images) ? input.images : [];

  const issues: StyleConsistencyIssue[] = [];
  const recommendations: string[] = [];

  if (images.length === 0) {
    return {
      consistent: true,
      styleScore: 100,
      dominantStyle: "photography",
      issues: [],
      recommendations: [],
      summary: isEn ? "No images to check." : "Ingen bilder å sjekke.",
    };
  }

  if (images.length === 1) {
    const style = normalizeStyle(images[0].style) || "photography";
    return {
      consistent: true,
      styleScore: 100,
      dominantStyle: style,
      issues: [],
      recommendations: [],
      summary: isEn ? "Single image; consistency N/A." : "Ett bilde; konsistens N/A.",
    };
  }

  const styleCounts: Record<string, number> = {};
  const ratios: number[] = [];
  const imagesByStyle: Record<string, string[]> = {};

  for (const img of images) {
    const style = normalizeStyle(img.style);
    const key = style || "unknown";
    styleCounts[key] = (styleCounts[key] ?? 0) + 1;
    if (!imagesByStyle[key]) imagesByStyle[key] = [];
    const id = (img.id ?? "").toString().trim() || `img-${images.indexOf(img)}`;
    imagesByStyle[key].push(id);
    const ratio = getAspectRatio(img);
    if (ratio != null) ratios.push(ratio);
  }

  const styleKeys = Object.keys(styleCounts).filter((k) => k !== "unknown");
  const hasUnknown = styleCounts["unknown"] > 0;
  const mixedStyles = styleKeys.length > 1;

  if (hasUnknown) {
    issues.push({
      type: "missing_style",
      message: isEn
        ? `${styleCounts["unknown"]} image(s) have no style set. Set style (photography, illustration, or minimal) for consistency.`
        : `${styleCounts["unknown"]} bilde(r) mangler stil. Sett stil (fotografi, illustrasjon eller minimal) for konsistens.`,
    });
    recommendations.push(isEn ? "Add style metadata to all images." : "Legg til stil-metadata på alle bilder.");
  }

  if (mixedStyles) {
    const list = styleKeys.join(", ");
    const dominant = styleKeys.reduce((a, b) => (styleCounts[a] >= styleCounts[b] ? a : b));
    issues.push({
      type: "mixed_style",
      message: isEn
        ? `Mixed styles: ${list}. Dominant: ${dominant}. Consider using one style for visual coherence.`
        : `Blandede stiler: ${list}. Dominerende: ${dominant}. Vurder én stil for visuell sammenheng.`,
      imageIds: styleKeys.flatMap((k) => imagesByStyle[k] ?? []),
    });
    recommendations.push(
      isEn ? `Standardize on "${dominant}" or replace outliers.` : `Standardiser på «${dominant}» eller bytt ut avvikere.`
    );
  }

  let aspectIssue = false;
  if (ratios.length >= 2) {
    const min = Math.min(...ratios);
    const max = Math.max(...ratios);
    const spread = max - min;
    if (min > 0 && spread > ASPECT_RATIO_TOLERANCE * min) {
      aspectIssue = true;
      issues.push({
        type: "aspect_variance",
        message: isEn
          ? "Aspect ratios vary significantly. Use a consistent ratio (e.g. 16:9 or 1:1) for a cohesive look."
          : "Bildeformatene varierer mye. Bruk et konsekvent forhold (f.eks. 16:9 eller 1:1) for et samlet uttrykk.",
      });
      recommendations.push(isEn ? "Crop or use images in the same aspect band." : "Beskjær eller bruk bilder i samme formatbande.");
    }
  }

  const styleScore = mixedStyles
    ? Math.max(0, 60 - styleKeys.length * 20)
    : hasUnknown
      ? Math.max(0, 80 - (styleCounts["unknown"] ?? 0) * 10)
      : 100;
  const aspectScore = aspectIssue ? 50 : 100;
  const totalScore = Math.round((styleScore + aspectScore) / 2);

  const dominantStyle =
    styleKeys.length > 0
      ? styleKeys.reduce((a, b) => (styleCounts[a] >= styleCounts[b] ? a : b))
      : "photography";

  const consistent = issues.length === 0;
  const summary = isEn
    ? `Image style consistency: ${totalScore}/100. ${issues.length} issue(s). ${consistent ? "Styles are consistent." : `Recommendation: use "${dominantStyle}" as dominant style.`}`
    : `Bildestilkonsistens: ${totalScore}/100. ${issues.length} problem(er). ${consistent ? "Stilene er konsistente." : `Anbefaling: bruk «${dominantStyle}» som dominerende stil.`}`;

  return {
    consistent,
    styleScore: totalScore,
    dominantStyle,
    issues,
    recommendations: [...new Set(recommendations)],
    summary,
  };
}

export { checkImageStyleConsistencyCapability, CAPABILITY_NAME };
