/**
 * Adaptive page layout engine capability: adaptLayoutInRealtime.
 * Suggests layout adaptations from viewport, device, and current layout/blocks for real-time adaptation.
 * Deterministic; no LLM. Complements optimizeResponsiveLayout (static optimizations).
 * Import this module to register the capability.
 */

import type { Capability } from "../../capabilityRegistry";
import { registerCapability } from "../../capabilityRegistry";

const CAPABILITY_NAME = "adaptLayoutInRealtime";

const adaptLayoutInRealtimeCapability: Capability = {
  name: CAPABILITY_NAME,
  description:
    "Adaptive layout engine: from viewport size, device type, and current layout/blocks, suggests real-time adaptations (show/hide/reorder/stack, breakpoint). Returns adaptations list and layout hints. Deterministic; no LLM.",
  requiredContext: [],
  inputSchema: {
    type: "object",
    description: "Adapt layout in realtime input",
    properties: {
      viewport: {
        type: "object",
        description: "Current viewport",
        properties: {
          width: { type: "number", description: "px" },
          height: { type: "number", description: "px" },
          orientation: { type: "string", enum: ["portrait", "landscape"] },
        },
      },
      deviceType: {
        type: "string",
        enum: ["mobile", "tablet", "desktop"],
        description: "Device class",
      },
      blocks: {
        type: "array",
        description: "Current layout blocks/sections",
        items: {
          type: "object",
          properties: {
            id: { type: "string" },
            type: { type: "string", description: "e.g. hero, nav, content, sidebar, cta" },
            order: { type: "number" },
            visibleByDefault: { type: "boolean" },
            priority: { type: "number", description: "1-10, higher = keep visible on small viewports" },
          },
        },
      },
      locale: { type: "string", enum: ["nb", "en"] },
    },
    required: ["viewport", "deviceType"],
  },
  outputSchema: {
    type: "object",
    description: "Layout adaptation result",
    required: ["adaptations", "effectiveBreakpoint", "layoutHints", "summary", "generatedAt"],
    properties: {
      adaptations: {
        type: "array",
        items: {
          type: "object",
          required: ["blockId", "action", "reason"],
          properties: {
            blockId: { type: "string" },
            action: { type: "string", enum: ["show", "hide", "stack", "reorder", "full_width"] },
            reason: { type: "string" },
            order: { type: "number" },
          },
        },
      },
      effectiveBreakpoint: { type: "string", description: "e.g. mobile, tablet, desktop" },
      layoutHints: { type: "array", items: { type: "string" } },
      summary: { type: "string" },
      generatedAt: { type: "string", description: "ISO timestamp" },
    },
  },
  safetyConstraints: [
    { code: "read_only", description: "Output is suggestion only; no layout or DOM mutation.", enforce: "hard" },
  ],
  targetSurfaces: ["backoffice", "api", "editor"],
};

registerCapability(adaptLayoutInRealtimeCapability);

const WIDTH_MOBILE = 640;
const WIDTH_TABLET = 1024;

