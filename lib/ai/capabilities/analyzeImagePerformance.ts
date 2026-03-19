/**
 * AI image performance analyzer capability: analyzeImagePerformance.
 * Analyzes image performance from metadata: dimensions vs display size, file size, format, lazy loading, srcset.
 * Returns a performance score, issues, and recommendations. Deterministic; no LLM.
 */

import type { Capability } from "../capabilityRegistry";
import { registerCapability } from "../capabilityRegistry";

const CAPABILITY_NAME = "analyzeImagePerformance";

const analyzeImagePerformanceCapability: Capability = {
  name: CAPABILITY_NAME,
  description:
    "Analyzes image performance from metadata: oversized images, file size, format (webp preferred), lazy loading, and srcset. Returns a 0–100 performance score, issues, and recommendations.",
  requiredContext: ["images"],
  inputSchema: {
    type: "object",
    description: "Analyze image performance input",
    properties: {
      images: {
        type: "array",
        description: "Image descriptors: id?, width?, height?, fileSizeBytes?, format?, displayWidth?, lazyLoaded?, hasSrcset?, aboveFold?",
        items: { type: "object" },
      },
      maxFileSizeKb: { type: "number", description: "Max recommended file size per image (default 200)" },
      locale: { type: "string", description: "Locale (nb | en)" },
    },
    required: ["images"],
  },
  outputSchema: {
    type: "object",
    description: "Image performance analysis",
    required: ["performanceScore", "issues", "recommendations", "metrics", "summary"],
    properties: {
      performanceScore: { type: "number", description: "0-100" },
      issues: {
        type: "array",
        items: {
          type: "object",
          required: ["type", "message", "imageIds"],
          properties: {
            type: { type: "string", description: "oversized | heavy_file | suboptimal_format | no_lazy | no_srcset | missing_dimensions" },
            message: { type: "string" },
            imageIds: { type: "array", items: { type: "string" } },
            severity: { type: "string", description: "low | medium | high" },
          },
        },
      },
      recommendations: { type: "array", items: { type: "string" } },
      metrics: {
        type: "object",
        properties: {
          totalImages: { type: "number" },
          totalBytes: { type: "number" },
          imagesWithIssues: { type: "number" },
          aboveFoldCount: { type: "number" },
        },
      },
      summary: { type: "string" },
    },
  },
  safetyConstraints: [
    { code: "read_only", description: "Output is analysis only; no content or system mutation.", enforce: "hard" },
  ],
  targetSurfaces: ["backoffice", "editor", "api"],
};

registerCapability(analyzeImagePerformanceCapability);

export type ImagePerformanceDescriptor = {
  id?: string | null;
  width?: number | null;
  height?: number | null;
  fileSizeBytes?: number | null;
  format?: string | null;
  displayWidth?: number | null;
  lazyLoaded?: boolean | null;
  hasSrcset?: boolean | null;
  aboveFold?: boolean | null;
};

export type AnalyzeImagePerformanceInput = {
  images: ImagePerformanceDescriptor[] | null | undefined;
  maxFileSizeKb?: number | null;
  locale?: "nb" | "en" | null;
};

export type ImagePerformanceIssue = {
  type: "oversized" | "heavy_file" | "suboptimal_format" | "no_lazy" | "no_srcset" | "missing_dimensions";
  message: string;
  imageIds: string[];
  severity: "low" | "medium" | "high";
};

export type AnalyzeImagePerformanceOutput = {
  performanceScore: number;
  issues: ImagePerformanceIssue[];
  recommendations: string[];
  metrics: {
    totalImages: number;
    totalBytes: number;
    imagesWithIssues: number;
    aboveFoldCount: number;
  };
  summary: string;
};

const MAX_DISPLAY_WIDTH = 1920;
const OVERSIZED_FACTOR = 1.5;
const MODERN_FORMATS = new Set(["webp", "avif"]);

function clamp(v: number): number {
  return Math.max(0, Math.min(100, Math.round(v)));
}

/**
 * Analyzes image performance from descriptors. Deterministic; no external calls.
 */
