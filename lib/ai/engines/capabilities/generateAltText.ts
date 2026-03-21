/**
 * AI alt-text generator capability: generateAltText.
 * Input: image metadata. Output: accessibility-friendly alt text (bounded length).
 * Import this module to register the capability.
 */

import { MEDIA_ALT_MAX } from "@/lib/media/validation";
import type { Capability } from "../capabilityRegistry";
import { registerCapability } from "../capabilityRegistry";

const CAPABILITY_NAME = "generateAltText";

export type ImageMetadataInput = {
  /** Existing alt (may be empty). */
  alt?: string | null;
  /** Caption or description. */
  caption?: string | null;
  /** Filename or URL path hint. */
  filename?: string | null;
  /** Page/section topic. */
  topic?: string | null;
  /** Purpose: hero | section | social. */
  purpose?: "hero" | "section" | "social" | null;
  /** Locale for generated copy. */
  locale?: "nb" | "en" | null;
};

const generateAltTextCapability: Capability = {
  name: CAPABILITY_NAME,
  description: "Generates accessibility-friendly alt text from image metadata (caption, filename, topic, purpose). Output is bounded to MEDIA_ALT_MAX.",
  requiredContext: [],
  inputSchema: {
    type: "object",
    description: "Image metadata",
    properties: {
      alt: { type: "string" },
      caption: { type: "string" },
      filename: { type: "string" },
      topic: { type: "string" },
      purpose: { type: "string", enum: ["hero", "section", "social"] },
      locale: { type: "string", enum: ["nb", "en"] },
    },
  },
  outputSchema: {
    type: "object",
    description: "Generated alt text",
    required: ["altText"],
    properties: {
      altText: { type: "string", description: "Alt text for img alt attribute (max MEDIA_ALT_MAX)" },
    },
  },
  safetyConstraints: [
    { code: "length_limit", description: "Output is bounded to MEDIA_ALT_MAX (180 chars).", enforce: "hard" },
  ],
  targetSurfaces: ["backoffice", "editor", "api"],
};

registerCapability(generateAltTextCapability);

export type GenerateAltTextInput = {
  imageMetadata: ImageMetadataInput;
};

export type GenerateAltTextOutput = {
  altText: string;
};

function safeStr(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function truncate(s: string, max: number): string {
  const t = s.trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max - 3);
  const lastSpace = cut.lastIndexOf(" ");
  if (lastSpace > max * 0.5) return cut.slice(0, lastSpace).trim() + "...";
  return cut.trim() + "...";
}

/** Derive a short label from filename (strip extension, decode slugs). */
function labelFromFilename(filename: string): string {
  const s = filename.replace(/\.[a-z0-9]+$/i, "").replace(/[-_]/g, " ").trim();
  return s.slice(0, 60);
}

/**
 * Generates alt text from image metadata.
 * Prefers existing alt if adequate length; otherwise builds from caption, topic, purpose, or filename.
 */
export function generateAltText(input: GenerateAltTextInput): GenerateAltTextOutput {
  const m = input.imageMetadata ?? {};
  const alt = safeStr(m.alt);
  const caption = safeStr(m.caption);
  const filename = safeStr(m.filename);
  const topic = safeStr(m.topic) || "Lunchportalen";
  const purpose = m.purpose === "hero" || m.purpose === "section" || m.purpose === "social" ? m.purpose : "section";
  const locale = m.locale === "en" ? "en" : "nb";
  const isEn = locale === "en";

  if (alt.length >= 15 && alt.length <= MEDIA_ALT_MAX) {
    return { altText: truncate(alt, MEDIA_ALT_MAX) };
  }

  const purposePrefix =
    purpose === "hero"
      ? isEn ? "Hero image: " : "Hero-bilde: "
      : purpose === "social"
        ? isEn ? "Social share image: " : "Delingsbilde: "
        : isEn ? "Image: " : "Bilde: ";

  let candidate = "";
  if (caption.length >= 5) {
    candidate = purposePrefix + caption;
  } else if (topic) {
    candidate = purposePrefix + topic;
  } else if (filename) {
    candidate = purposePrefix + labelFromFilename(filename);
  } else {
    candidate = isEn ? "Image related to lunch and workplace delivery." : "Bilde relatert til lunsj og levering til arbeidsplassen.";
  }

  const altText = truncate(candidate, MEDIA_ALT_MAX);
  return { altText };
}

export { generateAltTextCapability, CAPABILITY_NAME };
