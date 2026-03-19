/**
 * Derives AI quick-fix suggestions from current blocks.
 * Used by the editor side panel to show "Add intro", "Add CTA", "Add FAQ" etc.
 */

export type QuickFixKind = "add_intro" | "add_cta" | "add_faq";

export type QuickFixSuggestion = {
  id: string;
  kind: QuickFixKind;
  label: string;
  description: string;
};

type BlockLike = { type: string; heading?: string; body?: string; title?: string };

function hasIntroLikeBlock(blocks: BlockLike[]): boolean {
  if (blocks.length === 0) return false;
  const first = blocks[0];
  if (first.type === "richText") {
    const body = (first.body ?? "").trim();
    return body.length >= 30;
  }
  if (first.type === "hero") {
    const title = (first.title ?? "").trim();
    const subtitle = (first as { subtitle?: string }).subtitle ?? "";
    return (title + subtitle).trim().length >= 20;
  }
  return false;
}

function hasCtaBlock(blocks: BlockLike[]): boolean {
  return blocks.some((b) => b.type === "cta");
}

const FAQ_HEADING_REG = /faq|ofte stilte|spørsmål|vanlige spørsmål/i;

function hasFaqLikeBlock(blocks: BlockLike[]): boolean {
  return blocks.some((b) => {
    if (b.type !== "richText") return false;
    const heading = (b.heading ?? "").trim();
    const body = (b.body ?? "").trim();
    return FAQ_HEADING_REG.test(heading) || FAQ_HEADING_REG.test(body.slice(0, 200));
  });
}

/**
 * Returns suggested quick-fixes based on current blocks.
 * Deterministic; no external calls.
 */
export function getQuickFixSuggestions(blocks: BlockLike[]): QuickFixSuggestion[] {
  const out: QuickFixSuggestion[] = [];
  if (!hasIntroLikeBlock(blocks)) {
    out.push({
      id: "qf-intro",
      kind: "add_intro",
      label: "Legg til intro",
      description: "Setter inn en introduksjonsseksjon øverst på siden.",
    });
  }
  if (!hasCtaBlock(blocks)) {
    out.push({
      id: "qf-cta",
      kind: "add_cta",
      label: "Legg til CTA",
      description: "Legger til en oppfordring til handling (knapp / kontakt).",
    });
  }
  if (!hasFaqLikeBlock(blocks)) {
    out.push({
      id: "qf-faq",
      kind: "add_faq",
      label: "Legg til FAQ",
      description: "Legger til en seksjon for ofte stilte spørsmål.",
    });
  }
  return out;
}
