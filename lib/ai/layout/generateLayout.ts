/**
 * Layout generation engine: produces a grid layout configuration from page purpose and content sections.
 * Deterministic; no LLM. Use for backoffice/editor layout suggestions and page composition.
 */

export type ContentSectionInput = {
  /** Unique section identifier (e.g. block id or key). */
  id: string;
  /** Section type (e.g. hero, richText, cta, faq, features). Used to choose span/placement. */
  type?: string | null;
  /** Optional priority (higher = earlier in layout). */
  priority?: number | null;
};

export type GenerateLayoutInput = {
  /** Page purpose (e.g. landing, product, blog, dashboard, marketing). */
  pagePurpose: string;
  /** Ordered list of content sections to place in the grid. */
  contentSections: ContentSectionInput[];
  /** Grid column count (default 12). */
  columns?: number | null;
  /** Locale for optional labels (nb | en). */
  locale?: "nb" | "en" | null;
};

/** A single cell placement in the grid. */
export type GridCellPlacement = {
  sectionId: string;
  rowIndex: number;
  columnStart: number;
  columnSpan: number;
  rowSpan: number;
};

export type GridLayoutConfiguration = {
  columns: number;
  rows: number;
  gap: string;
  /** Placements in row-major order (rowIndex, then columnStart). */
  placements: GridCellPlacement[];
  /** Optional template name derived from page purpose. */
  template?: string;
};

const DEFAULT_COLUMNS = 12;
const DEFAULT_GAP = "1.5rem";

/** Default column spans by section type (full width = columns). */
const SPAN_BY_TYPE: Record<string, number> = {
  hero: 12,
  cta: 12,
  footer: 12,
  fullWidth: 12,
  richText: 12,
  intro: 12,
  features: 12,
  faq: 12,
  valueProps: 12,
  half: 6,
  third: 4,
  quarter: 3,
  twoThirds: 8,
  oneThird: 4,
};

function spanForType(type: string | undefined, columns: number): number {
  if (!type) return columns;
  const lower = type.trim().toLowerCase();
  const span = SPAN_BY_TYPE[lower] ?? SPAN_BY_TYPE.richText ?? columns;
  return Math.min(columns, Math.max(1, span));
}

/**
 * Generates a grid layout configuration from page purpose and content sections.
 * Sections are placed in order; each section gets a row (or shares a row if total span fits).
 * Deterministic; no external calls.
 */
export function generateLayout(input: GenerateLayoutInput): GridLayoutConfiguration {
  const purpose = (input.pagePurpose ?? "").trim().toLowerCase() || "page";
  const columns =
    typeof input.columns === "number" && !Number.isNaN(input.columns) && input.columns >= 1
      ? Math.min(24, Math.floor(input.columns))
      : DEFAULT_COLUMNS;

  const sections = Array.isArray(input.contentSections)
    ? input.contentSections
        .filter((s): s is ContentSectionInput => s != null && typeof s === "object" && typeof (s as ContentSectionInput).id === "string")
        .map((s) => ({
          id: String((s as ContentSectionInput).id).trim(),
          type: typeof (s as ContentSectionInput).type === "string" ? (s as ContentSectionInput).type : undefined,
          priority: typeof (s as ContentSectionInput).priority === "number" && !Number.isNaN((s as ContentSectionInput).priority) ? (s as ContentSectionInput).priority! : 0,
        }))
        .sort((a, b) => b.priority - a.priority)
    : [];

  const placements: GridCellPlacement[] = [];
  let rowIndex = 0;
  let columnCursor = 0;

  for (const section of sections) {
    const span = spanForType(section.type, columns);

    if (columnCursor + span > columns && columnCursor > 0) {
      rowIndex += 1;
      columnCursor = 0;
    }

    placements.push({
      sectionId: section.id,
      rowIndex,
      columnStart: columnCursor,
      columnSpan: span,
      rowSpan: 1,
    });

    columnCursor += span;
    if (columnCursor >= columns) {
      columnCursor = 0;
      rowIndex += 1;
    }
  }

  const rowCount = placements.length === 0 ? 0 : Math.max(...placements.map((p) => p.rowIndex)) + 1;

  const template =
    purpose === "landing"
      ? "landing"
      : purpose === "product"
        ? "product"
        : purpose === "blog"
          ? "blog"
          : purpose === "dashboard"
            ? "dashboard"
            : purpose === "marketing"
              ? "marketing"
              : "default";

  return {
    columns,
    rows: rowCount,
    gap: DEFAULT_GAP,
    placements,
    template,
  };
}
