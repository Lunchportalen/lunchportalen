/**
 * Site generation engine capability: generateFullSite.
 * Generates a full site structure: pages (path, title, description, purpose, suggestedBlockTypes),
 * primary and secondary navigation, from business type, audience, and primary goals.
 * Uses the site architecture generator; deterministic; no LLM.
 * Import this module to register the capability.
 */

import {
  generateSiteArchitecture,
  type GenerateSiteArchitectureInput,
  type PageTreeNode,
  type LandingPageRecommendation,
  type PrimaryNavItem,
  type SecondaryNavItem,
} from "@/lib/ai/architecture/generateSiteArchitecture";
import type { Capability } from "../../capabilityRegistry";
import { registerCapability } from "../../capabilityRegistry";

const CAPABILITY_NAME = "generateFullSite";

const generateFullSiteCapability: Capability = {
  name: CAPABILITY_NAME,
  description:
    "Site generation engine: generates full site structure from business type, audience, and primary goals. Returns pages (path, title, description, purpose, suggestedBlockTypes), primary and secondary navigation, and summary. Deterministic; no LLM.",
  requiredContext: [],
  inputSchema: {
    type: "object",
    description: "Generate full site input",
    properties: {
      businessType: {
        type: "string",
        description: "Business type (e.g. restaurant, saas, e-commerce, consulting)",
      },
      audience: { type: "string", description: "Target audience" },
      primaryGoals: {
        type: "array",
        description: "Primary goals (e.g. drive signups, showcase menu, book tables)",
        items: { type: "string" },
      },
      locale: { type: "string", description: "Locale (nb | en) for copy" },
      maxPages: { type: "number", description: "Optional max pages to return (default 20)" },
    },
    required: [],
  },
  outputSchema: {
    type: "object",
    description: "Generated full site structure",
    required: ["pages", "primaryNavigation", "summary"],
    properties: {
      pages: {
        type: "array",
        description: "Generated pages with path, title, description, purpose, suggestedBlockTypes",
        items: {
          type: "object",
          required: ["path", "title", "purpose", "suggestedBlockTypes"],
          properties: {
            path: { type: "string" },
            title: { type: "string" },
            description: { type: "string" },
            purpose: { type: "string" },
            pageType: { type: "string", description: "landing | contact | info | pricing | generic" },
            suggestedBlockTypes: {
              type: "array",
              items: { type: "string" },
            },
          },
        },
      },
      primaryNavigation: {
        type: "array",
        items: {
          type: "object",
          properties: {
            label: { type: "string" },
            path: { type: "string" },
            order: { type: "number" },
          },
        },
      },
      secondaryNavigation: {
        type: "array",
        items: {
          type: "object",
          properties: {
            label: { type: "string" },
            path: { type: "string" },
            order: { type: "number" },
          },
        },
      },
      landingPages: {
        type: "array",
        description: "Recommended landing pages with priority",
        items: {
          type: "object",
          properties: {
            path: { type: "string" },
            title: { type: "string" },
            purpose: { type: "string" },
            priority: { type: "string" },
          },
        },
      },
      summary: { type: "string" },
      generatedAt: { type: "string", description: "ISO timestamp" },
    },
  },
  safetyConstraints: [
    { code: "suggestions_only", description: "Output is site structure suggestions only; no content or system mutation.", enforce: "hard" },
  ],
  targetSurfaces: ["backoffice", "editor", "api"],
};

registerCapability(generateFullSiteCapability);

export type GenerateFullSiteInput = {
  businessType?: string | null;
  audience?: string | null;
  primaryGoals?: string[] | null;
  locale?: "nb" | "en" | null;
  maxPages?: number | null;
};

export type GeneratedSitePage = {
  path: string;
  title: string;
  description?: string | null;
  purpose: string;
  pageType: "landing" | "contact" | "info" | "pricing" | "generic";
  suggestedBlockTypes: string[];
};

export type GenerateFullSiteOutput = {
  pages: GeneratedSitePage[];
  primaryNavigation: PrimaryNavItem[];
  secondaryNavigation: SecondaryNavItem[];
  landingPages: LandingPageRecommendation[];
  summary: string;
  generatedAt: string;
};

