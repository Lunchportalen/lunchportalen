/**
 * AI responsive layout generator capability: generateResponsiveLayout.
 * Generates desktop, tablet, and mobile layout configurations from content sections.
 * Deterministic; no LLM. Import this module to register the capability.
 */

import type { Capability } from "../capabilityRegistry";
import { registerCapability } from "../capabilityRegistry";

const CAPABILITY_NAME = "generateResponsiveLayout";

const generateResponsiveLayoutCapability: Capability = {
  name: CAPABILITY_NAME,
  description:
    "Generates responsive layout configurations: desktop, tablet, and mobile. Each breakpoint has columns, placements (sectionId, row, column, span), and gap. Sections stack or reflow by viewport.",
  requiredContext: ["contentSections"],
  inputSchema: {
    type: "object",
    description: "Responsive layout input",
    properties: {
      contentSections: {
        type: "array",
        description: "Sections to place (id, type)",
        items: {
          type: "object",
          properties: {
            id: { type: "string" },
            type: { type: "string", description: "hero, features, cta, faq, richText, half, third, etc." },
          },
        },
      },
      pagePurpose: { type: "string", description: "Optional: landing, product, blog" },
      locale: { type: "string", description: "Locale (nb | en) for summary" },
    },
    required: ["contentSections"],
  },
  outputSchema: {
    type: "object",
    description: "Responsive layouts",
    required: ["desktop", "tablet", "mobile", "breakpoints", "summary"],
    properties: {
      desktop: {
        type: "object",
        required: ["columns", "placements", "gap"],
        properties: {
          columns: { type: "number" },
          placements: {
            type: "array",
            items: {
              type: "object",
              required: ["sectionId", "rowIndex", "columnStart", "columnSpan", "rowSpan"],
              properties: {
                sectionId: { type: "string" },
                rowIndex: { type: "number" },
                columnStart: { type: "number" },
                columnSpan: { type: "number" },
                rowSpan: { type: "number" },
              },
            },
          },
          gap: { type: "string" },
        },
      },
      tablet: {
        type: "object",
        required: ["columns", "placements", "gap"],
        properties: {
          columns: { type: "number" },
          placements: { type: "array", items: { type: "object" } },
          gap: { type: "string" },
        },
      },
      mobile: {
        type: "object",
        required: ["columns", "placements", "gap"],
        properties: {
          columns: { type: "number" },
          placements: { type: "array", items: { type: "object" } },
          gap: { type: "string" },
        },
      },
      breakpoints: {
        type: "object",
        required: ["tablet", "mobile"],
        properties: {
          tablet: { type: "string", description: "e.g. 768px or 48rem" },
          mobile: { type: "string", description: "e.g. 1024px / 640px" },
        },
      },
      summary: { type: "string" },
    },
  },
  safetyConstraints: [
    { code: "suggestions_only", description: "Output is layout config only; no content or system mutation.", enforce: "hard" },
  ],
  targetSurfaces: ["backoffice", "editor", "api"],
};

registerCapability(generateResponsiveLayoutCapability);

export type ResponsiveSectionInput = {
  id: string;
  type?: string | null;
};

export type GenerateResponsiveLayoutInput = {
  contentSections: ResponsiveSectionInput[];
  pagePurpose?: string | null;
  locale?: "nb" | "en" | null;
};

export type Placement = {
  sectionId: string;
  rowIndex: number;
  columnStart: number;
  columnSpan: number;
  rowSpan: number;
};

export type BreakpointLayout = {
  columns: number;
  placements: Placement[];
  gap: string;
};

export type GenerateResponsiveLayoutOutput = {
  desktop: BreakpointLayout;
  tablet: BreakpointLayout;
  mobile: BreakpointLayout;
  breakpoints: { tablet: string; mobile: string };
  summary: string;
};

const DESKTOP_COLUMNS = 12;
const TABLET_COLUMNS = 8;
const MOBILE_COLUMNS = 4;
const GAP = "1.5rem";
const BREAKPOINT_TABLET = "768px";
const BREAKPOINT_MOBILE = "1024px";

