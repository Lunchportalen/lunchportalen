/**
 * Proposes design fixes as a preview block list + human-readable suggestions.
 * Does not persist; caller must approve before applying to editor state.
 */

import type { CmsDesignTokens } from "./designTokens";

export type DesignGeneratorResult = {
  updatedBlocks: unknown[];
  suggestions: string[];
};

function cloneBlocks(blocks: unknown[]): unknown[] {
  try {
    return JSON.parse(JSON.stringify(blocks)) as unknown[];
  } catch {
    return [];
  }
}

function asRecord(b: unknown): Record<string, unknown> | null {
  if (!b || typeof b !== "object" || Array.isArray(b)) return null;
  return b as Record<string, unknown>;
}

function makeDividerId(i: number): string {
  return `design-suggest-divider-${i}`;
}

/**
 * Deterministic layout improvements: optional dividers, trim headings, optional reorder hero to top.
 */
export function generateDesignFixes(blocks: unknown[], tokens: CmsDesignTokens): DesignGeneratorResult {
  const suggestions: string[] = [];
  const updatedBlocks = cloneBlocks(blocks);

  if (!Array.isArray(updatedBlocks) || updatedBlocks.length === 0) {
    return {
      updatedBlocks,
      suggestions: ["Ingen blokker å forbedre — legg til innhold først."],
    };
  }

  const recs = updatedBlocks.map(asRecord);
  const types = recs.map((r) => (r && typeof r.type === "string" ? r.type : "unknown"));

  // 1) Move hero to index 0 if present elsewhere
  const heroIndex = types.indexOf("hero");
  if (heroIndex > 0) {
    const hero = updatedBlocks[heroIndex];
    updatedBlocks.splice(heroIndex, 1);
    updatedBlocks.unshift(hero);
    suggestions.push("Flyttet hero til toppen for konsistent hierarki.");
  }

  // Rebuild type list after reorder
  const recs2 = updatedBlocks.map(asRecord);
  const types2 = recs2.map((r) => (r && typeof r.type === "string" ? r.type : "unknown"));

  // 2) Insert divider between consecutive long richText blocks
  let insertOffset = 0;
  let dividerSerial = 0;
  for (let i = 0; i < types2.length - 1; i++) {
    const a = recs2[i];
    const b = recs2[i + 1];
    if (!a || !b) continue;
    if (a.type !== "richText" || b.type !== "richText") continue;
    const la = `${typeof a.heading === "string" ? a.heading : ""}${typeof a.body === "string" ? a.body : ""}`.length;
    const lb = `${typeof b.heading === "string" ? b.heading : ""}${typeof b.body === "string" ? b.body : ""}`.length;
    if (la > 380 && lb > 380) {
      const at = i + insertOffset;
      updatedBlocks.splice(at + 1, 0, {
        id: makeDividerId(dividerSerial++),
        type: "divider",
        style: "space",
      });
      insertOffset++;
      suggestions.push(
        `La til skille (luft) mellom to lange tekstblokker — anbefalt rytme: ${tokens.spacing.md.label}.`,
      );
    }
  }

  // 3) Trim richText headings / hero title whitespace
  for (let i = 0; i < updatedBlocks.length; i++) {
    const row = asRecord(updatedBlocks[i]);
    if (!row) continue;
    if (row.type === "richText" && typeof row.heading === "string") {
      const t = row.heading.trim();
      if (t !== row.heading) {
        updatedBlocks[i] = { ...row, heading: t };
        suggestions.push("Trimmet overskrift i en tekstblokk for jevn typografi.");
      }
    }
    if (row.type === "hero" && typeof row.title === "string") {
      const t = row.title.trim();
      if (t !== row.title) {
        updatedBlocks[i] = { ...row, title: t };
        suggestions.push("Trimmet hero-tittel for bedre visuell balanse.");
      }
    }
  }

  // 4) Suggest token usage (no structural change)
  if (suggestions.length === 0) {
    suggestions.push(
      `Bruk ${tokens.typography.h2.fontSize} / ${tokens.typography.h2.lineHeight} for seksjonstitler (H2-nivå).`,
    );
    suggestions.push(`Hold vertikal rytme rundt ${tokens.spacing.md.value} mellom seksjoner der mulig.`);
    suggestions.push(`Primær tekstfarge: ${tokens.colors.primary.cssVar}; dempet hjelpetekst: ${tokens.colors.muted.cssVar}.`);
  }

  return { updatedBlocks, suggestions };
}
