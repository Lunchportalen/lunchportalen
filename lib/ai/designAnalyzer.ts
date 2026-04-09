/**
 * Structural design analysis for CMS block lists (no LLM).
 * Scores hierarchy, spacing rhythm, CTA placement, and visual balance.
 */

export type DesignAnalysisIssue = {
  id: string;
  severity: "info" | "warn" | "fail";
  message: string;
};

export type DesignAnalysisImprovement = {
  id: string;
  message: string;
};

export type DesignAnalysisResult = {
  score: number;
  issues: DesignAnalysisIssue[];
  improvements: DesignAnalysisImprovement[];
};

function blockType(b: Record<string, unknown>): string {
  return typeof b.type === "string" ? b.type : "unknown";
}

function textLen(b: Record<string, unknown>): number {
  const parts = [
    typeof b.title === "string" ? b.title : "",
    typeof b.subtitle === "string" ? b.subtitle : "",
    typeof b.heading === "string" ? b.heading : "",
    typeof b.body === "string" ? b.body : "",
  ];
  return parts.join(" ").length;
}

function isCtaLike(b: Record<string, unknown>): boolean {
  const t = blockType(b);
  return t === "cta" || t === "hero";
}

/**
 * Analyzes a serialized block array (unknown[] from API / editor).
 */
export function analyzeDesign(blocks: unknown[]): DesignAnalysisResult {
  const issues: DesignAnalysisIssue[] = [];
  const improvements: DesignAnalysisImprovement[] = [];

  if (!Array.isArray(blocks)) {
    return {
      score: 0,
      issues: [{ id: "blocks-invalid", severity: "fail", message: "Blokklisten er ugyldig." }],
      improvements: [{ id: "fix-blocks", message: "Send en gyldig blokk-array." }],
    };
  }

  if (blocks.length === 0) {
    return {
      score: 35,
      issues: [{ id: "empty", severity: "warn", message: "Ingen blokker — siden har ikke innholdsstruktur." }],
      improvements: [{ id: "add-hero", message: "Legg til en hero og et tekstfelt for tydelig hierarki." }],
    };
  }

  const normalized = blocks.filter((x): x is Record<string, unknown> => Boolean(x) && typeof x === "object" && !Array.isArray(x));

  let score = 58;
  const types = normalized.map(blockType);

  const heroIdx = types.indexOf("hero");
  if (heroIdx === -1) {
    issues.push({
      id: "no-hero",
      severity: "info",
      message: "Ingen hero-blokk — førsteinntrykk og hierarki kan bli svakere.",
    });
    improvements.push({ id: "hero", message: "Vurder hero øverst med tittel, undertittel og én tydelig CTA." });
    score -= 8;
  } else if (heroIdx > 0) {
    issues.push({
      id: "hero-not-first",
      severity: "warn",
      message: "Hero er ikke første blokk — vanligvis bør hero ligge øverst.",
    });
    improvements.push({ id: "reorder-hero", message: "Flytt hero til toppen for konsistent landingsside-flyt." });
    score -= 10;
  } else {
    score += 6;
  }

  // Hierarchy: heading → body flow in richText blocks
  let richWithoutHeading = 0;
  for (const b of normalized) {
    if (blockType(b) !== "richText") continue;
    const h = typeof b.heading === "string" ? b.heading.trim() : "";
    const body = typeof b.body === "string" ? b.body.trim() : "";
    if (body.length > 120 && !h) {
      richWithoutHeading++;
    }
  }
  if (richWithoutHeading > 0) {
    issues.push({
      id: "rich-missing-heading",
      severity: "info",
      message: `${richWithoutHeading} rik tekst-blokk(er) med langt innhold mangler overskrift.`,
    });
    improvements.push({
      id: "headings",
      message: "Gi lange tekstblokker en H2-overskrift for skannbarhet.",
    });
    score -= Math.min(12, richWithoutHeading * 4);
  }

  // Spacing rhythm: long text runs without divider/image
  let longRun = 0;
  let maxRun = 0;
  for (const b of normalized) {
    const t = blockType(b);
    if (t === "richText" && textLen(b) > 400) {
      longRun++;
      maxRun = Math.max(maxRun, longRun);
    } else if (t === "divider" || t === "image" || t === "hero" || t === "banners") {
      longRun = 0;
    }
  }
  if (maxRun >= 2) {
    issues.push({
      id: "dense-text",
      severity: "warn",
      message: "Flere lange tekstblokker på rad uten visuell pause (bilde/skillelinje).",
    });
    improvements.push({
      id: "breathing",
      message: "Sett inn bilde, banner eller skillelinje mellom lange tekstseksjoner.",
    });
    score -= 8;
  }

  // CTA placement
  const ctaIndices = types.map((t, i) => (t === "cta" ? i : -1)).filter((i) => i >= 0);
  if (ctaIndices.length === 0 && !types.includes("hero")) {
    issues.push({
      id: "no-cta",
      severity: "warn",
      message: "Ingen dedikert CTA-blokk — konvertering kan bli uklar.",
    });
    improvements.push({ id: "cta-end", message: "Avslutt med en CTA-blokk med ett primærkall." });
    score -= 7;
  } else {
    const lastCta = ctaIndices.length ? ctaIndices[ctaIndices.length - 1] : -1;
    const hero = normalized.find((b) => blockType(b) === "hero") as Record<string, unknown> | undefined;
    const heroCta =
      hero &&
      (typeof hero.ctaLabel === "string" ? hero.ctaLabel.trim() : "") &&
      (typeof hero.ctaHref === "string" ? hero.ctaHref.trim() : "");
    if (ctaIndices.length === 1 && lastCta < types.length - 1 && !heroCta) {
      improvements.push({
        id: "cta-bottom",
        message: "Vurder å plassere hoved-CTA nærmere bunnen av siden for naturlig avslutning.",
      });
      score += 2;
    }
    if (ctaIndices.length > 0 && lastCta >= 0 && lastCta < 2 && types.length > 4) {
      issues.push({
        id: "cta-early",
        severity: "info",
        message: "CTA tidlig på siden — sørg for at leseren har nok kontekst før hovedhandling.",
      });
      score -= 3;
    }
  }

  // Visual balance: images
  const imageCount = types.filter((t) => t === "image" || t === "banners").length;
  const textHeavy = types.filter((t) => t === "richText").length;
  if (textHeavy >= 3 && imageCount === 0) {
    issues.push({
      id: "no-visuals",
      severity: "info",
      message: "Mye tekst, få visuelle elementer — siden kan oppleves tung.",
    });
    improvements.push({ id: "image-break", message: "Break opp med minst ett bilde eller banner." });
    score -= 6;
  } else if (imageCount > 0) {
    score += 4;
  }

  // Component density
  if (normalized.length > 14) {
    issues.push({
      id: "high-density",
      severity: "info",
      message: "Høy blokk-tetthet — vurder å slå sammen eller forkorte seksjoner.",
    });
    improvements.push({ id: "simplify", message: "Grupper relatert innhold i færre, sterkere blokker." });
    score -= 5;
  }

  score = Math.max(0, Math.min(100, Math.round(score)));

  return { score, issues, improvements };
}
