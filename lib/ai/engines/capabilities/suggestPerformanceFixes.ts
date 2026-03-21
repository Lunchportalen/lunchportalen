/**
 * AI performance optimizer capability: suggestPerformanceFixes.
 * Suggests performance fixes from page/site signals: Core Web Vitals (LCP, FID, CLS),
 * image metrics, script count, caching. Returns prioritized fixes with category and impact hint.
 * Deterministic; no LLM. Import this module to register the capability.
 */

import type { Capability } from "../capabilityRegistry";
import { registerCapability } from "../capabilityRegistry";

const CAPABILITY_NAME = "suggestPerformanceFixes";

const suggestPerformanceFixesCapability: Capability = {
  name: CAPABILITY_NAME,
  description:
    "AI performance optimizer: suggests performance fixes from page/site signals (LCP, FID, CLS, image metrics, script count, caching). Returns prioritized fixes with category, impact hint, and optional capability. Deterministic; no LLM.",
  requiredContext: [],
  inputSchema: {
    type: "object",
    description: "Suggest performance fixes input",
    properties: {
      signals: {
        type: "object",
        description: "Performance signals (optional)",
        properties: {
          lcpMs: { type: "number", description: "Largest Contentful Paint (ms)" },
          fidMs: { type: "number", description: "First Input Delay (ms)" },
          cls: { type: "number", description: "Cumulative Layout Shift (0-1)" },
          imageCount: { type: "number" },
          totalImageBytes: { type: "number" },
          imagesWithoutDimensions: { type: "number" },
          imagesAboveFold: { type: "number" },
          scriptCount: { type: "number" },
          hasLazyLoad: { type: "boolean" },
          hasSrcset: { type: "boolean" },
          cacheHeadersOk: { type: "boolean", description: "Static assets have cache headers" },
        },
      },
      imagePerformanceScore: { type: "number", description: "Optional 0-100 from analyzeImagePerformance" },
      locale: { type: "string", description: "Locale (nb | en) for messages" },
      maxFixes: { type: "number", description: "Max fixes to return (default 15)" },
    },
    required: [],
  },
  outputSchema: {
    type: "object",
    description: "Performance fix suggestions",
    required: ["fixes", "summary"],
    properties: {
      fixes: {
        type: "array",
        items: {
          type: "object",
          required: ["category", "message", "priority", "impact"],
          properties: {
            category: { type: "string", description: "images | scripts | layout | caching | fonts | general" },
            message: { type: "string" },
            priority: { type: "string", description: "high | medium | low" },
            impact: { type: "string", description: "LCP | FID | CLS | TTI | general" },
            capabilityHint: { type: "string" },
          },
        },
      },
      summary: { type: "string" },
      generatedAt: { type: "string", description: "ISO timestamp" },
    },
  },
  safetyConstraints: [
    { code: "suggestions_only", description: "Output is fix suggestions only; no content or system mutation.", enforce: "hard" },
  ],
  targetSurfaces: ["backoffice", "editor", "api"],
};

registerCapability(suggestPerformanceFixesCapability);

export type PerformanceSignals = {
  lcpMs?: number | null;
  fidMs?: number | null;
  cls?: number | null;
  imageCount?: number | null;
  totalImageBytes?: number | null;
  imagesWithoutDimensions?: number | null;
  imagesAboveFold?: number | null;
  scriptCount?: number | null;
  hasLazyLoad?: boolean | null;
  hasSrcset?: boolean | null;
  cacheHeadersOk?: boolean | null;
};

export type SuggestPerformanceFixesInput = {
  signals?: PerformanceSignals | null;
  imagePerformanceScore?: number | null;
  locale?: "nb" | "en" | null;
  maxFixes?: number | null;
};

export type PerformanceFixSuggestion = {
  category: "images" | "scripts" | "layout" | "caching" | "fonts" | "general";
  message: string;
  priority: "high" | "medium" | "low";
  impact: "LCP" | "FID" | "CLS" | "TTI" | "general";
  capabilityHint?: string | null;
};

