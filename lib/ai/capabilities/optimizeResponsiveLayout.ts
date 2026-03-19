/**
 * Responsive design optimizer capability: optimizeResponsiveLayout.
 * Analyzes layout (breakpoints, columns, sections) and suggests optimizations for
 * mobile, tablet, and desktop: breakpoints, stacking, touch targets, spacing, max-width. Deterministic; no LLM.
 * Import this module to register the capability.
 */

import type { Capability } from "../capabilityRegistry";
import { registerCapability } from "../capabilityRegistry";

const CAPABILITY_NAME = "optimizeResponsiveLayout";

const optimizeResponsiveLayoutCapability: Capability = {
  name: CAPABILITY_NAME,
  description:
    "Responsive design optimizer: from layout (breakpoints, columns, sections, placements), suggests optimizations for mobile, tablet, and desktop: breakpoint values, column stacking, touch target size, spacing/gap, and max-width. Returns prioritized suggestions with current/recommended values. Deterministic; no LLM.",
  requiredContext: [],
  inputSchema: {
    type: "object",
    description: "Optimize responsive layout input",
    properties: {
      layout: {
        type: "object",
        description: "Current layout to optimize",
        properties: {
          breakpoints: {
            type: "object",
            properties: {
              mobile: { type: "string", description: "e.g. 640px" },
              tablet: { type: "string", description: "e.g. 768px" },
              desktop: { type: "string", description: "e.g. 1024px" },
            },
          },
          columns: { type: "number", description: "Desktop grid columns (e.g. 12)" },
          gap: { type: "string", description: "CSS gap (e.g. 1rem)" },
          maxWidth: { type: "string", description: "Max content width (e.g. 1200px)" },
          sections: {
            type: "array",
            items: {
              type: "object",
              properties: {
                id: { type: "string" },
                columnSpan: { type: "number" },
                columnSpanMobile: { type: "number" },
                minHeight: { type: "string" },
              },
            },
          },
          placements: {
            type: "array",
            items: {
              type: "object",
              properties: {
                sectionId: { type: "string" },
                columnSpan: { type: "number" },
                rowIndex: { type: "number" },
              },
            },
          },
        },
      },
      targetDevices: {
        type: "array",
        description: "Focus on these devices (mobile, tablet, desktop)",
        items: { type: "string" },
      },
      locale: { type: "string", description: "Locale (nb | en) for messages" },
    },
    required: ["layout"],
  },
  outputSchema: {
    type: "object",
    description: "Responsive layout optimization result",
    required: ["optimizations", "summary", "generatedAt"],
    properties: {
      optimizations: {
        type: "array",
        items: {
          type: "object",
          required: ["id", "type", "suggestion", "priority", "device"],
          properties: {
            id: { type: "string" },
            type: {
              type: "string",
              enum: ["breakpoint", "stacking", "touch_target", "spacing", "max_width", "gap"],
            },
            device: { type: "string", description: "mobile | tablet | desktop | all" },
            suggestion: { type: "string" },
            priority: { type: "string", enum: ["high", "medium", "low"] },
            currentValue: { type: "string" },
            recommendedValue: { type: "string" },
          },
        },
      },
      summary: { type: "string" },
      generatedAt: { type: "string", description: "ISO timestamp" },
    },
  },
  safetyConstraints: [
    { code: "suggestions_only", description: "Output is optimization suggestions only; no layout or system mutation.", enforce: "hard" },
  ],
  targetSurfaces: ["backoffice", "editor", "api"],
};

registerCapability(optimizeResponsiveLayoutCapability);

export type LayoutInput = {
  breakpoints?: {
    mobile?: string | null;
    tablet?: string | null;
    desktop?: string | null;
  } | null;
  columns?: number | null;
  gap?: string | null;
  maxWidth?: string | null;
  sections?: Array<{
    id?: string | null;
    columnSpan?: number | null;
    columnSpanMobile?: number | null;
    minHeight?: string | null;
  }> | null;
  placements?: Array<{
    sectionId?: string | null;
    columnSpan?: number | null;
    rowIndex?: number | null;
  }> | null;
};

export type OptimizeResponsiveLayoutInput = {
  layout: LayoutInput;
  targetDevices?: string[] | null;
  locale?: "nb" | "en" | null;
};

export type LayoutOptimization = {
  id: string;
  type: "breakpoint" | "stacking" | "touch_target" | "spacing" | "max_width" | "gap";
  device: string;
  suggestion: string;
  priority: "high" | "medium" | "low";
  currentValue?: string | null;
  recommendedValue?: string | null;
};

export type OptimizeResponsiveLayoutOutput = {
  optimizations: LayoutOptimization[];
  summary: string;
  generatedAt: string;
};

