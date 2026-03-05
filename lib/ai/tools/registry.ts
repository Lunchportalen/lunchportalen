/**
 * Phase 36: AI Tool Registry - single source of truth for tool IDs and governance.
 * Used by /api/backoffice/ai/suggest for validation, rate limits, and patch constraints.
 */

export const AI_TOOL_IDS = [
  "landing.generate.sections",
  "i18n.translate.blocks",
  "seo.optimize.page",
  "content.maintain.page",
  "experiment.generate.variants",
  "image.generate.brand_safe",
  "image.improve.metadata",
] as const;

export type ToolId = (typeof AI_TOOL_IDS)[number];

export type ToolPolicy = {
  role: "superadmin";
  patchAllowed: boolean;
  maxOps: number | null;
  rateLimit: { windowSeconds: number; max: number } | null;
  docs: {
    title: string;
    description: string;
    outputs: ("patch" | "metaSuggestion" | "candidates" | "variants" | "issues")[];
  };
  input: {
    expectsBlocks?: boolean;
    expectsExistingBlocks?: boolean;
    expectsMedia?: boolean;
  };
};

export const AI_TOOLS: Record<ToolId, ToolPolicy> = {
  "landing.generate.sections": {
    role: "superadmin",
    patchAllowed: true,
    maxOps: 20,
    rateLimit: { windowSeconds: 3600, max: 30 },
    docs: { title: "Landing page generator", description: "Generates hero, richText, and CTA blocks.", outputs: ["patch"] },
    input: { expectsExistingBlocks: true },
  },
  "i18n.translate.blocks": {
    role: "superadmin",
    patchAllowed: true,
    maxOps: 20,
    rateLimit: { windowSeconds: 3600, max: 60 },
    docs: { title: "Block translation", description: "Translates allowlisted block text (optional patch).", outputs: ["patch"] },
    input: { expectsBlocks: true },
  },
  "seo.optimize.page": {
    role: "superadmin",
    patchAllowed: true,
    maxOps: 10,
    rateLimit: { windowSeconds: 3600, max: 60 },
    docs: { title: "SEO optimizer", description: "Meta and block SEO (optional patch).", outputs: ["patch", "metaSuggestion"] },
    input: { expectsBlocks: true },
  },
  "content.maintain.page": {
    role: "superadmin",
    patchAllowed: true,
    maxOps: 20,
    rateLimit: { windowSeconds: 3600, max: 60 },
    docs: { title: "Content maintenance", description: "Content decay fixes (optional patch).", outputs: ["patch", "metaSuggestion", "issues"] },
    input: { expectsBlocks: true },
  },
  "experiment.generate.variants": {
    role: "superadmin",
    patchAllowed: true,
    maxOps: 10,
    rateLimit: { windowSeconds: 3600, max: 20 },
    docs: { title: "A/B variant generator", description: "2-3 hero/CTA variants.", outputs: ["patch", "variants"] },
    input: { expectsBlocks: true },
  },
  "image.generate.brand_safe": {
    role: "superadmin",
    patchAllowed: false,
    maxOps: null,
    rateLimit: { windowSeconds: 3600, max: 30 },
    docs: { title: "Brand-safe image generator", description: "Media candidates.", outputs: ["candidates"] },
    input: { expectsMedia: true },
  },
  "image.improve.metadata": {
    role: "superadmin",
    patchAllowed: false,
    maxOps: null,
    rateLimit: { windowSeconds: 3600, max: 60 },
    docs: { title: "Image metadata improve", description: "Alt/caption/tags via media PATCH.", outputs: [] },
    input: { expectsMedia: true },
  },
};

export function getToolPolicy(tool: string): ToolPolicy | null {
  if (AI_TOOL_IDS.includes(tool as ToolId)) return AI_TOOLS[tool as ToolId];
  return null;
}

export function assertToolId(tool: string): tool is ToolId {
  return AI_TOOL_IDS.includes(tool as ToolId);
}