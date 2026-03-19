/**
 * Image tagging engine capability: tagImage.
 * Returns semantic tags from image metadata. Bounded to MEDIA_TAGS_MAX_COUNT and MEDIA_TAG_MAX_LEN.
 * Import this module to register the capability.
 */

import {
  MEDIA_TAGS_MAX_COUNT,
  MEDIA_TAG_MAX_LEN,
} from "@/lib/media/validation";
import type { Capability } from "../capabilityRegistry";
import { registerCapability } from "../capabilityRegistry";

const CAPABILITY_NAME = "tagImage";

export type TagImageMetadataInput = {
  alt?: string | null;
  caption?: string | null;
  topic?: string | null;
  purpose?: "hero" | "section" | "social" | null;
  locale?: "nb" | "en" | null;
};

const tagImageCapability: Capability = {
  name: CAPABILITY_NAME,
  description: "Returns semantic tags for an image from metadata (alt, caption, topic, purpose). Tags are bounded by MEDIA_TAGS_MAX_COUNT and MEDIA_TAG_MAX_LEN.",
  requiredContext: [],
  inputSchema: {
    type: "object",
    description: "Image metadata",
    properties: {
      alt: { type: "string" },
      caption: { type: "string" },
      topic: { type: "string" },
      purpose: { type: "string", enum: ["hero", "section", "social"] },
      locale: { type: "string", enum: ["nb", "en"] },
    },
  },
  outputSchema: {
    type: "object",
    description: "Semantic tags",
    required: ["tags"],
    properties: {
      tags: {
        type: "array",
        items: { type: "string" },
        description: "Semantic tags (max MEDIA_TAGS_MAX_COUNT, each max MEDIA_TAG_MAX_LEN)",
      },
    },
  },
  safetyConstraints: [
    { code: "bounds", description: "Tag count and length respect media validation limits.", enforce: "hard" },
  ],
  targetSurfaces: ["backoffice", "editor", "api"],
};

registerCapability(tagImageCapability);

export type TagImageInput = {
  imageMetadata: TagImageMetadataInput;
};

export type TagImageOutput = {
  tags: string[];
};

function safeStr(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function normalizeTag(t: string): string {
  return t
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9æøå\-]/gi, "")
    .toLowerCase()
    .slice(0, MEDIA_TAG_MAX_LEN);
}

/** Semantic tag pool by locale (lunch/workplace/corporate context). */
const TAG_POOL_NB: string[] = [
  "lunsj", "mat", "kontor", "firma", "levering", "middag", "helse", "salat",
  "sunn", "bedrift", "kantine", "lunsjordning", "arbeidsplass", "catering",
];

const TAG_POOL_EN: string[] = [
  "lunch", "food", "office", "company", "delivery", "dinner", "health", "salad",
  "healthy", "workplace", "canteen", "catering", "corporate", "meal",
];

/**
 * Returns semantic tags from image metadata.
 * Derives tags from alt/caption/topic and merges with purpose- and locale-based pool; dedupes and bounds.
 */
export function tagImage(input: TagImageInput): TagImageOutput {
  const m = input.imageMetadata ?? {};
  const alt = safeStr(m.alt);
  const caption = safeStr(m.caption);
  const topic = safeStr(m.topic);
  const purpose = m.purpose === "hero" || m.purpose === "section" || m.purpose === "social" ? m.purpose : "section";
  const locale = m.locale === "en" ? "en" : "nb";
  const pool = locale === "en" ? TAG_POOL_EN : TAG_POOL_NB;

  const collected = new Set<string>();

  if (topic) {
    const fromTopic = normalizeTag(topic);
    if (fromTopic.length >= 2) collected.add(fromTopic);
  }

  const text = [alt, caption].join(" ").toLowerCase();
  for (const tag of pool) {
    if (text.includes(tag) || (topic && topic.toLowerCase().includes(tag))) {
      collected.add(tag);
    }
  }

  if (purpose === "hero") {
    collected.add(locale === "en" ? "hero" : "hero");
  }
  if (purpose === "social") {
    collected.add(locale === "en" ? "social" : "sosial");
  }

  for (const t of pool) {
    if (collected.size >= MEDIA_TAGS_MAX_COUNT) break;
    if (collected.size >= 5) break;
    collected.add(t);
  }

  const tags = Array.from(collected)
    .map((t) => t.slice(0, MEDIA_TAG_MAX_LEN))
    .filter(Boolean)
    .slice(0, MEDIA_TAGS_MAX_COUNT);

  return { tags };
}

export { tagImageCapability, CAPABILITY_NAME };