/** Flatten page tree to list of nodes with path, title, description. */
function flattenPageTree(nodes: PageTreeNode[], basePath = ""): Array<{ path: string; title: string; description?: string }> {
  const out: Array<{ path: string; title: string; description?: string }> = [];
  for (const node of nodes) {
    const path = node.path.startsWith("/") ? node.path : `${basePath}/${node.path}`.replace(/\/+/g, "/");
    out.push({
      path,
      title: node.title,
      description: node.description ?? undefined,
    });
    if (node.children && node.children.length > 0) {
      out.push(...flattenPageTree(node.children, path));
    }
  }
  return out;
}

/** Derive page type from path and purpose. */
function derivePageType(path: string, purpose: string): GeneratedSitePage["pageType"] {
  const p = path.toLowerCase().replace(/\/$/, "") || "/";
  const purp = purpose.toLowerCase();
  if (p === "/" || purp.includes("entry") || purp.includes("inngang")) return "landing";
  if (/\/kontakt|\/contact/.test(p) || purp.includes("contact") || purp.includes("lead")) return "contact";
  if (/\/pris|\/prising|\/priser|\/pricing/.test(p) || purp.includes("pricing") || purp.includes("pris")) return "pricing";
  if (/\/om-oss|\/about|\/info|\/tjenester|\/services|\/meny|\/menu/.test(p)) return "info";
  return "generic";
}

/** Suggested block types by page type (1-3-1 aligned). */
function suggestedBlockTypesForPageType(pageType: GeneratedSitePage["pageType"]): string[] {
  switch (pageType) {
    case "landing":
      return ["hero", "richText", "richText", "cta"];
    case "contact":
      return ["hero", "richText", "cta"];
    case "pricing":
      return ["hero", "richText", "richText", "cta"];
    case "info":
      return ["hero", "richText", "richText", "divider", "cta"];
    default:
      return ["hero", "richText", "cta"];
  }
}

/**
 * Generates full site structure from business type, audience, and primary goals.
 * Deterministic; uses generateSiteArchitecture.
 */
export function generateFullSite(input: GenerateFullSiteInput = {}): GenerateFullSiteOutput {
  const locale = input.locale === "en" ? "en" : "nb";
  const maxPages = Math.min(50, Math.max(1, Math.floor(Number(input.maxPages) ?? 20)));

  const archInput: GenerateSiteArchitectureInput = {
    businessType: (input.businessType ?? "").trim() || (locale === "en" ? "Business" : "Virksomhet"),
    audience: (input.audience ?? "").trim() || (locale === "en" ? "Visitors" : "Besøkende"),
    primaryGoals: Array.isArray(input.primaryGoals)
      ? input.primaryGoals.filter((g) => typeof g === "string" && (g as string).trim()).map((g) => (g as string).trim())
      : [],
    locale,
  };

  const arch = generateSiteArchitecture(archInput);
  const flat = flattenPageTree(arch.recommendedPageTree);
  const purposeByPath = new Map<string, string>(
    arch.landingPages.map((lp) => [lp.path.replace(/\/$/, "") || "/", lp.purpose])
  );

  const pages: GeneratedSitePage[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < flat.length && pages.length < maxPages; i++) {
    const { path, title, description } = flat[i];
    const normPath = path.replace(/\/$/, "") || "/";
    if (seen.has(normPath)) continue;
    seen.add(normPath);
    const purpose = purposeByPath.get(normPath) ?? description ?? (locale === "en" ? "Inform and engage." : "Informere og engasjere.");
    const pageType = derivePageType(normPath, purpose);
    pages.push({
      path: normPath,
      title,
      description: description ?? undefined,
      purpose,
      pageType,
      suggestedBlockTypes: suggestedBlockTypesForPageType(pageType),
    });
  }

  return {
    pages,
    primaryNavigation: arch.primaryNavigation,
    secondaryNavigation: arch.secondaryNavigation,
    landingPages: arch.landingPages,
    summary: arch.summary ?? "",
    generatedAt: new Date().toISOString(),
  };
}

export { generateFullSiteCapability, CAPABILITY_NAME };
