/**
 * AI LAYOUT ENGINE
 * Designer: layout, grid, responsive struktur.
 * Samler generateInterface (layout-spesifikasjon), generateLayout (grid), generateResponsiveLayout (responsive).
 * Kun design/output; ingen mutasjon.
 */

import { generateInterface } from "@/lib/ai/ui/generateInterface";
import type {
  GenerateInterfaceInput,
  UILayoutSpecification,
  SectionSpec,
} from "@/lib/ai/ui/generateInterface";
import { generateLayout } from "@/lib/ai/layout/generateLayout";
import type {
  GenerateLayoutInput,
  GridLayoutConfiguration,
  ContentSectionInput,
  GridCellPlacement,
} from "@/lib/ai/layout/generateLayout";
import { generateResponsiveLayout } from "@/lib/ai/capabilities/generateResponsiveLayout";
import type {
  GenerateResponsiveLayoutInput,
  GenerateResponsiveLayoutOutput,
  ResponsiveSectionInput,
  Placement,
  BreakpointLayout,
} from "@/lib/ai/capabilities/generateResponsiveLayout";

export type { ContentSectionInput, GridCellPlacement, SectionSpec, Placement, BreakpointLayout };
export type { UILayoutSpecification, GridLayoutConfiguration, GenerateResponsiveLayoutOutput };

/** Input til layout-engine. */
export type LayoutEngineInput = {
  /** Sideformål (landing, dashboard, form, marketing, product, blog, …). */
  pagePurpose: string;
  /** Målgruppe (visitor, employee, company_admin, superadmin). */
  audience?: string | null;
  /** Seksjoner å plassere (id, type, priority). Mangler disse brukes layout-spesifikasjonens seksjoner. */
  contentSections?: ContentSectionInput[] | null;
  /** Grid-kolonner (default 12). */
  columns?: number | null;
  locale?: "nb" | "en" | null;
  /** Hva som skal designes: layout (spesifikasjon), grid, responsive, eller alle. */
  output?: ("layout" | "grid" | "responsive" | "all") | null;
};

/** Resultat: layout-spesifikasjon, grid-konfigurasjon, responsiv struktur. */
export type LayoutEngineOutput = {
  /** Layout-spesifikasjon (layoutType, sections, gridColumns, maxWidthPx). */
  layout?: UILayoutSpecification | null;
  /** Grid-konfigurasjon (columns, rows, gap, placements). */
  grid?: GridLayoutConfiguration | null;
  /** Responsiv struktur (desktop, tablet, mobile, breakpoints). */
  responsive?: GenerateResponsiveLayoutOutput | null;
  /** Kort oppsummering. */
  summary: string;
  /** ISO-tidsstempel. */
  designedAt: string;
};

function sectionSpecToContentSections(sections: SectionSpec[]): ContentSectionInput[] {
  return sections.map((s, i) => ({
    id: s.id,
    type: s.id, // use section id as type hint (hero, features, cta, faq)
    priority: 100 - (s.order ?? i),
  }));
}

/**
 * Designer layout, grid og responsive struktur fra pagePurpose (og valgfritt audience/contentSections).
 * Returnerer kun design; ingen mutasjon.
 */
export function runLayoutEngine(input: LayoutEngineInput): LayoutEngineOutput {
  const pagePurpose = (input.pagePurpose ?? "").trim() || "page";
  const audience = (input.audience ?? "").trim() || "visitor";
  const locale = input.locale === "en" ? "en" : "nb";
  const outputMode = input.output === "layout" || input.output === "grid" || input.output === "responsive" ? input.output : "all";
  const designedAt = new Date().toISOString();
  const parts: string[] = [];

  let layoutSpec: UILayoutSpecification | null = null;
  let gridConfig: GridLayoutConfiguration | null = null;
  let responsiveConfig: GenerateResponsiveLayoutOutput | null = null;

  const ifaceInput: GenerateInterfaceInput = {
    pagePurpose,
    audience,
    locale,
  };
  layoutSpec = generateInterface(ifaceInput);

  const sectionsForGrid: ContentSectionInput[] =
    Array.isArray(input.contentSections) && input.contentSections.length > 0
      ? input.contentSections
      : sectionSpecToContentSections(layoutSpec.sections);

  const responsiveSections: ResponsiveSectionInput[] = sectionsForGrid.map((s) => ({
    id: s.id,
    type: s.type ?? undefined,
  }));

  if (outputMode === "layout" || outputMode === "all") {
    parts.push(locale === "en" ? `Layout: ${layoutSpec.layoutType}, ${layoutSpec.sections.length} section(s).` : `Layout: ${layoutSpec.layoutType}, ${layoutSpec.sections.length} seksjon(er).`);
  }

  if (outputMode === "grid" || outputMode === "all") {
    const gridInput: GenerateLayoutInput = {
      pagePurpose,
      contentSections: sectionsForGrid,
      columns: input.columns ?? layoutSpec.gridColumns ?? 12,
      locale,
    };
    gridConfig = generateLayout(gridInput);
    parts.push(
      locale === "en"
        ? `Grid: ${gridConfig.columns} columns, ${gridConfig.placements.length} placement(s).`
        : `Grid: ${gridConfig.columns} kolonner, ${gridConfig.placements.length} plassering(er).`
    );
  }

  if (outputMode === "responsive" || outputMode === "all") {
    const respInput: GenerateResponsiveLayoutInput = {
      contentSections: responsiveSections,
      pagePurpose,
      locale,
    };
    responsiveConfig = generateResponsiveLayout(respInput);
    parts.push(
      locale === "en"
        ? `Responsive: desktop ${responsiveConfig.desktop.columns}col, tablet ${responsiveConfig.tablet.columns}col, mobile ${responsiveConfig.mobile.columns}col.`
        : `Responsiv: desktop ${responsiveConfig.desktop.columns} kol, tablet ${responsiveConfig.tablet.columns} kol, mobil ${responsiveConfig.mobile.columns} kol.`
    );
  }

  const summary = parts.length > 0 ? parts.join(" ") : (locale === "en" ? "Layout engine: no output selected." : "Layout-engine: ingen utdata valgt.");

  return {
    ...(layoutSpec !== null && { layout: layoutSpec }),
    ...(gridConfig !== null && { grid: gridConfig }),
    ...(responsiveConfig !== null && { responsive: responsiveConfig }),
    summary,
    designedAt,
  };
}
