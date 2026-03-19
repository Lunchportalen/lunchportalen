/**
 * Image consistency checker capability: checkVisualConsistency.
 * Detects mismatched styles across images (style, aspect, purpose).
 * Import this module to register the capability.
 */

import type { Capability } from "../capabilityRegistry";
import { registerCapability } from "../capabilityRegistry";

const CAPABILITY_NAME = "checkVisualConsistency";

export type ImageDescriptor = {
  /** Image id or key. */
  id?: string | null;
  /** Style hint: photography | illustration | minimal | mixed. */
  style?: string | null;
  /** Purpose: hero | section | social. */
  purpose?: string | null;
  /** Aspect ratio (e.g. 1.78 for 16:9) or "square". */
  aspectRatio?: number | string | null;
  /** Width (optional, for ratio derivation). */
  width?: number | null;
  /** Height (optional, for ratio derivation). */
  height?: number | null;
};

const checkVisualConsistencyCapability: Capability = {
  name: CAPABILITY_NAME,
  description: "Checks visual consistency across images. Detects mismatched styles (e.g. photography vs illustration), aspect ratio variance, and mixed purposes.",
  requiredContext: [],
  inputSchema: {
    type: "object",
    description: "Set of image descriptors to check",
    required: ["images"],
    properties: {
      images: {
        type: "array",
        description: "Image descriptors [{ id?, style?, purpose?, aspectRatio? }]",
        items: { type: "object" },
      },
      locale: { type: "string", description: "Locale (nb | en)" },
    },
  },
  outputSchema: {
    type: "object",
    description: "Consistency result",
    required: ["consistent", "issues"],
    properties: {
      consistent: { type: "boolean", description: "True if no style mismatches detected" },
      issues: {
        type: "array",
        items: { type: "string" },
        description: "Detected mismatches or recommendations",
      },
    },
  },
  safetyConstraints: [
    { code: "read_only", description: "Check only; no content mutation.", enforce: "hard" },
  ],
  targetSurfaces: ["backoffice", "editor", "api"],
};

registerCapability(checkVisualConsistencyCapability);

export type CheckVisualConsistencyInput = {
  images: ImageDescriptor[] | null | undefined;
  locale?: "nb" | "en";
};

export type CheckVisualConsistencyOutput = {
  consistent: boolean;
  issues: string[];
};

const STYLE_ALIASES: Record<string, string> = {
  photo: "photography",
  photograph: "photography",
  real: "photography",
  illustration: "illustration",
  illustrasjon: "illustration",
  minimal: "minimal",
  minimalist: "minimal",
  flat: "minimal",
};

function normalizeStyle(s: unknown): string | null {
  if (s == null || typeof s !== "string") return null;
  const t = s.trim().toLowerCase();
  if (!t) return null;
  return STYLE_ALIASES[t] ?? t;
}

function getAspectRatio(img: ImageDescriptor): number | null {
  const ar = img.aspectRatio;
  if (typeof ar === "number" && ar > 0 && !Number.isNaN(ar)) return ar;
  if (ar === "square" || ar === "1:1") return 1;
  const w = typeof img.width === "number" && img.width > 0 ? img.width : null;
  const h = typeof img.height === "number" && img.height > 0 ? img.height : null;
  if (w && h) return w / h;
  return null;
}

const ASPECT_TOLERANCE = 0.25;

/**
 * Checks visual consistency across images. Detects mismatched styles and aspect variance.
 */
export function checkVisualConsistency(input: CheckVisualConsistencyInput): CheckVisualConsistencyOutput {
  const images = Array.isArray(input.images) ? input.images : [];
  const locale = input.locale === "en" ? "en" : "nb";
  const isEn = locale === "en";
  const issues: string[] = [];

  if (images.length <= 1) {
    return { consistent: true, issues: [] };
  }

  const styles = new Set<string>();
  const ratios: number[] = [];
  const purposes = new Set<string>();

  for (const img of images) {
    const style = normalizeStyle(img.style);
    if (style) styles.add(style);
    const ratio = getAspectRatio(img);
    if (ratio != null) ratios.push(ratio);
    const purpose = img.purpose && typeof img.purpose === "string" ? img.purpose.trim().toLowerCase() : "";
    if (purpose) purposes.add(purpose);
  }

  if (styles.size > 1) {
    const list = Array.from(styles).join(", ");
    issues.push(
      isEn
        ? `Mixed visual styles: ${list}. Consider using one style (e.g. all photography or all illustration) for consistency.`
        : `Blandede visuelle stiler: ${list}. Vurder én stil (f.eks. kun fotografi eller kun illustrasjon) for konsistens.`
    );
  }

  if (ratios.length >= 2) {
    const min = Math.min(...ratios);
    const max = Math.max(...ratios);
    const spread = max - min;
    if (spread > ASPECT_TOLERANCE * min) {
      issues.push(
        isEn
          ? "Aspect ratios vary significantly. Similar ratios (e.g. 16:9) improve visual consistency."
          : "Bildeformatene varierer mye. Lignende forhold (f.eks. 16:9) gir bedre visuell konsistens."
      );
    }
  }

  return {
    consistent: issues.length === 0,
    issues,
  };
}

export { checkVisualConsistencyCapability, CAPABILITY_NAME };