export function analyzeImagePerformance(input: AnalyzeImagePerformanceInput): AnalyzeImagePerformanceOutput {
  const isEn = input.locale === "en";
  const images = Array.isArray(input.images) ? input.images : [];
  const maxFileSizeBytes = Math.max(1, Math.floor(Number(input.maxFileSizeKb) ?? 200) * 1024);

  const issues: ImagePerformanceIssue[] = [];
  const recommendations: string[] = [];
  const imageIdsWithIssues = new Set<string>();
  let totalBytes = 0;
  let aboveFoldCount = 0;

  for (const img of images) {
    const id = (img.id ?? "").toString().trim() || `img-${images.indexOf(img)}`;
    const width = typeof img.width === "number" && img.width > 0 ? img.width : null;
    const height = typeof img.height === "number" && img.height > 0 ? img.height : null;
    const fileSize = typeof img.fileSizeBytes === "number" && img.fileSizeBytes >= 0 ? img.fileSizeBytes : null;
    const format = (img.format ?? "").toString().trim().toLowerCase() || null;
    const displayWidth = typeof img.displayWidth === "number" && img.displayWidth > 0 ? img.displayWidth : null;
    const lazyLoaded = img.lazyLoaded === true;
    const hasSrcset = img.hasSrcset === true;
    const aboveFold = img.aboveFold === true;

    if (aboveFold) aboveFoldCount++;
    if (fileSize != null) totalBytes += fileSize;

    if (width == null && height == null) {
      imageIdsWithIssues.add(id);
      const existing = issues.find((i) => i.type === "missing_dimensions");
      if (existing) existing.imageIds.push(id);
      else
        issues.push({
          type: "missing_dimensions",
          message: isEn ? "Image missing width/height; add dimensions to reduce layout shift (CLS)." : "Bilde mangler bredde/høyde; legg til dimensjoner for å redusere layout shift (CLS).",
          imageIds: [id],
          severity: "high",
        });
    }

    if (displayWidth != null && width != null && width > displayWidth * OVERSIZED_FACTOR) {
      imageIdsWithIssues.add(id);
      const existing = issues.find((i) => i.type === "oversized");
      if (existing) existing.imageIds.push(id);
      else
        issues.push({
          type: "oversized",
          message: isEn
            ? `Image width (${width}px) exceeds display by >${Math.round(OVERSIZED_FACTOR * 100)}%; serve appropriately sized source or srcset.`
            : `Bildebredde (${width}px) overstiger visning med >${Math.round(OVERSIZED_FACTOR * 100)}%; server riktig størrelse eller srcset.`,
          imageIds: [id],
          severity: "medium",
        });
    }

    if (fileSize != null && fileSize > maxFileSizeBytes) {
      imageIdsWithIssues.add(id);
      const kb = Math.round(fileSize / 1024);
      const existing = issues.find((i) => i.type === "heavy_file");
      if (existing) existing.imageIds.push(id);
      else
        issues.push({
          type: "heavy_file",
          message: isEn
            ? `Image(s) exceed ${Math.round(maxFileSizeBytes / 1024)} KB. Compress or use modern format (e.g. WebP).`
            : `Bilde(r) overstiger ${Math.round(maxFileSizeBytes / 1024)} KB. Komprimer eller bruk moderne format (f.eks. WebP).`,
          imageIds: [id],
          severity: "high",
        });
    }

    if (format && !MODERN_FORMATS.has(format) && (fileSize == null || fileSize > 50000)) {
      imageIdsWithIssues.add(id);
      const existing = issues.find((i) => i.type === "suboptimal_format");
      if (existing) existing.imageIds.push(id);
      else
        issues.push({
          type: "suboptimal_format",
          message: isEn ? "Prefer WebP or AVIF for better compression at same quality." : "Foretrekk WebP eller AVIF for bedre komprimering ved samme kvalitet.",
          imageIds: [id],
          severity: "medium",
        });
    }

    if (!aboveFold && !lazyLoaded) {
      imageIdsWithIssues.add(id);
      const existing = issues.find((i) => i.type === "no_lazy");
      if (existing) existing.imageIds.push(id);
      else
        issues.push({
          type: "no_lazy",
          message: isEn ? "Below-fold images should use lazy loading (loading=\"lazy\")." : "Bilder under brettet bør bruke lazy loading (loading=\"lazy\").",
          imageIds: [id],
          severity: "medium",
        });
    }

    if (width != null && width > 400 && !hasSrcset) {
      imageIdsWithIssues.add(id);
      const existing = issues.find((i) => i.type === "no_srcset");
      if (existing) existing.imageIds.push(id);
      else
        issues.push({
          type: "no_srcset",
          message: isEn ? "Large images should provide srcset for responsive delivery." : "Store bilder bør ha srcset for responsiv levering.",
          imageIds: [id],
          severity: "low",
        });
    }
  }

  const totalImages = images.length;
  const imagesWithIssues = imageIdsWithIssues.size;
  const issuePenalty = issues.length * 12 + imagesWithIssues * 5;
  const performanceScore = clamp(totalImages === 0 ? 100 : Math.max(0, 100 - issuePenalty));

  if (issues.length > 0) {
    if (issues.some((i) => i.type === "heavy_file" || i.type === "oversized"))
      recommendations.push(isEn ? "Resize and compress images to match display and size budget." : "Skaler og komprimer bilder til visning og størrelsesbudsjett.");
    if (issues.some((i) => i.type === "suboptimal_format"))
      recommendations.push(isEn ? "Serve WebP (with JPEG/PNG fallback) where supported." : "Server WebP (med JPEG/PNG-fallback) der støttet.");
    if (issues.some((i) => i.type === "no_lazy"))
      recommendations.push(isEn ? "Add loading=\"lazy\" to below-the-fold images." : "Legg til loading=\"lazy\" på bilder under brettet.");
    if (issues.some((i) => i.type === "no_srcset"))
      recommendations.push(isEn ? "Add srcset for large images to serve appropriate size per device." : "Legg til srcset for store bilder for riktig størrelse per enhet.");
    if (issues.some((i) => i.type === "missing_dimensions"))
      recommendations.push(isEn ? "Set width and height attributes to avoid layout shift (CLS)." : "Sett width- og height-attributter for å unngå layout shift (CLS).");
  }
  if (recommendations.length === 0 && totalImages > 0) {
    recommendations.push(isEn ? "Image performance is within recommended range." : "Bildeytelsen er innenfor anbefalt område.");
  }

  const summary = isEn
    ? `Image performance: ${performanceScore}/100. ${totalImages} image(s), ${issues.length} issue type(s), ${imagesWithIssues} image(s) affected.`
    : `Bildeytelse: ${performanceScore}/100. ${totalImages} bilde(r), ${issues.length} problemtype(r), ${imagesWithIssues} bilde(r) berørt.`;

  return {
    performanceScore,
    issues,
    recommendations: [...new Set(recommendations)],
    metrics: {
      totalImages,
      totalBytes,
      imagesWithIssues,
      aboveFoldCount,
    },
    summary,
  };
}

export { analyzeImagePerformanceCapability, CAPABILITY_NAME };
