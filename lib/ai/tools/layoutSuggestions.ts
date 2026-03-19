/**
 * Layout/design suggestions: analyze page blocks and return explainable, actionable improvements.
 * Each suggestion is previewable, dismissible, and applyable one-by-one (no auto-apply).
 * Deterministic; no LLM. Used by /api/backoffice/ai/layout-suggestions.
 */

import { isAIPatchV1, type AIPatchV1 } from "@/lib/cms/model/aiPatch";
import { newBlockId } from "@/lib/cms/model/blockId";

export type LayoutSuggestion = {
  kind: string;
  title: string;
  reason: string;
  priority: "high" | "medium" | "low";
  target?: string;
  /** Short explainable preview: what will happen if applied. */
  previewLabel?: string;
  /** Single-op patch to apply when user confirms. Omitted for recommendation-only suggestions. */
  applyPatch?: AIPatchV1;
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

const MAX_SUGGESTIONS = 8;

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

  function add(
    kind: string,
    title: string,
    reason: string,
    priority: LayoutSuggestion["priority"],
    opts?: { target?: string; previewLabel?: string; applyPatch?: AIPatchV1 }
  ) {
    if (seen.has(kind) || suggestions.length >= MAX_SUGGESTIONS) return;
    seen.add(kind);
    suggestions.push({
      kind,
      title,
      reason,
      priority,
      target: opts?.target,
      previewLabel: opts?.previewLabel,
      applyPatch: opts?.applyPatch,
    });
  }

  const hasHero = hasBlock(blocks, "hero");
  const hasCta = hasBlock(blocks, "cta");
  const richTextCount = countBlocks(blocks, "richText");
  const hasLongText = hasLongRichText(blocks, 500);
  const firstRichTextIndex = blocks.findIndex((b) => b.type === "richText");
  const firstRichTextBlock = firstRichTextIndex >= 0 ? blocks[firstRichTextIndex] : null;
  const heroBlock = blocks.find((b) => b.type === "hero");
  const ctaBlock = blocks.find((b) => b.type === "cta");

  if (!hasHero) {
    const insertId = newBlockId();
    add(
      "add_hero",
      isEn ? "Add a hero section" : "Legg til en hero-seksjon",
      isEn ? "A clear hero improves first impression and conversion." : "En tydelig hero forbedrer første inntrykk og konvertering.",
      "high",
      {
        target: "0",
        previewLabel: isEn ? "Will insert a hero section at the top." : "Setter inn en hero-seksjon øverst.",
        applyPatch: {
          version: 1,
          ops: [
            {
              op: "insertBlock",
              index: 0,
              block: {
                id: insertId,
                type: "hero",
                data: {
                  title: isEn ? "Heading" : "Overskrift",
                  subtitle: isEn ? "Subheading" : "Underoverskrift",
                  ctaLabel: isEn ? "Contact" : "Kontakt",
                  ctaHref: "/kontakt",
                  imageUrl: "",
                  imageAlt: "",
                },
              },
            },
          ],
        },
      }
    );
  }

  if (!hasCta && blocks.length > 0) {
    const insertId = newBlockId();
    add(
      "add_cta",
      isEn ? "Add a call-to-action" : "Legg til en oppfordring til handling",
      isEn ? "Pages convert better with a visible CTA." : "Sider konverterer bedre med en synlig CTA.",
      "high",
      {
        target: String(blocks.length),
        previewLabel: isEn ? "Will add a CTA block at the end." : "Legger til en CTA-blokk nederst.",
        applyPatch: {
          version: 1,
          ops: [
            {
              op: "insertBlock",
              index: blocks.length,
              block: {
                id: insertId,
                type: "cta",
                data: {
                  title: isEn ? "Ready?" : "Klar?",
                  body: isEn ? "Get in touch." : "Ta kontakt.",
                  buttonLabel: isEn ? "Contact" : "Kontakt",
                  buttonHref: "/kontakt",
                },
              },
            },
          ],
        },
      }
    );
  } else if (hasCta && blocks.length >= 2 && ctaBlock) {
    const ctaIndex = blocks.findIndex((b) => b.type === "cta");
    if (ctaIndex > 3) {
      const toIndex = Math.min(2, blocks.length - 1);
      add(
        "move_cta_earlier",
        isEn ? "Consider moving CTA earlier" : "Vurder å flytte CTA tidligere",
        isEn ? "CTAs earlier in the page often perform better." : "CTA tidligere på siden presterer ofte bedre.",
        "medium",
        {
          target: "2",
          previewLabel: isEn ? `Will move CTA to position ${toIndex + 1}.` : `Flytter CTA til posisjon ${toIndex + 1}.`,
          applyPatch: {
            version: 1,
            ops: [{ op: "moveBlock", id: ctaBlock.id, toIndex }],
          },
        }
      );
    }
  }

  if (hasLongText) {
    add(
      "split_long_text",
      isEn ? "Split long text into sections" : "Del lang tekst i seksjoner",
      isEn ? "Shorter sections improve scannability and hierarchy." : "Kortere seksjoner forbedrer skanbarhet og hierarki.",
      "medium",
      { previewLabel: isEn ? "Manual edit: split the long text block into two or more blocks." : "Manuell redigering: del den lange tekstblokken i to eller flere." }
    );
  }

  if (richTextCount >= 1 && !hasBlock(blocks, "image")) {
    const insertIndex = firstRichTextIndex >= 0 ? firstRichTextIndex + 1 : blocks.length;
    const insertId = newBlockId();
    add(
      "add_image_block",
      isEn ? "Add an image block" : "Legg til en bildeblokk",
      isEn ? "Images break up text and support the message." : "Bilder bryter opp tekst og støtter budskapet.",
      "medium",
      {
        previewLabel: isEn ? "Will insert an image block after the first text section." : "Setter inn en bildeblokk etter første tekstseksjon.",
        applyPatch: {
          version: 1,
          ops: [
            {
              op: "insertBlock",
              index: insertIndex,
              block: { id: insertId, type: "image", data: { assetPath: "", alt: "", caption: "" } },
            },
          ],
        },
      }
    );
  }

  if (blocks.length >= 2 && richTextCount >= 2 && !hasBlock(blocks, "divider")) {
    const insertId = newBlockId();
    const insertIndex = firstRichTextIndex >= 0 ? firstRichTextIndex + 1 : 1;
    add(
      "add_visual_separation",
      isEn ? "Add visual separation between sections" : "Legg til visuell separasjon mellom seksjoner",
      isEn ? "Dividers or spacing improve hierarchy." : "Skillelementer eller luft forbedrer hierarki.",
      "low",
      {
        previewLabel: isEn ? "Will insert a divider between sections." : "Setter inn en skillelinje mellom seksjoner.",
        applyPatch: {
          version: 1,
          ops: [{ op: "insertBlock", index: insertIndex, block: { id: insertId, type: "divider", data: {} } }],
        },
      }
    );
  }

  if (firstRichTextBlock && firstRichTextBlock.data) {
    const heading = firstRichTextBlock.data.heading ?? firstRichTextBlock.data.title;
    const headingStr = typeof heading === "string" ? heading.trim() : "";
    if (headingStr.length > 60) {
      add(
        "headline_hierarchy",
        isEn ? "Shorten first heading" : "Forkort første overskrift",
        isEn ? "Headings under 60 characters scan better in search and on the page." : "Overskrifter under 60 tegn skannes bedre i søk og på siden.",
        "medium",
        {
          target: firstRichTextBlock.id,
          previewLabel: isEn ? "Will suggest a shorter heading (you can edit after)." : "Foreslår en kortere overskrift (du kan redigere etterpå).",
          applyPatch: {
            version: 1,
            ops: [
              {
                op: "updateBlockData",
                id: firstRichTextBlock.id,
                data: { heading: headingStr.slice(0, 57) + "..." },
              },
            ],
          },
        }
      );
    }
  }

  if (heroBlock && heroBlock.data) {
    const imageUrl = heroBlock.data.imageUrl ?? heroBlock.data.assetPath;
    const hasImage = typeof imageUrl === "string" && imageUrl.trim().length > 0;
    if (!hasImage) {
      add(
        "hero_image_suggestion",
        isEn ? "Add hero image" : "Legg til hero-bilde",
        isEn ? "A hero image strengthens first impression." : "Et hero-bilde styrker første inntrykk.",
        "low",
        {
          target: heroBlock.id,
          previewLabel: isEn ? "Leaves hero image field empty for you to pick from media." : "Lar hero-bilde være tomt – velg bilde fra mediearkiv.",
        }
      );
    }
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
    const previewLabel = typeof o.previewLabel === "string" ? o.previewLabel.trim() : undefined;
    const applyPatch = isAIPatchV1(o.applyPatch) ? o.applyPatch : undefined;
    suggestions.push({
      kind: kind || "suggestion",
      title: title || (isEn ? "Suggestion" : "Forslag"),
      reason: reason || "",
      priority,
      target: typeof o.target === "string" ? o.target.trim() : undefined,
      previewLabel: previewLabel || undefined,
      applyPatch,
    });
  }
  if (suggestions.length === 0) return fallback;
  const message = isEn ? `Returned ${suggestions.length} normalized suggestion(s).` : `Returnerte ${suggestions.length} normaliserte forslag.`;
  return { suggestions, message };
}
