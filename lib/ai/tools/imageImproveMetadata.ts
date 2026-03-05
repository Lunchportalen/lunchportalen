/**
 * Phase 35B: AI Image Improve - deterministic suggestions for alt/caption/tags.
 * No external AI; uses locale-aware templates and small tag sets.
 */

const ALT_MAX = 180;
const CAPTION_MAX = 500;
const TAGS_MAX = 20;
const TAG_MAX_LEN = 30;
const ALT_MIN_LENGTH = 20;

export type ImageImproveInput = {
  locale: string;
  mediaItemId: string;
  url: string;
  current: { alt: string; caption?: string | null; tags: string[] };
  context?: { pageTitle?: string; topic?: string; purpose?: "hero" | "section" | "social" };
  mode?: "safe" | "strict";
};

export type ImageImproveOutput = {
  summary: string;
  media: { id: string };
  suggestion?: {
    alt?: string;
    caption?: string | null;
    tags?: string[];
  };
  stats: { fieldsSuggested: number };
};

const TAG_POOL_NB: string[] = [
  "lunsj", "mat", "kontor", "firma", "levering", "middag", "helse", "salat",
  "sunn", "bedrift", "kantine", "lunsjordning", "arbeidsplass",
];

const TAG_POOL_EN: string[] = [
  "lunch", "food", "office", "company", "delivery", "dinner", "health", "salad",
  "healthy", "workplace", "canteen", "catering", "corporate",
];

function truncate(s: string, max: number): string {
  return s.length <= max ? s : s.slice(0, max);
}

export function imageImproveMetadataToSuggestion(args: ImageImproveInput): ImageImproveOutput {
  const { locale, mediaItemId, current, context = {}, mode = "safe" } = args;
  const loc = locale === "en" ? "en" : "nb";
  const topic = (context.topic || context.pageTitle || "Lunchportalen").trim();
  const purpose = context.purpose || "hero";

  const suggestion: NonNullable<ImageImproveOutput["suggestion"]> = {};
  let fieldsSuggested = 0;

  const needAlt = !current.alt || current.alt.trim().length < ALT_MIN_LENGTH;
  if (needAlt) {
    const withPurpose = purpose === "hero"
      ? (loc === "en" ? "Hero image: " : "Hero-bilde: ") + topic
      : purpose === "section"
        ? (loc === "en" ? "Section image: " : "Seksjonsbilde: ") + topic
        : (loc === "en" ? "Social image: " : "Sosialt bilde: ") + topic;
    suggestion.alt = truncate(withPurpose, ALT_MAX);
    fieldsSuggested++;
  }

  const needCaption = current.caption == null || String(current.caption).trim().length === 0;
  if (needCaption) {
    const cap = loc === "en" ? "Image used for " + topic + "." : "Bilde brukt for " + topic + ".";
    suggestion.caption = truncate(cap, CAPTION_MAX);
    fieldsSuggested++;
  }

  const tagPool = loc === "en" ? TAG_POOL_EN : TAG_POOL_NB;
  const currentTags = Array.isArray(current.tags) ? current.tags : [];
  const needTags = currentTags.length < 3;
  if (needTags) {
    const fromTopic = topic.toLowerCase().replace(/\s+/g, "-").slice(0, TAG_MAX_LEN);
    const suggested = new Set<string>(currentTags.map((t) => t.trim().slice(0, TAG_MAX_LEN)).filter(Boolean));
    if (fromTopic && fromTopic.length >= 2) suggested.add(fromTopic);
    for (const t of tagPool) {
      if (suggested.size >= 6) break;
      suggested.add(t.slice(0, TAG_MAX_LEN));
    }
    suggestion.tags = Array.from(suggested).slice(0, TAGS_MAX);
    fieldsSuggested++;
  }

  const summary = fieldsSuggested === 0
    ? (loc === "en" ? "No metadata improvements suggested." : "Ingen forbedringer av metadata foreslatt.")
    : (loc === "en" ? "Suggested improvements for " + fieldsSuggested + " field(s)." : "Foreslatt forbedring for " + fieldsSuggested + " felt.");

  return {
    summary,
    media: { id: mediaItemId },
    ...(fieldsSuggested > 0 && { suggestion }),
    stats: { fieldsSuggested },
  };
}