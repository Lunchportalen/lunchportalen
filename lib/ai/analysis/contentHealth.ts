/**
 * Content health analysis: score and issues from blocks, meta, pageTitle.
 * No DB writes; deterministic checks only. Score is always 0–100; based on real page content.
 * Used by content_health_daily agent and any consumer that needs page-quality signals.
 */

export type ContentHealthIssue = {
  code: string;
  severity: string;
  message: string;
};

export function analyzeContentHealth(args: {
  blocks: Array<{ id: string; type: string; data?: Record<string, unknown> }>;
  meta?: { description?: string };
  pageTitle?: string;
}): { score: number; issues: ContentHealthIssue[] } {
  const { blocks, meta } = args;
  const issues = [];

  const hasFaq = blocks.some((b) => {
    if (b.type !== "richText" || !b.data) return false;
    const body = b.data.body;
    if (typeof body !== "string") return false;
    const lower = body.toLowerCase();
    return lower.includes("faq") || lower.includes("spørsmål og svar");
  });
  if (!hasFaq) {
    issues.push({ code: "missing_faq", severity: "medium", message: "Mangler FAQ / Spørsmål og svar-seksjon" });
  }

  const ctaBlock = blocks.find((b) => b.type === "cta");
  const genericLabels = ["submit", "send", "klikk", "les mer", "read more"];
  const buttonLabel =
    ctaBlock?.data && typeof ctaBlock.data.buttonLabel === "string"
      ? (ctaBlock.data.buttonLabel).toLowerCase().trim()
      : "";
  if (!ctaBlock) {
    issues.push({ code: "missing_cta", severity: "high", message: "Mangler CTA-blokk" });
  } else if (!buttonLabel || genericLabels.some((g) => buttonLabel === g)) {
    issues.push({ code: "weak_cta", severity: "medium", message: "CTA-knappetekst er generisk eller tom" });
  }

  const firstRich = blocks.find((b) => b.type === "richText");
  const introBody =
    firstRich?.data && typeof firstRich.data.body === "string"
      ? firstRich.data.body
      : "";
  if (introBody.length > 0 && introBody.length < 200) {
    issues.push({ code: "short_intro", severity: "low", message: "Introduksjonstekst er under 200 tegn" });
  }

  const hasValueProps = blocks.some((b) => {
    if (b.type !== "richText" || !b.data) return false;
    const body = (b.data.body || "") + "";
    const lower = body.toLowerCase();
    return lower.includes("fordeler") || lower.includes("benefits");
  });
  if (!hasValueProps) {
    issues.push({ code: "missing_value_props", severity: "medium", message: "Mangler verdiargumenter (fordeler/benefits)" });
  }

  const metaDesc = meta?.description ?? "";
  if (metaDesc.length > 0 && metaDesc.length < 80) {
    issues.push({ code: "short_meta_description", severity: "medium", message: "Meta-beskrivelse under 80 tegn" });
  }

  const rawScore = 100 - issues.length * 10;
  const score = Math.max(0, Math.min(100, rawScore));
  return { score, issues };
}