export type SuggestPerformanceFixesOutput = {
  fixes: PerformanceFixSuggestion[];
  summary: string;
  generatedAt: string;
};

function safeNum(v: unknown): number | null {
  if (typeof v === "number" && !Number.isNaN(v)) return v;
  return null;
}

const LCP_GOOD_MS = 2500;
const LCP_POOR_MS = 4000;
const FID_GOOD_MS = 100;
const FID_POOR_MS = 300;
const CLS_GOOD = 0.1;
const CLS_POOR = 0.25;

/**
 * Suggests performance fixes from signals. Deterministic; no external calls.
 */
export function suggestPerformanceFixes(input: SuggestPerformanceFixesInput = {}): SuggestPerformanceFixesOutput {
  const locale = input.locale === "en" ? "en" : "nb";
  const isEn = locale === "en";
  const maxFixes = Math.min(25, Math.max(1, Math.floor(Number(input.maxFixes) ?? 15)));

  const signals = input.signals && typeof input.signals === "object" ? input.signals : {};
  const lcpMs = safeNum(signals.lcpMs);
  const fidMs = safeNum(signals.fidMs);
  const cls = safeNum(signals.cls);
  const imageCount = Math.max(0, Math.floor(Number(signals.imageCount) ?? 0));
  const totalImageBytes = Math.max(0, Math.floor(Number(signals.totalImageBytes) ?? 0));
  const imagesWithoutDimensions = Math.max(0, Math.floor(Number(signals.imagesWithoutDimensions) ?? 0));
  const imagesAboveFold = Math.max(0, Math.floor(Number(signals.imagesAboveFold) ?? 0));
  const scriptCount = Math.max(0, Math.floor(Number(signals.scriptCount) ?? 0));
  const hasLazyLoad = signals.hasLazyLoad === true;
  const hasSrcset = signals.hasSrcset === true;
  const cacheHeadersOk = signals.cacheHeadersOk === true;
  const imageScore = safeNum(input.imagePerformanceScore);

  const fixes: PerformanceFixSuggestion[] = [];
  const seen = new Set<string>();

  const add = (
    category: PerformanceFixSuggestion["category"],
    message: string,
    priority: PerformanceFixSuggestion["priority"],
    impact: PerformanceFixSuggestion["impact"],
    capabilityHint?: string
  ) => {
    const key = `${category}:${message.slice(0, 40)}`;
    if (seen.has(key) || fixes.length >= maxFixes) return;
    seen.add(key);
    fixes.push({ category, message, priority, impact, capabilityHint });
  };

  if (lcpMs != null && lcpMs > LCP_GOOD_MS) {
    add(
      "images",
      isEn ? `LCP is ${lcpMs}ms (target <${LCP_GOOD_MS}ms). Optimize hero image: resize, WebP/AVIF, priority load.` : `LCP er ${lcpMs}ms (mål <${LCP_GOOD_MS}ms). Optimaliser hero-bilde: skaler, WebP/AVIF, prioritet lasting.`,
      lcpMs > LCP_POOR_MS ? "high" : "medium",
      "LCP",
      "analyzeImagePerformance"
    );
  }

  if (imageScore != null && imageScore < 70) {
    add(
      "images",
      isEn ? `Image performance score is ${imageScore}/100. Resize, compress, use WebP and lazy load below fold.` : `Bildeytelse er ${imageScore}/100. Skaler, komprimer, bruk WebP og lazy load under brettet.`,
      imageScore < 50 ? "high" : "medium",
      "LCP",
      "analyzeImagePerformance"
    );
  }

  if (imageCount > 0 && !hasLazyLoad) {
    add(
      "images",
      isEn ? "Enable lazy loading for below-the-fold images to reduce initial payload." : "Aktiver lazy loading for bilder under brettet for å redusere første lasting.",
      imageCount > 3 ? "high" : "medium",
      "LCP",
      "analyzeImagePerformance"
    );
  }

  if (imageCount > 0 && totalImageBytes > 2 * 1024 * 1024) {
    add(
      "images",
      isEn ? `Total image size is ${(totalImageBytes / 1024 / 1024).toFixed(1)}MB. Compress and serve WebP/AVIF with fallback.` : `Total bildestørrelse er ${(totalImageBytes / 1024 / 1024).toFixed(1)}MB. Komprimer og server WebP/AVIF med fallback.`,
      "high",
      "LCP",
      "analyzeImagePerformance"
    );
  }

  if (imagesWithoutDimensions > 0) {
    add(
      "layout",
      isEn ? `Add width/height to ${imagesWithoutDimensions} image(s) to reduce CLS (layout shift).` : `Legg til width/height på ${imagesWithoutDimensions} bilde(r) for å redusere CLS.`,
      "high",
      "CLS",
      "analyzeImagePerformance"
    );
  }

  if (cls != null && cls > CLS_GOOD) {
    add(
      "layout",
      isEn ? `CLS is ${cls.toFixed(2)} (target <${CLS_GOOD}). Reserve space for images/ads and avoid inserting content above existing.` : `CLS er ${cls.toFixed(2)} (mål <${CLS_GOOD}). Reserver plass for bilder/annonser og unngå innhold som skyver ned.`,
      cls > CLS_POOR ? "high" : "medium",
      "CLS"
    );
  }

  if (fidMs != null && fidMs > FID_GOOD_MS) {
    add(
      "scripts",
      isEn ? `FID is ${fidMs}ms (target <${FID_GOOD_MS}ms). Reduce main-thread work: code-split, defer non-critical JS.` : `FID er ${fidMs}ms (mål <${FID_GOOD_MS}ms). Reduser main-thread-arbeid: kode-splitting, utsett ikke-kritisk JS.`,
      fidMs > FID_POOR_MS ? "high" : "medium",
      "FID"
    );
  }

  if (scriptCount > 10) {
    add(
      "scripts",
      isEn ? `Many scripts (${scriptCount}). Consider code splitting, tree shaking, and loading non-critical JS async.` : `Mange skript (${scriptCount}). Vurder code splitting, tree shaking og asynkron lasting av ikke-kritisk JS.`,
      "medium",
      "TTI"
    );
  }

  if (imagesAboveFold > 2 && !hasSrcset) {
    add(
      "images",
      isEn ? "Add srcset for above-the-fold images to serve appropriate size per device." : "Legg til srcset for bilder over brettet for riktig størrelse per enhet.",
      "medium",
      "LCP",
      "analyzeImagePerformance"
    );
  }

  if (cacheHeadersOk === false) {
    add(
      "caching",
      isEn ? "Set cache headers on static assets (e.g. Cache-Control: public, max-age=31536000 for hashed assets)." : "Sett cache-headere på statiske ressurser (f.eks. Cache-Control: public, max-age=31536000 for hashede filer).",
      "medium",
      "general"
    );
  }

  if (fixes.length === 0) {
    add(
      "general",
      isEn ? "No performance issues detected from provided signals. Keep monitoring LCP, FID, CLS." : "Ingen ytelsesproblemer oppdaget fra signaler. Fortsett å overvåke LCP, FID, CLS.",
      "low",
      "general"
    );
  }

  fixes.sort((a, b) => {
    const order = { high: 0, medium: 1, low: 2 };
    return (order[a.priority] ?? 2) - (order[b.priority] ?? 2);
  });

  const summary = isEn
    ? `Performance: ${fixes.length} fix suggestion(s). ${fixes.filter((f) => f.priority === "high").length} high priority.`
    : `Ytelse: ${fixes.length} forslag. ${fixes.filter((f) => f.priority === "high").length} høyprioriterte.`;

  return {
    fixes,
    summary,
    generatedAt: new Date().toISOString(),
  };
}

export { suggestPerformanceFixesCapability, CAPABILITY_NAME };
