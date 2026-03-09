/**
 * Layout suggestions: analyze page blocks and return 3-5 practical layout improvements.
 * Deterministic; no LLM. Used by /api/backoffice/ai/layout-suggestions.
 */

export type LayoutSuggestion = {
  kind: string;
  title: string;
  reason: string;
  priority: "high" | "medium" | "low";
  target?: string;
};

export type LayoutSuggestionsInput = {
  blocks: Array<{ id: string; type: string; data?: Record<string, unknown> }>;
  title?: string;
  locale?: string;
};

export type LayoutSuggestionsOutput = {
  suggestions: LayoutSuggestion[];
  message: string;
};

const MAX_SUGGESTIONS = 5;

function hasBlock(blocks: LayoutSuggestionsInput["blocks"], type: string): boolean {
  return blocks.some((b) => b.type === type);
}

function countBlocks(blocks: LayoutSuggestionsInput["blocks"], type: string): number {
  return blocks.filter((b) => b.type === type).length;
}

function hasLongRichText(blocks: LayoutSuggestionsInput["blocks"], minLen: number): boolean {
  return blocks.some((b) => {
    if (b.type !== "richText" || !b.data) return false;
    const body = typeof b.data.body === "string" ? b.data.body : "";
    return body.trim().length >= minLen;
  });
}

export function getLayoutSuggestions(input: LayoutSuggestionsInput): LayoutSuggestionsOutput {
  const blocks = Array.isArray(input.blocks) ? input.blocks : [];
  const locale = input.locale === "en" ? "en" : "nb";
  const isEn = locale === "en";
  const suggestions: LayoutSuggestion[] = [];
  const seen = new Set<string>();

  function add(kind: string, title: string, reason: string, priority: LayoutSuggestion["priority"], target?: string) {
    if (seen.has(kind) || suggestions.length >= MAX_SUGGESTIONS) return;
    seen.add(kind);
    suggestions.push({ kind, title, reason, priority, target });
  }

  const hasHero = hasBlock(blocks, "hero");
  const hasCta = hasBlock(blocks, "cta");
  const richTextCount = countBlocks(blocks, "richText");
  const hasLongText = hasLongRichText(blocks, 500);

  if (!hasHero) {
    add(
      "add_hero",
      isEn ? "Add a hero section" : "Legg til en hero-seksjon",
      isEn ? "A clear hero improves first impression and conversion." : "En tydelig hero forbedrer første inntrykk og konvertering.",
      "high",
      "0"
    );
  }

  if (!hasCta && blocks.length > 0) {
    add(
      "add_cta",
      isEn ? "Add a call-to-action" : "Legg til en oppfordring til handling",
      isEn ? "Pages convert better with a visible CTA." : "Sider konverterer bedre med en synlig CTA.",
      "high",
      String(blocks.length)
    );
  } else if (hasCta && blocks.length >= 2) {
    const ctaIndex = blocks.findIndex((b) => b.type === "cta");
    if (ctaIndex > 3) {
      add(
        "move_cta_earlier",
        isEn ? "Consider moving CTA earlier" : "Vurder å flytte CTA tidligere",
        isEn ? "CTAs earlier in the page often perform better." : "CTA tidligere på siden presterer ofte bedre.",
        "medium",
        "2"
      );
    }
  }

  if (hasLongText) {
    add(
      "split_long_text",
      isEn ? "Split long text into sections" : "Del lang tekst i seksjoner",
      isEn ? "Shorter sections improve scannability and hierarchy." : "Kortere seksjoner forbedrer skanbarhet og hierarki.",
      "medium"
    );
  }

  if (richTextCount >= 1 && !hasBlock(blocks, "image")) {
    add(
      "add_image_block",
      isEn ? "Add an image block" : "Legg til en bildeblokk",
      isEn ? "Images break up text and support the message." : "Bilder bryter opp tekst og støtter budskapet.",
      "medium"
    );
  }

  if (blocks.length >= 2 && richTextCount >= 2 && !hasBlock(blocks, "divider")) {
    add(
      "add_visual_separation",
      isEn ? "Add visual separation between sections" : "Legg til visuell separasjon mellom seksjoner",
      isEn ? "Dividers or spacing improve hierarchy." : "Skillelementer eller luft forbedrer hierarki.",
      "low"
    );
  }

  const message =
    suggestions.length === 0
      ? isEn
        ? "No layout improvements suggested for this structure."
        : "Ingen layoutforslag for denne strukturen."
      : isEn
        ? `Generated ${suggestions.length} layout suggestion(s).`
        : `Genererte ${suggestions.length} layoutforslag.`;

  return { suggestions, message };
}

/**
 * Normalize raw array to valid LayoutSuggestion[]. Cap at 5, trim strings, enforce priority.
 */
export function normalizeLayoutSuggestions(raw: unknown, locale: string): LayoutSuggestionsOutput {
  const fallback = getLayoutSuggestions({ blocks: [], locale });
  if (raw == null || !Array.isArray(raw)) return fallback;
  const isEn = locale === "en";
  const allowedPriority = new Set(["high", "medium", "low"]);
  const suggestions: LayoutSuggestion[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < Math.min(raw.length, MAX_SUGGESTIONS); i++) {
    const item = raw[i];
    if (item == null || typeof item !== "object" || Array.isArray(item)) continue;
    const o = item as Record<string, unknown>;
    const kind = typeof o.kind === "string" ? o.kind.trim() : "";
    const title = typeof o.title === "string" ? o.title.trim() : "";
    const reason = typeof o.reason === "string" ? o.reason.trim() : "";
    const priority = allowedPriority.has(String(o.priority)) ? (o.priority as LayoutSuggestion["priority"]) : "medium";
    if (!kind && !title) continue;
    const key = kind || title;
    if (seen.has(key)) continue;
    seen.add(key);
    suggestions.push({
      kind: kind || "suggestion",
      title: title || (isEn ? "Suggestion" : "Forslag"),
      reason: reason || "",
      priority,
      target: typeof o.target === "string" ? o.target.trim() : undefined,
    });
  }
  if (suggestions.length === 0) return fallback;
  const message = isEn ? `Returned ${suggestions.length} normalized suggestion(s).` : `Returnerte ${suggestions.length} normaliserte forslag.`;
  return { suggestions, message };
}