/** Column span by section type per breakpoint. desktop, tablet, mobile. */
function getSpans(type: string | undefined): { desktop: number; tablet: number; mobile: number } {
  const t = (type ?? "").trim().toLowerCase();
  const full = { desktop: DESKTOP_COLUMNS, tablet: TABLET_COLUMNS, mobile: MOBILE_COLUMNS };
  const half = { desktop: 6, tablet: 4, mobile: MOBILE_COLUMNS };
  const third = { desktop: 4, tablet: 4, mobile: MOBILE_COLUMNS };
  const quarter = { desktop: 3, tablet: 4, mobile: MOBILE_COLUMNS };
  const twoThirds = { desktop: 8, tablet: 8, mobile: MOBILE_COLUMNS };
  const oneThird = { desktop: 4, tablet: 4, mobile: MOBILE_COLUMNS };

  switch (t) {
    case "hero":
    case "cta":
    case "footer":
    case "fullwidth":
    case "richtext":
    case "intro":
    case "features":
    case "faq":
    case "valueprops":
    case "social_proof":
      return full;
    case "half":
      return half;
    case "third":
      return third;
    case "quarter":
      return quarter;
    case "twothirds":
      return twoThirds;
    case "onethird":
      return oneThird;
    default:
      return full;
  }
}

function buildPlacements(
  sections: Array<{ id: string; type?: string | null }>,
  columns: number,
  getSpan: (type: string | undefined) => number
): Placement[] {
  const placements: Placement[] = [];
  let rowIndex = 0;
  let columnCursor = 0;

  for (const s of sections) {
    const span = Math.min(columns, Math.max(1, getSpan(s.type)));

    if (columnCursor + span > columns && columnCursor > 0) {
      rowIndex += 1;
      columnCursor = 0;
    }

    placements.push({
      sectionId: s.id,
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
  return placements;
}

/**
 * Generates desktop, tablet, and mobile layout configurations. Deterministic; no external calls.
 */
export function generateResponsiveLayout(input: GenerateResponsiveLayoutInput): GenerateResponsiveLayoutOutput {
  const isEn = input.locale === "en";
  const sections = Array.isArray(input.contentSections)
    ? input.contentSections
        .filter((x): x is ResponsiveSectionInput => x != null && typeof x === "object" && typeof (x as ResponsiveSectionInput).id === "string")
        .map((x) => ({ id: String((x as ResponsiveSectionInput).id).trim(), type: (x as ResponsiveSectionInput).type ?? undefined }))
        .filter((x) => x.id.length > 0)
    : [];

  const desktop = {
    columns: DESKTOP_COLUMNS,
    placements: buildPlacements(sections, DESKTOP_COLUMNS, (t) => getSpans(t).desktop),
    gap: GAP,
  };

  const tablet = {
    columns: TABLET_COLUMNS,
    placements: buildPlacements(sections, TABLET_COLUMNS, (t) => getSpans(t).tablet),
    gap: GAP,
  };

  const mobile = {
    columns: MOBILE_COLUMNS,
    placements: buildPlacements(sections, MOBILE_COLUMNS, (t) => getSpans(t).mobile),
    gap: GAP,
  };

  const summary = isEn
    ? `Responsive layout: desktop ${DESKTOP_COLUMNS}col, tablet ${TABLET_COLUMNS}col, mobile ${MOBILE_COLUMNS}col; ${sections.length} section(s).`
    : `Responsiv layout: desktop ${DESKTOP_COLUMNS} kol, tablet ${TABLET_COLUMNS} kol, mobil ${MOBILE_COLUMNS} kol; ${sections.length} seksjon(er).`;

  return {
    desktop,
    tablet,
    mobile,
    breakpoints: { tablet: BREAKPOINT_TABLET, mobile: BREAKPOINT_MOBILE },
    summary,
  };
}

export { generateResponsiveLayoutCapability, CAPABILITY_NAME };