function safeStr(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

export type ViewportInput = {
  width?: number | null;
  height?: number | null;
  orientation?: "portrait" | "landscape" | null;
};

export type LayoutBlockInput = {
  id: string;
  type?: string | null;
  order?: number | null;
  visibleByDefault?: boolean | null;
  priority?: number | null;
};

export type AdaptLayoutInRealtimeInput = {
  viewport: ViewportInput;
  deviceType: "mobile" | "tablet" | "desktop";
  blocks?: LayoutBlockInput[] | null;
  locale?: "nb" | "en" | null;
};

export type LayoutAdaptation = {
  blockId: string;
  action: "show" | "hide" | "stack" | "reorder" | "full_width";
  reason: string;
  order?: number;
};

export type AdaptLayoutInRealtimeOutput = {
  adaptations: LayoutAdaptation[];
  effectiveBreakpoint: string;
  layoutHints: string[];
  summary: string;
  generatedAt: string;
};

function effectiveBreakpoint(width: number): "mobile" | "tablet" | "desktop" {
  if (width < WIDTH_MOBILE) return "mobile";
  if (width < WIDTH_TABLET) return "tablet";
  return "desktop";
}

/**
 * Suggests layout adaptations from viewport and blocks. Deterministic; no external calls.
 */
export function adaptLayoutInRealtime(input: AdaptLayoutInRealtimeInput): AdaptLayoutInRealtimeOutput {
  const isEn = input.locale === "en";
  const vp = input.viewport && typeof input.viewport === "object" ? input.viewport : {};
  const width = typeof vp.width === "number" && vp.width > 0 ? vp.width : 1024;
  const deviceType = input.deviceType ?? (width < WIDTH_TABLET ? "tablet" : "desktop");
  const effective = effectiveBreakpoint(width);

  const blocks = Array.isArray(input.blocks)
    ? input.blocks.filter((b) => b && typeof b === "object" && safeStr(b.id)).slice(0, 20)
    : [];
  const sortedBlocks = [...blocks].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  const adaptations: LayoutAdaptation[] = [];
  const layoutHints: string[] = [];

  if (effective === "mobile") {
    layoutHints.push(isEn ? "Single column; no horizontal scroll (AGENTS.md S1)." : "Enkel kolonne; ingen horisontal scroll (AGENTS.md S1).");
    layoutHints.push(isEn ? "Touch targets ≥ 44px." : "Touch-mål ≥ 44px.");
    const priorityOrder = [...sortedBlocks].sort((a, b) => (b.priority ?? 5) - (a.priority ?? 5));
    const keepVisible = Math.max(1, Math.min(5, Math.ceil(sortedBlocks.length * 0.6)));
    for (let i = 0; i < sortedBlocks.length; i++) {
      const b = sortedBlocks[i];
      const id = safeStr(b.id);
      const keep = priorityOrder.indexOf(b) < keepVisible || (b.priority ?? 5) >= 7;
      if (keep) {
        adaptations.push({
          blockId: id,
          action: "stack",
          reason: isEn ? "Mobile: stack in single column." : "Mobil: stakk i en kolonne.",
          order: i + 1,
        });
      } else {
        adaptations.push({
          blockId: id,
          action: "hide",
          reason: isEn ? "Mobile: hide lower-priority block to reduce scroll." : "Mobil: skjul blokk med lavere prioritet for mindre scroll.",
        });
      }
    }
    for (const b of sortedBlocks) {
      const id = safeStr(b.id);
      const t = (b.type ?? "").toLowerCase();
      if (t === "sidebar" || t === "secondary") {
        const existing = adaptations.find((a) => a.blockId === id);
        if (!existing || existing.action !== "hide") {
          const idx = adaptations.findIndex((a) => a.blockId === id);
          if (idx >= 0) adaptations[idx] = { blockId: id, action: "hide", reason: isEn ? "Sidebar hidden on mobile." : "Sidebar skjult på mobil." };
          else adaptations.push({ blockId: id, action: "hide", reason: isEn ? "Sidebar hidden on mobile." : "Sidebar skjult på mobil." });
        }
      }
    }
  } else if (effective === "tablet") {
    layoutHints.push(isEn ? "Two columns where space allows; stack below breakpoint." : "To kolonner der plass tillater; stakk under breakpoint.");
    for (let i = 0; i < sortedBlocks.length; i++) {
      const b = sortedBlocks[i];
      const id = safeStr(b.id);
      const t = (b.type ?? "").toLowerCase();
      if (t === "sidebar") {
        adaptations.push({ blockId: id, action: "stack", reason: isEn ? "Tablet: sidebar below main or narrow column." : "Tablet: sidebar under hovedinnhold eller smal kolonne.", order: i + 1 });
      } else {
        adaptations.push({ blockId: id, action: "stack", reason: isEn ? "Tablet: flexible grid." : "Tablet: fleksibel grid.", order: i + 1 });
      }
    }
  } else {
    layoutHints.push(isEn ? "Desktop: full layout; max-width 1440px (AGENTS.md G7)." : "Desktop: full layout; max-width 1440px (AGENTS.md G7).");
    for (let i = 0; i < sortedBlocks.length; i++) {
      const b = sortedBlocks[i];
      adaptations.push({
        blockId: safeStr(b.id),
        action: "show",
        reason: isEn ? "Desktop: show all blocks." : "Desktop: vis alle blokker.",
        order: i + 1,
      });
    }
  }

  const summary = isEn
    ? `Layout adapted for ${effective} (${width}px). ${adaptations.length} adaptation(s).`
    : `Layout tilpasset for ${effective} (${width}px). ${adaptations.length} tilpasning(er).`;

  return {
    adaptations,
    effectiveBreakpoint: effective,
    layoutHints,
    summary,
    generatedAt: new Date().toISOString(),
  };
}

export { adaptLayoutInRealtimeCapability, CAPABILITY_NAME };