function safeStr(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function parsePx(s: string | null | undefined): number {
  if (!s) return 0;
  const m = String(s).trim().match(/^([\d.]+)\s*px$/i);
  if (m) return Number(m[1]);
  const rem = String(s).trim().match(/^([\d.]+)\s*rem$/i);
  if (rem) return Number(rem[1]) * 16;
  return 0;
}

/**
 * Suggests responsive layout optimizations. Deterministic; no external calls.
 */
export function optimizeResponsiveLayout(input: OptimizeResponsiveLayoutInput): OptimizeResponsiveLayoutOutput {
  const layout = input.layout && typeof input.layout === "object" ? input.layout : {};
  const targetDevices = new Set(
    Array.isArray(input.targetDevices) ? input.targetDevices.map((d) => String(d).toLowerCase()) : ["mobile", "tablet", "desktop"]
  );
  const isEn = input.locale === "en";

  const optimizations: LayoutOptimization[] = [];
  const bp = layout.breakpoints && typeof layout.breakpoints === "object" ? layout.breakpoints : {};
  const mobileBp = safeStr(bp.mobile);
  const tabletBp = safeStr(bp.tablet);
  const desktopBp = safeStr(bp.desktop);
  const gap = safeStr(layout.gap);
  const maxWidth = safeStr(layout.maxWidth);
  const columns = Math.max(1, Math.min(24, Number(layout.columns) || 12));
  const sections = Array.isArray(layout.sections) ? layout.sections : [];

  function add(
    id: string,
    type: LayoutOptimization["type"],
    device: string,
    suggestion: string,
    priority: LayoutOptimization["priority"],
    current?: string | null,
    recommended?: string | null
  ) {
    if (device !== "all" && !targetDevices.has(device)) return;
    optimizations.push({
      id: `${type}_${id}`,
      type,
      device,
      suggestion,
      priority,
      currentValue: current ?? undefined,
      recommendedValue: recommended ?? undefined,
    });
  }

  if (!mobileBp) {
    add(
      "mobile_breakpoint",
      "breakpoint",
      "mobile",
      isEn ? "Define a mobile breakpoint (e.g. 640px) for single-column stacking." : "Definer et mobil- breakpoint (f.eks. 640px) for enkelkolonner.",
      "high",
      null,
      "640px"
    );
  } else {
    const px = parsePx(mobileBp);
    if (px > 0 && px < 480) {
      add("mobile_breakpoint_low", "breakpoint", "mobile", isEn ? "Mobile breakpoint is very low; consider 640px for phones." : "Mobil-breakpoint er svært lavt; vurder 640px for telefoner.", "medium", mobileBp, "640px");
    }
    if (px > 800) {
      add("mobile_breakpoint_high", "breakpoint", "mobile", isEn ? "Mobile breakpoint is high; content may not stack early enough." : "Mobil-breakpoint er høyt; innhold kan bli for bredt på små skjermer.", "medium", mobileBp, "640px");
    }
  }

  if (!tabletBp) {
    add(
      "tablet_breakpoint",
      "breakpoint",
      "tablet",
      isEn ? "Define a tablet breakpoint (e.g. 768px or 1024px)." : "Definer et tablet-breakpoint (f.eks. 768px eller 1024px).",
      "medium",
      null,
      "768px"
    );
  }

  if (!desktopBp && targetDevices.has("desktop")) {
    add(
      "desktop_breakpoint",
      "breakpoint",
      "desktop",
      isEn ? "Define a desktop breakpoint (e.g. 1024px) for full grid." : "Definer et desktop-breakpoint (f.eks. 1024px) for full rute.",
      "low",
      null,
      "1024px"
    );
  }

  add(
    "stacking_mobile",
    "stacking",
    "mobile",
    isEn ? "Use single column (columnSpan = grid width) on mobile to avoid horizontal scroll." : "Bruk én kolonne (columnSpan = rutebredde) på mobil for å unngå horisontal scroll.",
    "high",
    null,
    "columnSpanMobile: 1 or full width"
  );

  add(
    "touch_target",
    "touch_target",
    "mobile",
    isEn ? "Ensure interactive elements have min 44×44px touch targets on mobile." : "Sikre at interaktive elementer har minst 44×44px touch-mål på mobil.",
    "high",
    null,
    "min-height: 44px; min-width: 44px"
  );

  if (!gap || parsePx(gap) === 0) {
    add("gap_missing", "gap", "all", isEn ? "Add a consistent gap between grid items (e.g. 1rem or 1.5rem)." : "Legg til jevn gap mellom ruteelementer (f.eks. 1rem eller 1.5rem).", "medium", gap || "none", "1rem");
  } else {
    const gapPx = parsePx(gap) || (gap.includes("rem") ? 16 : 0);
    if (gapPx > 0 && gapPx < 8) {
      add("gap_small", "gap", "all", isEn ? "Gap is small; consider 16px (1rem) or more for breathing room." : "Gap er liten; vurder 16px (1rem) eller mer for luft.", "low", gap, "1rem");
    }
  }

  if (!maxWidth && targetDevices.has("desktop")) {
    add(
      "max_width",
      "max_width",
      "desktop",
      isEn ? "Set max-width on main content (e.g. 1200px or 1440px) for readability." : "Sett max-width på hovedinnhold (f.eks. 1200px eller 1440px) for lesbarhet.",
      "medium",
      null,
      "1200px"
    );
  }

  const multiColSections = sections.filter((s) => (Number(s.columnSpan) || 0) > 1 && (Number(s.columnSpanMobile) || 0) > 1);
  if (multiColSections.length > 0) {
    add(
      "stacking_sections",
      "stacking",
      "mobile",
      isEn ? `${multiColSections.length} section(s) may need columnSpanMobile: 1 for mobile.` : `${multiColSections.length} seksjon(er) bør ha columnSpanMobile: 1 på mobil.`,
      "high",
      null,
      "columnSpanMobile: 1"
    );
  }

  optimizations.sort((a, b) => {
    const p = { high: 0, medium: 1, low: 2 };
    return p[a.priority] - p[b.priority];
  });

  const summary = isEn
    ? `Suggested ${optimizations.length} responsive layout optimization(s) for ${Array.from(targetDevices).join(", ")}.`
    : `Foreslo ${optimizations.length} responsive layout-optimalisering(er) for ${Array.from(targetDevices).join(", ")}.`;

  return {
    optimizations,
    summary,
    generatedAt: new Date().toISOString(),
  };
}

export { optimizeResponsiveLayoutCapability, CAPABILITY_NAME };
