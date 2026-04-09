/**
 * Navigation auto-builder capability: generateNavigation.
 * Builds primary and optional secondary navigation from a list of pages (path, title).
 * Orders items (home first, then by priority/order, then by path), caps primary size, adds standard footer items.
 * Deterministic; no LLM. Import this module to register the capability.
 */

import type { Capability } from "../../capabilityRegistry";
import { registerCapability } from "../../capabilityRegistry";

const CAPABILITY_NAME = "generateNavigation";

const generateNavigationCapability: Capability = {
  name: CAPABILITY_NAME,
  description:
    "Navigation auto-builder: builds primary and optional secondary navigation from a list of pages (path, title). Returns ordered primary nav (label, path, order), optional secondary/footer nav, and summary. Deterministic; no LLM.",
  requiredContext: ["pages"],
  inputSchema: {
    type: "object",
    description: "Generate navigation input",
    properties: {
      pages: {
        type: "array",
        description: "Pages to include in navigation (path, title, optional order/priority)",
        items: {
          type: "object",
          required: ["path", "title"],
          properties: {
            path: { type: "string", description: "Page path (e.g. /, /om-oss, /kontakt)" },
            title: { type: "string", description: "Display label for the link" },
            order: { type: "number", description: "Optional sort hint (lower = earlier)" },
            priority: { type: "string", description: "Optional: high | medium | low for ordering" },
          },
        },
      },
      locale: { type: "string", description: "Locale (nb | en) for footer labels" },
      maxPrimaryItems: { type: "number", description: "Max items in primary nav (default 7)" },
      includeSecondary: { type: "boolean", description: "Include secondary/footer nav (default true)" },
      secondaryPaths: {
        type: "array",
        description: "Optional extra paths for secondary nav (path, title); if empty, only standard legal links",
        items: {
          type: "object",
          properties: { path: { type: "string" }, title: { type: "string" } },
        },
      },
    },
    required: ["pages"],
  },
  outputSchema: {
    type: "object",
    description: "Generated navigation",
    required: ["primaryNavigation", "summary"],
    properties: {
      primaryNavigation: {
        type: "array",
        description: "Ordered primary nav items (label, path, order)",
        items: {
          type: "object",
          required: ["label", "path", "order"],
          properties: {
            label: { type: "string" },
            path: { type: "string" },
            order: { type: "number" },
          },
        },
      },
      secondaryNavigation: {
        type: "array",
        description: "Footer/secondary nav items",
        items: {
          type: "object",
          required: ["label", "path", "order"],
          properties: {
            label: { type: "string" },
            path: { type: "string" },
            order: { type: "number" },
          },
        },
      },
      summary: { type: "string" },
      generatedAt: { type: "string", description: "ISO timestamp" },
    },
  },
  safetyConstraints: [
    { code: "suggestions_only", description: "Output is navigation structure only; no content or system mutation.", enforce: "hard" },
  ],
  targetSurfaces: ["backoffice", "editor", "api"],
};

registerCapability(generateNavigationCapability);

export type GenerateNavigationPageInput = {
  path: string;
  title: string;
  order?: number | null;
  priority?: "high" | "medium" | "low" | string | null;
};

export type GenerateNavigationInput = {
  pages: GenerateNavigationPageInput[];
  locale?: "nb" | "en" | null;
  maxPrimaryItems?: number | null;
  includeSecondary?: boolean | null;
  secondaryPaths?: Array<{ path: string; title: string }> | null;
};

export type NavigationItem = {
  label: string;
  path: string;
  order: number;
};

export type GenerateNavigationOutput = {
  primaryNavigation: NavigationItem[];
  secondaryNavigation: NavigationItem[];
  summary: string;
  generatedAt: string;
};

function safeStr(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 };

/**
 * Builds primary and optional secondary navigation from page list. Deterministic; no external calls.
 */
export function generateNavigation(input: GenerateNavigationInput): GenerateNavigationOutput {
  const locale = input.locale === "en" ? "en" : "nb";
  const isEn = locale === "en";
  const maxPrimary = Math.min(15, Math.max(1, Math.floor(Number(input.maxPrimaryItems) ?? 7)));
  const includeSecondary = input.includeSecondary !== false;

  const raw = Array.isArray(input.pages)
    ? input.pages.filter(
        (p): p is GenerateNavigationPageInput =>
          p != null && typeof p === "object" && typeof (p as GenerateNavigationPageInput).path === "string"
      )
    : [];

  const seen = new Set<string>();
  const normalized: Array<{ path: string; title: string; order: number }> = [];
  for (const p of raw) {
    const path = safeStr(p.path) || "/";
    const normPath = path.replace(/\/$/, "") || "/";
    if (seen.has(normPath)) continue;
    seen.add(normPath);
    const title = safeStr(p.title) || (normPath === "/" ? (isEn ? "Home" : "Hjem") : normPath);
    const orderHint = typeof p.order === "number" ? p.order : undefined;
    const priority = p.priority != null ? String(p.priority).toLowerCase() : "medium";
    const priorityNum = priority in PRIORITY_ORDER ? (PRIORITY_ORDER as Record<string, number>)[priority] : 1;
    normalized.push({
      path: normPath,
      title,
      order: orderHint ?? (normPath === "/" ? -1 : priorityNum * 1000 + normalized.length),
    });
  }

  normalized.sort((a, b) => {
    if (a.path === "/") return -1;
    if (b.path === "/") return 1;
    if (a.order !== b.order) return a.order - b.order;
    return a.path.localeCompare(b.path, "en");
  });

  const primaryNavigation: NavigationItem[] = normalized.slice(0, maxPrimary).map((p, i) => ({
    label: p.title,
    path: p.path,
    order: i,
  }));

  const secondaryNavigation: NavigationItem[] = [];
  if (includeSecondary) {
    const standard = [
      { path: "/personvern", label: isEn ? "Privacy" : "Personvern" },
      { path: "/vilkar", label: isEn ? "Terms" : "Vilkår" },
    ];
    const extra = Array.isArray(input.secondaryPaths)
      ? input.secondaryPaths
          .filter((x) => x != null && typeof x === "object" && typeof (x as { path?: string }).path === "string")
          .map((x) => ({ path: String((x as { path: string }).path).trim(), label: String((x as { title?: string }).title ?? (x as { path: string }).path).trim() }))
          .filter((x) => x.path && !standard.some((s) => s.path === x.path))
      : [];
    let order = 0;
    for (const s of standard) {
      secondaryNavigation.push({ label: s.label, path: s.path, order: order++ });
    }
    for (const e of extra) {
      secondaryNavigation.push({ label: e.label, path: e.path, order: order++ });
    }
  }

  const summary = isEn
    ? `Primary nav: ${primaryNavigation.length} item(s). ${includeSecondary ? `Secondary: ${secondaryNavigation.length} item(s).` : "No secondary nav."}`
    : `Primær meny: ${primaryNavigation.length} element(er). ${includeSecondary ? `Sekundær: ${secondaryNavigation.length} element(er).` : "Ingen sekundær meny."}`;

  return {
    primaryNavigation,
    secondaryNavigation,
    summary,
    generatedAt: new Date().toISOString(),
  };
}

export { generateNavigationCapability, CAPABILITY_NAME };
